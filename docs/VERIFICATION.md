# Verification record

Checkpoint: October 30, 2026. These results refer to the local build session. A prepared workflow is not a completed GitHub Actions run.

| Check | Recorded result | What it establishes |
| --- | --- | --- |
| TypeScript and production build | Passed | The current source type-checks and produces the Worker build. |
| Automated tests | 78 passed | Provider contracts, exchange rules, access checks, revisions and HTTP/MCP behavior under the test inputs. |
| Independent solver comparison | 120 seeded graphs and their repairs, within the test suite | Agreement with a separate subset-and-permutation oracle on those bounded cases. |
| Development-server HTTP/D1 smoke | 107 assertions passed | Actual local routes and D1 state, member capabilities, concurrent revision rejection, exact approvals, withdrawal, repair, MCP previews and room cleanup. |
| Built-Worker HTTP/D1 smoke | 107 assertions passed at `http://127.0.0.1:4177` | The same workflow passes against the built production Worker and local D1. This is a local result. |
| GitHub Actions | Workflow prepared; no run recorded | No remote CI success is claimed. |
| Public deployment and repository | Pending | No anonymous public demo or published source URL is claimed yet. |
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
