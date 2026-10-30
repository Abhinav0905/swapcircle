# Research and scope

Research date: October 30, 2026. Sources below were read during idea selection. Descriptions of other projects reflect their published pages, not independent tests of their software.

## The event

The [Qloo Agentic Hackathon](https://qloo.devpost.com/) closes at **8:45 p.m. PDT on October 30, 2026**, equivalent to the site's 11:45 p.m. EDT deadline. It requires a working Qloo integration in an agentic tool, an application built with an agent framework or an existing agent. The public page requires an externally published functional demo, public source, an open-source license and a project description. A video is optional. [Official rules](https://qloo.devpost.com/rules)

Judging gives equal weight to technical implementation, design, potential impact and the idea. The [project gallery](https://qloo.devpost.com/project-gallery) was unpublished when checked. Indexed project pages supplied a partial view of entries. The visible participant count cannot establish how many people submitted, and there is no basis for a claim that 95% or 98% had done so.

## What already exists

| Project or approach | Published scope | Consequence for this build |
| --- | --- | --- |
| [TasteSwap](https://devpost.com/software/tastemate-ygufsc), Qloo LLM Hackathon 2025 | Taste-based matching for swapping fashion, books and other items, with generated swap messages. | Taste-based swapping is not a new category. Credit the predecessor and state the narrower workflow we built. |
| [TradeMaximizer](https://github.com/chrisokasaki/TradeMaximizer) | Finds simultaneous multi-party trades from participants' offered items and explicit want lists. | Exchange cycles are established. Our small-room solver is not a new mathematical invention. |
| [Crate](https://devpost.com/software/crate-6jkox0) | Assigns a bookshop's shared stock to cultural events, with reserves, locked crates and repair. | Avoid a shop-inventory allocation pitch. Here each person owns a copy and conditions their exchange on a chosen return. |
| [Ghost Shelf](https://devpost.com/software/ghost-shelf) | Connects patrons' cultural favorites to books in a library's own holdings. | Available-book discovery alone is already covered. The exchange and approval workflow needs to carry the product. |
| [Common Ground](https://devpost.com/software/common-ground-jsw21u) | Ranks places for several people and chooses a group compromise. | Avoid another shared dinner or outing recommender. Readers here receive different books. |
| [HostRead](https://devpost.com/software/hostread) | Uses Qloo audience evidence to suggest podcast sponsors and draft outreach. | Creator sponsorship is a crowded adjacent direction. It does not fit this room's exchange task. |
| [TasteProof](https://devpost.com/software/tasteproof-vpzue8) | Evaluates an agent's proposed recommendation against Qloo evidence. | An agent-audit tool would have a close current competitor and a less direct reader outcome. |

These pages informed selection, not implementation copying. The review does not prove that no other entrant built a similar system.

## A real activity, an untested product hypothesis

Community swaps already bring together people and books. [Myli Libraries' 2026 Great Book Swap](https://www.myli.org.au/news/great-book-swap-2026/) invited readers to bring pre-loved books and browse for their next read. [Flower Mound's 2026 event](https://www.flowermound.gov/m/calendar/event/detail/25876) used one book for one ticket. The [SMB Pune organizer's FAQ](https://www.reddit.com/r/pune/comments/1ru11ss/faqs_smb_free_book_swap_event/) states that participation is voluntary and people can take their books home if they find nothing they want.

Those sources establish an audience and activity. They do not establish a measured matching failure or demand for this software.

The product hypothesis is narrower: before a small gathering, help readers find unfamiliar offered books that fit their interests, then arrange only the exchanges they explicitly want. Conditional circles could be useful when readers want a return they approve before parting with their own copy. A free donation shelf may need no such tool.

## The chosen workflow

Qloo ranks the finite available book pool against each reader's confirmed cultural favorites. Those rankings suggest possibilities. Reading choices form the directed graph, and a separate approval binds each reader to an exact proposed circle.

When the graph is incomplete, the agent tests unanswered choices and asks about a book whose acceptance would increase coverage. A no stays a no. When someone withdraws, the planner preserves feasible fully approved circles and asks for new approvals wherever the trade changes.

Qloo contributes discovery and the evidence used to select a question. A conventional trade solver can operate on hand-written want lists without Qloo. We make no claim that cultural affinity proves consent, ownership or future enjoyment.

## Evidence we have and evidence still needed

The authored six-reader demonstration moves through 2, 6, 2 and 5 matched readers. It compares two-person swaps with longer circles on the same explicit-choice graph. That is a test of exchange behavior, not a comparison of Qloo with a language model.

At the local checkpoint, TypeScript checks, 78 automated tests and the production build passed. Provider contracts use invented payloads. Separate oracle checks cover 120 seeded graph cases and repairs. The HTTP/D1 smoke passed 107 assertions on both the development server and the built Worker, with fixture rankings. Public-host integration, a genuine Qloo run and a reader pilot remain separate evidence requirements. The [verification record](VERIFICATION.md) keeps these results distinct.

A useful pilot would ask a consenting small group to supply books and interests, review Qloo's suggestions, record actual reading choices and attempt the approved handoff. Measure how many suggestions readers accept, how many want-list decisions they make and whether the agreed exchanges happen. Do not turn the sample's counts into predicted improvement.
