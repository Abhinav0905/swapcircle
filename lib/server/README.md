# HTTP and agent tools

`RuntimeServices` wires the D1 repository, capability service, room service and taste providers together. Worker environment values `QLOO_API_KEY` and `QLOO_BASE_URL` take precedence. Process environment fallback is allowed only outside production. Keys never enter an HTTP response. `qlooConfigured` reports valid local configuration, not a successful provider test.

`ApiHandlers` handles JSON, limits and HTTP errors. `RoomService` remains responsible for authorization, exact revisions and state changes. A provider failure stays an error; the fixture provider is selected only for a room created with `mode: "demo"`.

| Route | Access and result |
| --- | --- |
| `GET /api/status` | Public. Returns `{qlooConfigured: boolean}`. |
| `POST /api/rooms` | Public, rate-limited. Accepts the shared create schema. Returns `CreatedRoom` with host and member capabilities once. |
| `GET /api/rooms/:id` | Requires `Authorization: Bearer <capability>`. Returns `RoomSession`. |
| `POST /api/rooms/:id` | Same capability, plus `{revision, action}`. The service checks the role and stale revisions. |
| `DELETE /api/rooms/:id` | Requires the host capability. Returns `{deleted: true}`. |
| `GET /api/search?q=Arrival&type=movie` | Public, bounded and rate-limited. Real Qloo only. Returns `{entities: [...]}` with at most eight choices. |
| `POST /api/mcp` | Stateless MCP JSON-RPC. Discovery is public; every tool call requires a room capability. |
| `GET /api/mcp` | Returns 405 because the server does not offer an SSE stream. |

Private responses carry `Cache-Control: no-store, private` and `Referrer-Policy: no-referrer`. Capabilities are accepted only in the authorization header, never in query parameters. JSON streams are limited to 48,000 bytes. Browser requests with a foreign Origin are rejected. D1 fixed-window counters bound circle creation, search, live ranking and other requests; per-client keys contain an IP digest rather than the address.

Expected failures use `{error: {code, message}}`. Application, domain and Qloo errors have user-safe messages. Unexpected exceptions become a generic server error. Request bodies, stack traces, upstream responses and keys are never echoed.

## MCP contract

The transport follows the [Streamable HTTP specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports). It supports `2025-11-25`, `2025-06-18` and `2025-03-26`, returns JSON responses, acknowledges notifications with an empty 202, and does not create a transport session. Clients send `Accept: application/json, text/event-stream` and, after initialization, the negotiated `MCP-Protocol-Version` header.

Supported methods: `initialize`, `ping`, `tools/list` and `tools/call`. All four tools declare `readOnlyHint: true`:

- `inspect_circle({roomId})` reads the authenticated room.
- `suggest_next_question({roomId})` previews a useful unanswered reading question.
- `explain_match({roomId, memberId, bookId})` separates provider evidence from a member's recorded choice.
- `plan_exchanges({roomId})` previews an exchange plan without saving it.

Tool calls receive their capability through the HTTP authorization header. There is no approval, withdrawal, sending, ranking-refresh or other mutation tool. Planning uses stored evidence and a provider that rejects network calls. The preview cannot persist events or grant consent. A tool execution failure returns `isError: true`; invalid methods and tool names use JSON-RPC errors. Authentication failures use HTTP 401/403.

Example request body, after initialization and with the private authorization header set in the client:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "plan_exchanges",
    "arguments": { "roomId": "00000000-0000-4000-8000-000000000000" }
  }
}
```

The example UUID is a placeholder. Actual room IDs come from circle creation.

## Verification

`tsx --test tests/server-http.test.ts tests/server-mcp.test.ts` exercises the injectable handlers without a Worker or real Qloo key. These tests cover authorization boundaries, cross-origin rejection, byte limits, missing-key behavior, response sanitization, provider budgets and the read-only MCP contract. They do not establish deployed D1 behavior or live Qloo access; those require separate integration checks.

`node scripts/smoke.mjs http://127.0.0.1:5173` checks the running HTTP routes and their actual D1 state. It creates two disposable demo circles, exercises separate participant capabilities, ranks fixture data, tests a concurrent revision race, follows the bridge/approval/withdrawal/repair flow, calls all four MCP tools and removes the circles. It retains capabilities only in memory and makes no live Qloo requests. If Qloo is unconfigured, it also verifies the live search and creation endpoints return 503. The same script accepts a deployed public origin for a separate hosting check.
