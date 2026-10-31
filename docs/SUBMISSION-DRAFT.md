# SwapCircle submission draft

Local preparation only. This file has not been sent to Devpost.

Target the existing project **1519439**, reported in this build session as **Untitled**. Do not create another project to use this draft. Project work began on **October 30, 2026**. The [event deadline](https://qloo.devpost.com/) is **8:45 p.m. PDT that day**.

## Fields

**Name:** SwapCircle

**Tagline:** Find the book you'd love, then close a swap everyone agrees to.

**Built with:** TypeScript, React, Vinext, Qloo, Cloudflare Workers, Cloudflare D1, Drizzle, Model Context Protocol

**Demo URL:** https://swapcircle-books.abhinav-0905.chatgpt.site (public; anonymous access verified).

**Source URL:** https://github.com/Abhinav0905/swapcircle (public; anonymous access verified).

**Video:** Optional under the current event requirements. None supplied by this draft.

## Project story

### Inspiration

You want Leo's book. Leo wants Noor's. Noor might want yours, but she has never heard of it.

A direct swap cannot close that circle. A trade solver also needs people to know what they want first. SwapCircle starts one step earlier: help readers discover books already on the table through the films, music and stories they love.

Community book swaps gave us the audience. Existing work shaped the scope. TasteSwap had already proposed taste-based item matching, and TradeMaximizer already handles multi-party trades. We focused on the gap between discovering an unfamiliar book, choosing to read it and approving a specific exchange.

### What it does

Two to eight readers each offer one physical book and add their cultural favorites. Qloo searches resolve the identities. Its Insights API ranks only the other available books for each reader.

Readers mark the books they would read. The agent finds circles of two to four people, compares the result with direct swaps and asks a useful unanswered question when another choice could close a circle. Nobody's answer is inferred from a score.

Each reader then approves the exact book they give and receive through a separate private link. If someone withdraws, the agent repairs the plan, protects unchanged approved circles and clears approval from changed exchanges. Handoff cards describe the resulting plan.

### Why Qloo matters

Qloo supplies the cross-domain discovery before a want list exists. A favorite film or artist becomes a signal for ranking the books that these people actually offered. That evidence helps the agent choose what to ask next.

The application keeps three things separate: Qloo's suggestion, a person's reading choice and their final exchange approval. Missing provider evidence stays unknown. Raw scores are not compared across readers, and failed live calls never become sample results.

### How it is built

TypeScript classes separate the provider client, graph builder, cycle enumeration, optimization, question selection, approval checks and persistence. React provides the interface. Vinext runs the application on Cloudflare Workers, and D1 stores room state with revision checks so a stale browser cannot overwrite a newer decision.

The application agent follows a bounded workflow. It does not call a language model. Four read-only MCP tools let an external assistant inspect a room, explain stored evidence, preview a plan or suggest the next question. The tools cannot approve exchanges or contact participants.

### What we verified

At the current local checkpoint, 78 automated tests pass. The solver was compared with a separate oracle on 120 seeded graphs and their repairs. Other tests cover missing evidence, duplicate physical copies, withdrawals, stale writes, exact-circle approvals, access rules and provider failures.

A separate HTTP/D1 smoke passed 107 assertions on each of three targets: the development server, the local built production Worker and the hosted Cloudflare Worker with D1. It exercised member capabilities, concurrent writes, MCP previews and the exchange/approval/withdrawal/repair sequence. These runs used fixture rankings and made no live Qloo calls. TypeScript checks and the production build also passed. The Node 22 GitHub Actions workflow also passed its tests, build and HTTP/D1 smoke. The verification record preserves an earlier failed smoke attempt and the passing diagnostic rerun.

The sample demonstrates 2 matched readers, then 6 after Noor's reading choice, back to 2 after her withdrawal and 5 after Leo answers the repair question. These are authored data and simulated responses. They prove the workflow's behavior on that scenario, not Qloo ranking quality or real reader satisfaction.

### Current limits

Live Qloo access has not yet been verified at this draft checkpoint. The hosted app and MIT-licensed source repository are public. Anonymous app access and all 107 hosted workflow assertions passed after release. The sample remains clearly labeled.

Invitation links grant access, not verified identity. The host receives those links to distribute and could retain them. Members supply book condition, ownership and availability. The application does not ship books, take payment or confirm a physical handoff.

### What's next

First, verify the complete live provider path using the organizer-issued key. Then let a small consenting group try their own books and record which suggestions they accept and which approved exchanges happen. That would provide evidence the sample cannot.

### AI assistance and source

Kumar Abhinav directed the project. Codex agents assisted with research, implementation and testing during the submission period. Project source is prepared under the MIT license. Predecessors and research sources are documented in `docs/RESEARCH.md`.

## Before publishing this text

- Use the verified public demo and repository URLs above.
- Update the live-provider paragraph only after a genuine typed search and full room ranking succeed.
- Record hosted browser and D1 checks separately from local tests.
- Recheck the test count after the final source change.
- Keep sample counts labeled as authored behavior.
- Verify the existing Devpost project's saved fields and final submission state after any authorized update.

## Prepared graphics

- `docs/assets/swapcircle-cover.png`: 1200 × 800 original cover graphic.
- `docs/assets/swapcircle-sample-flow.png`: 1600 × 900 explanation of the authored sample.

These are graphics, not application screenshots. The sample diagram labels authored rankings and simulated responses.
