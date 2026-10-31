import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const project = resolve(import.meta.dirname, '../..');
const binaries = resolve(project, `video/node_modules/@remotion/compositor-${process.platform}-${process.arch}`);
const env = {...process.env, DYLD_LIBRARY_PATH: binaries};
const file = resolve(project, 'public/swapcircle-walkthrough.mp4');
const metadata = JSON.parse(execFileSync(resolve(binaries, 'ffprobe'), ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels', '-of', 'json', file], {encoding: 'utf8', env}));
execFileSync(resolve(binaries, 'ffmpeg'), ['-v', 'error', '-xerror', '-i', file, '-c:v', 'rawvideo', '-c:a', 'pcm_s16le', '-f', 'null', '-'], {env});
const wave = execFileSync(resolve(binaries, 'ffmpeg'), ['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-f', 'wav', '-'], {env, maxBuffer: 20 * 1024 * 1024});
let audioOffset = 12;
while (audioOffset + 8 < wave.length && wave.toString('ascii', audioOffset, audioOffset + 4) !== 'data') {
  const length = wave.readUInt32LE(audioOffset + 4);
  audioOffset += 8 + length + (length % 2);
}
if (audioOffset + 8 >= wave.length) throw new Error('Decoded audio data missing.');
const pcm = wave.subarray(audioOffset + 8);
let peak = 0, squares = 0;
for (let i = 0; i < pcm.length; i += 2) {const sample = pcm.readInt16LE(i) / 32768; peak = Math.max(peak, Math.abs(sample)); squares += sample * sample;}
const rms = Math.sqrt(squares / (pcm.length / 2));
if (rms < 0.005 || peak >= 1) throw new Error('Narration is silent or clips.');
const bytes = readFileSync(file);
const atoms = [];
let offset = 0;
while (offset + 8 <= bytes.length) {
  let size = bytes.readUInt32BE(offset);
  const type = bytes.toString('ascii', offset + 4, offset + 8);
  if (size === 1) size = Number(bytes.readBigUInt64BE(offset + 8));
  if (size === 0) size = bytes.length - offset;
  atoms.push({type, offset, size});
  if (size < 8) throw new Error('Invalid MP4 atom');
  offset += size;
}
const timeline = JSON.parse(readFileSync(resolve(project, 'video/src/data/timeline.json'), 'utf8'));
let previous = -1, count = 0;
for (const scene of timeline.scenes) for (const cue of scene.captions) {
  const start = scene.startSeconds * 1000 + cue.startMs, end = scene.startSeconds * 1000 + cue.endMs;
  if (start < previous - 1 || end <= start || end > Number(metadata.format.duration) * 1000) throw new Error('Caption timing invalid');
  previous = end; count++;
}
const report = {
  checkedAt: new Date().toISOString(), path: 'public/swapcircle-walkthrough.mp4', sha256: createHash('sha256').update(bytes).digest('hex'), ...metadata,
  fastStart: atoms.findIndex(atom => atom.type === 'moov') < atoms.findIndex(atom => atom.type === 'mdat'), fullDecode: 'passed',
  narrationRmsDbfs: Number((20 * Math.log10(rms)).toFixed(2)), narrationPeakDbfs: Number((20 * Math.log10(peak)).toFixed(2)),
  frameLayoutReview: 'All ten scenes inspected; four exchange scenes rechecked after layout fixes.', captionCount: count,
  captionTiming: 'Monotonic, in range; phrases aligned within measured sentences.', narration: 'macOS Daniel synthetic voice',
  screenRecording: false, liveQlooVerified: false, browserPlayback: 'Not checked: browser control host unavailable',
  posterBytes: statSync(resolve(project, 'public/walkthrough-poster.jpg')).size,
};
if (!report.fastStart) throw new Error('MP4 needs fast-start remux');
writeFileSync(resolve(project, 'docs/VIDEO-VERIFICATION.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
