import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {execFileSync as execProcessSync} from 'node:child_process';
import {resolve} from 'node:path';

// Local synthetic narration. Every sentence has measured audio timing.
const root = resolve(import.meta.dirname, '..');
const binaries = resolve(root, `node_modules/@remotion/compositor-${process.platform}-${process.arch}`);
const execFileSync = (command, args, options = {}) => execProcessSync(
  command === 'ffmpeg' || command === 'ffprobe' ? resolve(binaries, command) : command,
  args,
  {...options, env: {...process.env, DYLD_LIBRARY_PATH: binaries}},
);
const scratch = resolve(root, '../outputs/video-build/audio');
const destination = resolve(root, 'public/audio');
mkdirSync(scratch, {recursive: true});
mkdirSync(destination, {recursive: true});
const script = readFileSync(resolve(root, '../docs/VIDEO-SCRIPT.md'), 'utf8');
const rows = script.split('\n').filter(line => /^\| \d\d:/.test(line));
const fps = 30;
const timeline = [];
let globalSeconds = 0;
let captionIndex = 1;
let vtt = 'WEBVTT\n\n';
let srt = '';
const timestamp = (seconds, separator = '.') => {
  const total = Math.round(seconds * 1000);
  return `${String(Math.floor(total / 3600000)).padStart(2, '0')}:${String(Math.floor(total / 60000) % 60).padStart(2, '0')}:${String(Math.floor(total / 1000) % 60).padStart(2, '0')}${separator}${String(total % 1000).padStart(3, '0')}`;
};
const probe = file => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'}).trim());

for (let index = 0; index < rows.length; index++) {
  const columns = rows[index].split('|').map(column => column.trim());
  const narration = columns[3];
  const sentences = narration.match(/[^.!?]+[.!?]+/g).map(value => value.trim());
  const scene = {id: index + 1, title: columns[2], headline: columns[4], narration, startSeconds: globalSeconds, durationInFrames: 0, captions: []};
  const files = [];
  let seconds = 0.3;
  const silence = resolve(scratch, `silence-${index}.wav`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '0.3', '-c:a', 'pcm_s16le', silence]);
  files.push(silence);
  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
    const text = sentences[sentenceIndex];
    const stem = resolve(scratch, `${index + 1}-${sentenceIndex + 1}`);
    writeFileSync(`${stem}.txt`, text.replaceAll('Qloo', 'Clue'));
    execFileSync('/usr/bin/say', ['-v', 'Daniel', '-r', '158', '--file-format=WAVE', '--data-format=LEI16@48000', '-f', `${stem}.txt`, '-o', `${stem}.wav`]);
    const duration = probe(`${stem}.wav`);
    // Caption phrases are aligned within each measured sentence; no invented transcript.
    const words = text.split(/\s+/);
    const groups = [];
    let group = [];
    for (const word of words) {
      if (group.join(' ').length + word.length > 65 && group.length) {groups.push(group); group = [];}
      group.push(word);
    }
    if (group.length) groups.push(group);
    let consumed = 0;
    for (const chunk of groups) {
      const start = seconds + duration * consumed / words.length;
      consumed += chunk.length;
      const end = seconds + duration * consumed / words.length;
      const captionText = chunk.join(' ');
      scene.captions.push({text: captionText, startMs: Math.round(start * 1000), endMs: Math.round(end * 1000), timestampMs: Math.round((start + end) * 500), confidence: null, pageBreakAfter: true});
      vtt += `${timestamp(globalSeconds + start)} --> ${timestamp(globalSeconds + end)}\n${captionText}\n\n`;
      srt += `${captionIndex++}\n${timestamp(globalSeconds + start, ',')} --> ${timestamp(globalSeconds + end, ',')}\n${captionText}\n\n`;
    }
    files.push(`${stem}.wav`);
    seconds += duration;
  }
  const tail = resolve(scratch, `tail-${index}.wav`);
  scene.durationInFrames = Math.ceil((seconds + (index === rows.length - 1 ? 2.5 : 0.65)) * fps);
  const padding = scene.durationInFrames / fps - seconds;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', String(padding), '-c:a', 'pcm_s16le', tail]);
  files.push(tail);
  const listFile = resolve(scratch, `scene-${index + 1}.txt`);
  writeFileSync(listFile, files.map(file => `file '${file}'`).join('\n'));
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'aac', '-b:a', '128k', '-f', 'mp4', resolve(destination, `scene-${index + 1}.m4a`)]);
  globalSeconds += scene.durationInFrames / fps;
  timeline.push(scene);
  console.log(`Scene ${index + 1}: ${(scene.durationInFrames / fps).toFixed(2)} seconds`);
}
mkdirSync(resolve(root, 'src/data'), {recursive: true});
writeFileSync(resolve(root, 'src/data/timeline.json'), JSON.stringify({fps, durationInFrames: timeline.reduce((sum, scene) => sum + scene.durationInFrames, 0), voice: 'macOS Daniel synthetic narration', scenes: timeline}, null, 2));
writeFileSync(resolve(root, '../public/swapcircle-walkthrough.vtt'), vtt);
writeFileSync(resolve(root, '../docs/swapcircle-walkthrough.srt'), srt);
console.log(`Total ${globalSeconds.toFixed(2)} seconds. Narration and captions generated.`);
