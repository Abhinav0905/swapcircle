# SwapCircle video script

Final rendered length: 2 minutes 9.6 seconds (129.6 seconds at 30 fps). Narration: 319 words. The scene times below match the rendered timeline.

This is an illustrated walkthrough built from captured sample-workflow states, not a screen recording. The sample uses fictional readers, authored rankings and simulated reading choices and approvals. Keep those labels visible. Do not present the sample as a recorded Qloo run, a promised match count or a measured benefit.

| Time | Scene | Voiceover | Large on-screen text | Visual direction |
| --- | --- | --- | --- | --- |
| 00:00-00:09 | The swap that stops | A book swap sounds simple: bring a book, find one you want. Then you discover its owner doesn't want yours. A useful trade might need more than two people. | You want their book. They want someone else's. | Two original book forms face each other. A third enters the frame. Keep the opening quiet and give the problem a beat. |
| 00:09-00:22 | Set the evidence boundary | We built SwapCircle for that missing connection. We requested a Qloo API key, but it hadn't arrived when we made this video. This is an illustrated walkthrough with authored rankings and simulated responses. | Illustrated sample | Show the cover, then the exact disclosure: "Authored rankings and simulated responses." Add "Qloo key requested. Live verification pending." Keep a smaller "Illustrative sample" label throughout scenes 3-7. |
| 00:22-00:34 | Start with two | Six fictional readers bring six books. Iris and Sam already want each other's, so two people have an exchange. The other four are waiting. Nobody has to take an unwanted book. | 2 readers matched | Animate the initial sample state from captured workflow data. Highlight only the Iris-Sam pair. Keep all six names visible. |
| 00:34-00:48 | One useful question | The agent asks Noor about Jules's book, A Psalm for the Wild-Built. In this sample, she says yes. That closes a four-person circle. Alongside Iris and Sam, six readers now have proposed exchanges. | One answer. A new circle. | Hold on Noor's proposed reading question. Animate book handoffs: Jules to Noor, Noor to Leo, Leo to Maya, Maya to Jules. Then show 2 to 6. Label the response "Simulated reading choice". |
| 00:48-00:58 | Approve the exact trade | Wanting a book isn't approving a trade. Each reader checks the exact book they'll give and receive. We simulate all six approvals here. The plan can now produce handoff cards. | Choice is not approval. | Reveal one give/receive card, then six approval marks. Label them "Simulated approvals". Hold the complete plan for one second. |
| 00:58-01:10 | A reader steps out | Then Noor steps out. Her book leaves the table. The affected circle disappears, and its approvals clear. Iris and Sam keep their unchanged, approved swap. We're back to two. | 6 to 2. The unchanged pair stays. | Fade Noor and her offered copy. Remove the four-person circle and its approval marks. Preserve Iris and Sam and their approval marks. |
| 01:10-01:24 | Repair without reusing permission | The agent asks Leo whether he'd read Jules's book. His sample answer closes a new three-person circle. Five readers now have proposals. The changed circle needs fresh approval. Earlier approval cannot authorize a different trade. | 2 to 5. Fresh approval required. | Animate Jules to Leo, Leo to Maya, Maya to Jules. Keep Iris-Sam intact. The new circle starts with empty approval marks. Pause on the distinction. |
| 01:24-01:40 | Where Qloo would enter | With a valid key, the implemented Qloo search would resolve readers' favorite films, artists and books. Insights would rank only the other available books for each reader. That evidence would guide the next reading question. Real results could produce fewer exchanges. | Favorite films + music + books → available books | Use an original data-flow diagram, not fabricated provider output. Show GET /search, then GET /v2/insights and filter.results.entities. Label this entire scene "Implemented integration. Live request not yet verified." Do not display invented affinities or attribution. |
| 01:40-01:56 | The boundaries hold | Recommendations never approve trades. Unknown stays unknown, and failed live requests never substitute sample data. Eighty-eight automated tests and 107 checks against the public app passed. Those checks used authored data, not live Qloo. | Taste suggests. People decide. | Show three short beats: "Unknown stays unknown", "No silent sample fallback", then "88 automated tests · 107 public workflow assertions". Keep the sample-data qualifier beside the counts. |
| 01:56-02:09 | Leave a clear next step | Try the public sample and inspect the MIT-licensed source. The exchange workflow is available today. Live Qloo verification remains pending. Your books. Your choice. | Good books, full circle. | End on the cover and two readable links: swapcircle-books.abhinav-0905.chatgpt.site and github.com/Abhinav0905/swapcircle. Keep "Live Qloo verification pending" visible. Hold the final card for at least two seconds. |

## Production notes

- Use the existing cream, pine and serif design. Graph arrows represent physical book handoffs, not Qloo taste links. The person receiving a book must have chosen it.
- Voiceover should sound like a person explaining a small, useful product. No dramatic claims, rushed statistics or synthetic applause. Let the change from six to two sit for a moment.
- In scene 4, Noor's reading choice opens a possible exchange. It does not approve that exchange. In scene 7, Iris and Sam retain their unchanged approvals; Jules, Leo and Maya need new ones.
- The key disclosure reflects the build session: access was requested but no key had arrived when this script was prepared. Recheck immediately before rendering. If a key arrives, do not change the video to "live" until a genuine search and ranking run has passed and its actual results are shown.
- The 88-test and 107-assertion statements describe the recorded checkpoint. They do not establish live Qloo access, human satisfaction or a physical handoff.

## Claim checks

| Claim in narration | Checked source |
| --- | --- |
| The 2 to 6 to 2 to 5 sample sequence, exact books and handoff directions | [DEMO.md](DEMO.md), including simulated approvals and withdrawal repair. |
| Separate reading choices and exact-trade approvals | [README.md](../README.md), [ConsentService.ts](../lib/exchange/ConsentService.ts) and [ExchangeWorkspace.tsx](../components/swapcircle/ExchangeWorkspace.tsx). |
| Typed entity search and ranking only other available books | [QlooClient.ts](../lib/qloo/QlooClient.ts): `/search`, typed entity parameters, self-owned/unavailable exclusion and `filter.results.entities`. |
| Missing results stay unknown; live failures do not become sample evidence | [Qloo provider boundary](../lib/qloo/README.md), [QlooClient.ts](../lib/qloo/QlooClient.ts) and [README.md](../README.md). |
| 88 automated tests, 107 public HTTP/D1 assertions, public app and MIT source | [VERIFICATION.md](VERIFICATION.md) and [README.md](../README.md). The hosted checks use authored sample data. |
| Key requested but not received at preparation time | Build-session status provided for this video; live provider verification remains pending in the README and verification record. |

Public app: https://swapcircle-books.abhinav-0905.chatgpt.site

MIT source: https://github.com/Abhinav0905/swapcircle
