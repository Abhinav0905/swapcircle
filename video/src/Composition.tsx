import {AbsoluteFill, Series, staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {BasicCaptions} from './basic-captions';
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
export const Walkthrough = () => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill><Series>
      <Series.Sequence name="The swap that stops" durationInFrames={299} premountFor={fps}>
        <Opening />
        <Audio src={staticFile('audio/scene-1.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={[
  {
    "text": "A book swap sounds simple: bring a book, find one you want.",
    "startMs": 300,
    "endMs": 4227,
    "timestampMs": 2264,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Then you discover its owner doesn't want yours.",
    "startMs": 4227,
    "endMs": 6814,
    "timestampMs": 5521,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "A useful trade might need more than two people.",
    "startMs": 6814,
    "endMs": 9313,
    "timestampMs": 8063,
    "confidence": null,
    "pageBreakAfter": true
  }
]} />
      </Series.Sequence>

      <Series.Sequence name="Set the evidence boundary" durationInFrames={382} premountFor={fps}>
        <Disclosure />
        <Audio src={staticFile('audio/scene-2.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={[
  {
    "text": "We built SwapCircle for that missing connection.",
    "startMs": 300,
    "endMs": 2914,
    "timestampMs": 1607,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "We requested a Qloo API key, but it hadn't arrived when we made",
    "startMs": 2914,
    "endMs": 6991,
    "timestampMs": 4953,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "this video.",
    "startMs": 6991,
    "endMs": 7619,
    "timestampMs": 7305,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "This is an illustrated walkthrough with authored rankings and",
    "startMs": 7619,
    "endMs": 11265,
    "timestampMs": 9442,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "simulated responses.",
    "startMs": 11265,
    "endMs": 12075,
    "timestampMs": 11670,
    "confidence": null,
    "pageBreakAfter": true
  }
]} />
      </Series.Sequence>

      <Series.Sequence name="Start with two" durationInFrames={344} premountFor={fps}>
        <Initial />
        <Audio src={staticFile('audio/scene-3.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={[
  {
    "text": "Six fictional readers bring six books.",
    "startMs": 300,
    "endMs": 2726,
    "timestampMs": 1513,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Iris and Sam already want each other's, so two people have an",
    "startMs": 2726,
    "endMs": 6899,
    "timestampMs": 4813,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "exchange.",
    "startMs": 6899,
    "endMs": 7247,
    "timestampMs": 7073,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The other four are waiting.",
    "startMs": 7247,
    "endMs": 8684,
    "timestampMs": 7966,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Nobody has to take an unwanted book.",
    "startMs": 8684,
    "endMs": 10800,
    "timestampMs": 9742,
    "confidence": null,
    "pageBreakAfter": true
  }
]} />
      </Series.Sequence>

      <Series.Sequence name="One useful question" durationInFrames={419} premountFor={fps}>
        <Question />
        <Audio src={staticFile('audio/scene-4.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={[
  {
    "text": "The agent asks Noor about Jules's book, A Psalm for the",
    "startMs": 300,
    "endMs": 4215,
    "timestampMs": 2257,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Wild-Built.",
    "startMs": 4215,
    "endMs": 4570,
    "timestampMs": 4392,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "In this sample, she says yes.",
    "startMs": 4570,
    "endMs": 6814,
    "timestampMs": 5692,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "That closes a four-person circle.",
    "startMs": 6814,
    "endMs": 8936,
    "timestampMs": 7875,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Alongside Iris and Sam, six readers now have proposed exchanges.",
    "startMs": 8936,
    "endMs": 13293,
    "timestampMs": 11115,
    "confidence": null,
    "pageBreakAfter": true
  }
]} />
      </Series.Sequence>

      <Series.Sequence name="Approve the exact trade" durationInFrames={323} premountFor={fps}>
        <Approval />
        <Audio src={staticFile('audio/scene-5.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={[
  {
    "text": "Wanting a book isn't approving a trade.",
    "startMs": 300,
    "endMs": 2357,
    "timestampMs": 1329,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Each reader checks the exact book they'll give and receive.",
    "startMs": 2357,
    "endMs": 5348,
    "timestampMs": 3852,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "We simulate all six approvals here.",
    "startMs": 5348,
    "endMs": 7544,
    "timestampMs": 6446,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The plan can now produce handoff cards.",
    "startMs": 7544,
    "endMs": 10084,
    "timestampMs": 8814,
    "confidence": null,
    "pageBreakAfter": true
  }
]} />
      </Series.Sequence>

      <Series.Sequence name="A reader steps out" durationInFrames={350} premountFor={fps}>
        <Withdrawal />
        <Audio src={staticFile('audio/scene-6.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={[
  {
    "text": "Then Noor steps out.",
    "startMs": 300,
    "endMs": 1519,
    "timestampMs": 910,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Her book leaves the table.",
    "startMs": 1519,
    "endMs": 2849,
    "timestampMs": 2184,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The affected circle disappears, and its approvals clear.",
    "startMs": 2849,
    "endMs": 6446,
    "timestampMs": 4647,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Iris and Sam keep their unchanged, approved swap.",
    "startMs": 6446,
    "endMs": 9898,
    "timestampMs": 8172,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "We're back to two.",
    "startMs": 9898,
    "endMs": 11003,
    "timestampMs": 10451,
    "confidence": null,
    "pageBreakAfter": true
  }
]} />
      </Series.Sequence>

      <Series.Sequence name="Repair without reusing permission" durationInFrames={420} premountFor={fps}>
        <Repair />
        <Audio src={staticFile('audio/scene-7.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={[
  {
    "text": "The agent asks Leo whether he'd read Jules's book.",
    "startMs": 300,
    "endMs": 3084,
    "timestampMs": 1692,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "His sample answer closes a new three-person circle.",
    "startMs": 3084,
    "endMs": 6184,
    "timestampMs": 4634,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Five readers now have proposals.",
    "startMs": 6184,
    "endMs": 8190,
    "timestampMs": 7187,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The changed circle needs fresh approval.",
    "startMs": 8190,
    "endMs": 10417,
    "timestampMs": 9303,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Earlier approval cannot authorize a different trade.",
    "startMs": 10417,
    "endMs": 13335,
    "timestampMs": 11876,
    "confidence": null,
    "pageBreakAfter": true
  }
]} />
      </Series.Sequence>

      <Series.Sequence name="Where Qloo would enter" durationInFrames={481} premountFor={fps}>
        <Qloo />
        <Audio src={staticFile('audio/scene-8.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={[
  {
    "text": "With a valid key, the implemented Qloo search would resolve",
    "startMs": 300,
    "endMs": 4147,
    "timestampMs": 2224,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "readers' favorite films, artists and books.",
    "startMs": 4147,
    "endMs": 6456,
    "timestampMs": 5301,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Insights would rank only the other available books for each",
    "startMs": 6456,
    "endMs": 9572,
    "timestampMs": 8014,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "reader.",
    "startMs": 9572,
    "endMs": 9884,
    "timestampMs": 9728,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "That evidence would guide the next reading question.",
    "startMs": 9884,
    "endMs": 12517,
    "timestampMs": 11200,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Real results could produce fewer exchanges.",
    "startMs": 12517,
    "endMs": 15352,
    "timestampMs": 13934,
    "confidence": null,
    "pageBreakAfter": true
  }
]} />
      </Series.Sequence>

      <Series.Sequence name="The boundaries hold" durationInFrames={478} premountFor={fps}>
        <Boundaries />
        <Audio src={staticFile('audio/scene-9.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={[
  {
    "text": "Recommendations never approve trades.",
    "startMs": 300,
    "endMs": 2660,
    "timestampMs": 1480,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Unknown stays unknown, and failed live requests never substitute",
    "startMs": 2660,
    "endMs": 6604,
    "timestampMs": 4632,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "sample data.",
    "startMs": 6604,
    "endMs": 7481,
    "timestampMs": 7043,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Eighty-eight automated tests and 107 checks against the public app",
    "startMs": 7481,
    "endMs": 11864,
    "timestampMs": 9672,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "passed.",
    "startMs": 11864,
    "endMs": 12302,
    "timestampMs": 12083,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Those checks used authored data, not live Qloo.",
    "startMs": 12302,
    "endMs": 15283,
    "timestampMs": 13793,
    "confidence": null,
    "pageBreakAfter": true
  }
]} />
      </Series.Sequence>

      <Series.Sequence name="Leave a clear next step" durationInFrames={392} premountFor={fps}>
        <Closing />
        <Audio src={staticFile('audio/scene-10.m4a')} premountFor={fps} />
        <BasicCaptions name="English captions" width={2500} premountFor={fps}
          style={{position: 'absolute', left: 115, top: 626, scale: .42, transformOrigin: 'top left'}}
          captions={[
  {
    "text": "Try the public sample and inspect the MIT-licensed source.",
    "startMs": 300,
    "endMs": 4152,
    "timestampMs": 2226,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The exchange workflow is available today.",
    "startMs": 4152,
    "endMs": 6670,
    "timestampMs": 5411,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Live Qloo verification remains pending.",
    "startMs": 6670,
    "endMs": 9041,
    "timestampMs": 7855,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Your books.",
    "startMs": 9041,
    "endMs": 9740,
    "timestampMs": 9390,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Your choice.",
    "startMs": 9740,
    "endMs": 10543,
    "timestampMs": 10142,
    "confidence": null,
    "pageBreakAfter": true
  }
]} />
      </Series.Sequence>
  </Series></AbsoluteFill>;
};
