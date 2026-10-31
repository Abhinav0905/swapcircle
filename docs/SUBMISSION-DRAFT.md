# SwapCircle submission draft

Submission copy. Sent to Devpost and verified live on October 30, 2026 at 6:36 p.m. Pacific. [Public project page](https://devpost.com/software/swapcircle-f2lmq5). Receipt: `SUBMISSION-RECEIPT.json`.

Existing Devpost project **1519439** is published as **SwapCircle** and entered in the Qloo Agentic Hackathon. Project work began on **October 30, 2026**. The [event deadline](https://qloo.devpost.com/) is **8:45 p.m. PDT that day**.

## Fields

**Name:** SwapCircle

**Tagline:** Find the book you'd love, then close a swap everyone agrees to.

**Built with:** TypeScript, React, Vinext, Qloo, Cloudflare Workers, Cloudflare D1, Drizzle, Model Context Protocol

**Demo URL:** https://swapcircle-books.abhinav-0905.chatgpt.site (public; anonymous access verified).

**Source URL:** https://github.com/Abhinav0905/swapcircle (public; anonymous access verified).

**Walkthrough page:** https://swapcircle-books.abhinav-0905.chatgpt.site/walkthrough

**Video asset:** https://swapcircle-books.abhinav-0905.chatgpt.site/swapcircle-walkthrough.mp4, with English captions at `/swapcircle-walkthrough.vtt`. This is an illustrated presentation of the sample workflow, not a screen recording. The page, MP4, captions and poster are public. Anonymous delivery and the MP4 hash were verified; browser playback was unavailable. See `docs/VERIFICATION.md`. Video is optional under the event requirements. Devpost's dedicated video field requires a YouTube or Vimeo URL, so this hosted walkthrough belongs in the project links unless such a URL is separately published.

## Project story

**Demo status:** The published app runs the exchange, approval and repair workflow with an explicitly labeled sample. The readers are fictional, the rankings are authored and their choices and approvals are simulated. The server-side Qloo integration is implemented and tested with synthetic provider responses. We requested access, but no API key was available, so genuine Qloo search and ranking remain unverified.

### Inspiration

You want Leo's book. Leo wants Noor's. Noor might want yours, but she has never heard of it.

A direct swap cannot close that circle. A trade solver also needs people to know what they want first. SwapCircle starts one step earlier: help readers discover books already on the table through the films, music and stories they love.

Community book swaps gave us the audience. Existing work shaped the scope. TasteSwap had already proposed taste-based item matching, and TradeMaximizer already handles multi-party trades. We focused on the gap between discovering an unfamiliar book, choosing to read it and approving a specific exchange.

### What it does

The intended live flow supports two to eight readers, each with one physical book and a few cultural favorites. Once a valid server-side key is available, the implemented Qloo client is designed to resolve those identities through typed search and request Insights rankings restricted to the other available books. This provider path has not yet been verified with genuine responses.

Readers mark the books they would read. The agent finds circles of two to four people, compares the result with direct swaps and asks a useful unanswered question when another choice could close a circle. Nobody's answer is inferred from a score.

Each reader then approves the exact book they give and receive through a separate private link. If someone withdraws, the agent repairs the plan, protects unchanged approved circles and clears approval from changed exchanges. Handoff cards describe the resulting plan.

### Why Qloo matters

Qloo is intended to supply discovery before a want list exists. A reader may recognize none of the available books but know the films and music they love. The integration is designed to use those favorites to rank only the books the group actually offered, then help the agent choose a useful next question. The current sample illustrates the workflow after rankings arrive; it does not establish Qloo's ranking quality.

The application keeps three things separate: Qloo's suggestion, a person's reading choice and their final exchange approval. Missing provider evidence stays unknown. Raw scores are not compared across readers, and failed live calls never become sample results.

### How it is built

TypeScript classes separate the provider client, graph builder, cycle enumeration, optimization, question selection, approval checks and persistence. React provides the interface. Vinext runs the application on Cloudflare Workers, and D1 stores room state with revision checks so a stale browser cannot overwrite a newer decision.

The application agent follows a bounded workflow. It does not call a language model. Four read-only MCP tools let an external assistant inspect a room, explain stored evidence, preview a plan or suggest the next question. The tools cannot approve exchanges or contact participants.

### What we verified

At the current local checkpoint, 88 automated tests pass. The solver was compared with a separate oracle on 120 seeded graphs and their repairs. Other tests cover missing evidence, duplicate physical copies, withdrawals, stale writes, exact-circle approvals, access rules and provider failures.

A separate HTTP/D1 smoke passed 107 assertions on each of three targets: the development server, the local built production Worker and the hosted Cloudflare Worker with D1. It exercised member capabilities, concurrent writes, MCP previews and the exchange/approval/withdrawal/repair sequence. These runs used fixture rankings and made no live Qloo calls. TypeScript checks and the production build also passed. The Node 22 GitHub Actions workflow also passed its tests, build and HTTP/D1 smoke. A separate eight-case regression probe also passed after bounded request-body handling fixed a reproduced local proxy failure. The verification record includes the before-and-after evidence.

The sample demonstrates 2 matched readers, then 6 after Noor's reading choice, back to 2 after her withdrawal and 5 after Leo answers the repair question. These are authored data and simulated responses. They prove the workflow's behavior on that scenario, not Qloo ranking quality or real reader satisfaction.

The illustrated walkthrough explains this same sequence, which was checked through the working app's HTTP endpoints. Its scenes are illustrations, not a browser recording or evidence of a live Qloo run. To test the app directly, choose **Try a sample circle**, review Noor's suggested book, approve the proposed sample circles, withdraw Noor and answer Leo's repair question. Each changed circle needs fresh approval.

### Current limits

Live Qloo access has not yet been verified at submission. The hosted app and MIT-licensed source repository are public. Anonymous app access and all 107 hosted workflow assertions passed after release. The sample remains clearly labeled. This disclosure does not establish that the hackathon's working-Qloo requirement has been met.

Invitation links grant access, not verified identity. The host receives those links to distribute and could retain them. Members supply book condition, ownership and availability. The application does not ship books, take payment or confirm a physical handoff.

### What's next

First, verify the complete live provider path using the organizer-issued key. Then let a small consenting group try their own books and record which suggestions they accept and which approved exchanges happen. That would provide evidence the sample cannot.

### AI assistance and source

Kumar Abhinav directed the project. Codex agents assisted with research, implementation and testing during the submission period. Project source is prepared under the MIT license. Predecessors and research sources are documented in `docs/RESEARCH.md`.

## For later edits

- Use the verified public demo and repository URLs above.
- Update the live-provider paragraph only after a genuine typed search and full room ranking succeed.
- Record hosted browser and D1 checks separately from local tests.
- Recheck the test count after the final source change.
- Keep sample counts labeled as authored behavior.
- Verify the walkthrough page, MP4, captions and poster after the media update is published. Do not claim browser playback or visual browser checks until they have actually been performed.
- Verify the existing Devpost project's saved fields and final submission state after any authorized update.

## Prepared graphics

- `docs/assets/swapcircle-cover.png`: 1200 × 800 original cover graphic.
- `docs/assets/swapcircle-sample-flow.png`: 1600 × 900 explanation of the authored sample.

These are graphics, not application screenshots. The sample diagram labels authored rankings and simulated responses.
