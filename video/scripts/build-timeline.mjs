import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const timeline = JSON.parse(readFileSync(resolve(root, 'src/data/timeline.json'), 'utf8'));
const names = ['Opening', 'Disclosure', 'Initial', 'Question', 'Approval', 'Withdrawal', 'Repair', 'Qloo', 'Boundaries', 'Closing'];
const imports = names.map(name => `import {${name}} from './scenes/${name}';`).join('\n');
// Emit independently editable JSX nodes and caption arrays, with measured durations.
const sequences = timeline.scenes.map((scene, i) => `
      <Series.Sequence name=${JSON.stringify(scene.title)} durationInFrames={${scene.durationInFrames}} premountFor={fps}>
        <${names[i]} />
        <Audio src={staticFile('audio/scene-${i + 1}.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={${JSON.stringify(scene.captions, null, 2)}} />
      </Series.Sequence>`).join('\n');
writeFileSync(resolve(root, 'src/Composition.tsx'), `import {AbsoluteFill, Series, staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {BasicCaptions} from './basic-captions';
${imports}
export const Walkthrough = () => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill><Series>${sequences}
  </Series></AbsoluteFill>;
};
`);
const compositions = timeline.scenes.map((scene, i) => `      <Composition id="${names[i]}" component={${names[i]}} durationInFrames={${scene.durationInFrames}} fps={30} width={1280} height={720} />`).join('\n');
writeFileSync(resolve(root, 'src/Root.tsx'), `import {Composition, Folder} from 'remotion';
import {Walkthrough} from './Composition';
${imports}
export const RemotionRoot = () => <>
    <Composition id="SwapCircle" component={Walkthrough} durationInFrames={${timeline.durationInFrames}} fps={30} width={1280} height={720} />
    <Folder name="Scenes">
${compositions}
    </Folder>
  </>;
`);
console.log('Timeline generated:', timeline.durationInFrames, 'frames');
