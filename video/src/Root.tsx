import {Composition, Folder} from 'remotion';
import {Walkthrough} from './Composition';
import {Opening} from './scenes/Opening';
import {Disclosure} from './scenes/Disclosure';
import {Initial} from './scenes/Initial';
import {Question} from './scenes/Question';
import {Approval} from './scenes/Approval';
import {Withdrawal} from './scenes/Withdrawal';
import {Repair} from './scenes/Repair';
import {Qloo} from './scenes/Qloo';
import {Boundaries} from './scenes/Boundaries';
import {Closing} from './scenes/Closing';
export const RemotionRoot = () => <>
    <Composition id="SwapCircle" component={Walkthrough} durationInFrames={3888} fps={30} width={1280} height={720} />
    <Folder name="Scenes">
      <Composition id="Opening" component={Opening} durationInFrames={299} fps={30} width={1280} height={720} />
      <Composition id="Disclosure" component={Disclosure} durationInFrames={382} fps={30} width={1280} height={720} />
      <Composition id="Initial" component={Initial} durationInFrames={344} fps={30} width={1280} height={720} />
      <Composition id="Question" component={Question} durationInFrames={419} fps={30} width={1280} height={720} />
      <Composition id="Approval" component={Approval} durationInFrames={323} fps={30} width={1280} height={720} />
      <Composition id="Withdrawal" component={Withdrawal} durationInFrames={350} fps={30} width={1280} height={720} />
      <Composition id="Repair" component={Repair} durationInFrames={420} fps={30} width={1280} height={720} />
      <Composition id="Qloo" component={Qloo} durationInFrames={481} fps={30} width={1280} height={720} />
      <Composition id="Boundaries" component={Boundaries} durationInFrames={478} fps={30} width={1280} height={720} />
      <Composition id="Closing" component={Closing} durationInFrames={392} fps={30} width={1280} height={720} />
    </Folder>
  </>;
