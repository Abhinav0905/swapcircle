# Verification record

Checkpoint: October 30, 2026. Local, hosted and GitHub Actions results are recorded separately. The hosted app and MIT-licensed repository are public; anonymous access was verified on October 30 at 5:24 p.m. Pacific.

| Check | Recorded result | What it establishes |
| --- | --- | --- |
| TypeScript and production build | Passed | The current source type-checks and produces the Worker build. |
| Automated tests | 88 passed | Provider contracts, exchange rules, access checks, revisions and HTTP/MCP behavior under the test inputs. |
| Independent solver comparison | 120 seeded graphs and their repairs, within the test suite | Agreement with a separate subset-and-permutation oracle on those bounded cases. |
| Development-server HTTP/D1 smoke | 107 assertions passed | Actual local routes and D1 state, member capabilities, concurrent revision rejection, exact approvals, withdrawal, repair, MCP previews and room cleanup. |
| Built-Worker HTTP/D1 smoke | 107 assertions passed at `http://127.0.0.1:4177` | The same workflow passes against the built production Worker and local D1. This is a local result. |
| Hosted HTTP/D1 smoke | 107 assertions passed | Actual deployed Worker and Cloudflare D1. Passed first through the private gate, then again anonymously after public release. Fixture data only; no Qloo call. |
| GitHub Actions | [Run 41153316548 passed](https://github.com/Abhinav0905/swapcircle/actions/runs/41153316548) on commit `de60dcb` | Node 22, locked install, 88 tests, build, fresh D1 migration and 107 HTTP assertions. |
| Early-rejection regression | [All eight cases passed](https://github.com/Abhinav0905/swapcircle/actions/runs/41153162651) | Each ranking request ran once and persisted revision 1. All eight disposable rooms were deleted. |
| Public access | Verified | Anonymous homepage and GitHub repository requests returned HTTP 200. GitHub reports public visibility and MIT licensing. |
| Live Qloo | Pending | A configured key and mocked contracts do not establish provider access or ranking quality. |
| Reader pilot or physical exchange | Not performed | No adoption, satisfaction, completed handoff or environmental benefit has been measured. |

Run local type checking, tests and the build with:

```sh
npm run verify
```

With the development server running and its local migration applied:

```sh
npm run smoke -- http://127.0.0.1:5173
```

The smoke creates two disposable sample rooms. It checks the authored **2 → 6 → 2 → 5** allocation, uses distinct capabilities for member actions and removes both rooms afterward. Capabilities stay in memory. All taste evidence is fixture data, and the script makes no live Qloo request.

The reported 107 assertions include the missing-key checks. If a target has Qloo configured, the script skips those two checks and states that fact. Neither configuration state turns this smoke into a live-provider test.

The [CI workflow](../.github/workflows/verify.yml) uses Node 22, the public npm registry and the checked-in lockfile. It runs `verify`, applies the migration to a fresh local D1 database, starts the built Worker and runs the same smoke. It has read-only repository permissions, receives no Qloo key and does not deploy.

CI investigation found a request-body problem after early rejection. The [before-fix probe](https://github.com/Abhinav0905/swapcircle/actions/runs/41152261725) lost six of eight ranking requests; every failed request left the room at revision 0. Proxy diagnostics recorded connection loss with the same upstream and no reload. Longer readiness checks and `Connection: close` did not fix it.

The prebuilt Worker bypassed Wrangler's usual body-draining middleware, and Vinext could reject a foreign Origin before reading the request body. This matches [workers-sdk issue 15203](https://github.com/cloudflare/workers-sdk/issues/15203). `RequestBodyBoundary` now consumes bounded API input before framework dispatch. The [same probe after the fix](https://github.com/Abhinav0905/swapcircle/actions/runs/41153162651) passed all eight cases, followed by the normal CI workflow with unmodified Wrangler. Ten focused tests cover consumption before rejection, byte limits, deadlines, stalled cancellation, metadata and subsequent requests.

Temporary dependency instrumentation has been removed. The optional manual probe and sanitized failure diagnostics remain. The smoke requires three consecutive healthy GET responses before writing; mutation requests are never retried.

The optional `scripts/live-qloo-check.mjs` has passed syntax checking and correctly refused to verify the unconfigured hosted app. Its real search/ranking path remains pending an issued key. A successful run uses synthetic reader inputs, removes its disposable room and writes credential-free evidence under ignored `outputs/`.
