# SwapCircle illustrated walkthrough

The 129.6-second video follows the sample workflow and explains the intended Qloo integration. It uses original diagrams, captured public-app responses, macOS Daniel synthetic narration and English captions. It is not a browser recording. No live Qloo calls were made.

The capture on October 30, 2026 verified matched-reader counts of 2, 6, 6, 2 and 5, with 0, 0, 6, 2 and 2 simulated approvals. Each action was read back from persistent storage. The disposable circle was deleted, and its next read returned 404. `src/data/evidence.json` contains the sanitized results; credentials and room identifiers were never saved.

## Reproduce

Install this video's separate dependencies:

```sh
cd video
npm ci
npm run typecheck
npm run render
```

The render writes `../public/swapcircle-walkthrough.mp4`. Open the source timeline with `npm run dev -- --no-open`. The main composition is `SwapCircle`; all ten scenes also have independent compositions. Rendering uses Remotion's bundled Chromium and FFmpeg. The app does not depend on those tools at runtime.

The checked-in audio is sufficient for rendering on supported platforms. To regenerate narration on macOS, with the Daniel system voice installed:

```sh
npm run narrate
npm run render
```

`scripts/generate-narration.mjs` reads the scene table in `../docs/VIDEO-SCRIPT.md`, creates audio sentence by sentence and measures its duration. Caption phrases are aligned within each measured sentence. It produces a WebVTT track, SRT and timeline data. `scripts/build-timeline.mjs` writes separate, editable JSX scene nodes and inline caption arrays. Review those generated source changes after adjusting the script.

To capture a new sample, run `node scripts/capture-evidence.mjs` from a network-enabled environment. This creates a disposable sample on the public app, exercises it once and deletes it. It never contacts Qloo. Review the new evidence before rendering because it describes the app at the new capture time.

## Structure and provenance

- `src/scenes/`: ten visual scenes.
- `src/ExchangeDiagram.tsx`: book handoff arrows and counts derived from captured state.
- `src/Frame.tsx`, `src/Book.tsx`, `src/theme.ts`: shared visual elements.
- `src/data/`: sanitized evidence and measured narration timing.
- `public/audio/`: synthetic narration, supplied for repeatable rendering.
- `src/basic-captions.tsx`: unchanged Basic Captions element from [Remotion](https://www.remotion.dev/elements/captions/basic-captions).
- `../public/swapcircle-walkthrough.vtt`: selectable English caption track. Captions are also included in the rendered image.

The script states that a key was requested but was unavailable at recording time. The conditional integration scene does not fabricate provider responses or promise the sample's match count. Real Qloo results and real reader choices could produce a different plan.

Video frames were inspected for layout, diagram direction and disclosure labels. Audio/video stream integrity and hosted delivery are recorded in `../docs/VERIFICATION.md`. Browser playback was not checked because the browser control host was unavailable.

Project-authored source, diagrams and narration are included under the repository's MIT license. Remotion and its dependencies retain their own licenses. Book titles and author names identify the sample's offered books; their original cover art is not used.
