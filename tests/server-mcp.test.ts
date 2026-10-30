import test from "node:test";
import assert from "node:assert/strict";
import { ExchangeAgent } from "../lib/agent/ExchangeAgent";
import { AppError } from "../lib/domain/errors";
import { DemoFactory } from "../lib/demo/DemoFactory";
import { FixtureTasteProvider } from "../lib/demo/FixtureTasteProvider";
import { RequestLimiter } from "../lib/server/HttpBoundary";
import { McpServer } from "../lib/server/McpServer";

const ORIGIN = "https://swapcircle.example";
const TOKEN = "c".repeat(64);
interface ToolDescription { name: string; annotations: { readOnlyHint: boolean; destructiveHint: boolean } }
interface MatchResult {
  structuredContent: {
    evidence: { source: string } | null; readingChoice: string; interpretation: string; evidenceStatus: string;
  };
}
async function reply<T = never>(response: Response): Promise<{ result: T; error: { code: number } }> {
  return await response.json() as { result: T; error: { code: number } };
}
function request(body: unknown, token?: string, extra: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/mcp`, { method: "POST", headers: {
    "Content-Type": "application/json", Accept: "application/json, text/event-stream",
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra,
  }, body: JSON.stringify(body) });
}
async function setup() {
  const room = await new ExchangeAgent(new FixtureTasteProvider()).rank(DemoFactory.create());
  let reads = 0;
  const server = new McpServer({ async read(id, token) {
    reads += 1;
    if (token !== TOKEN || id !== room.id) throw new AppError("Private circle.", 401, "unauthorized");
    return { room, role: { kind: "member", memberId: "maya" } };
  } }, new RequestLimiter({ async consumeLimit() {} }));
  return { server, room, reads: () => reads };
}

test("MCP negotiates a supported version and advertises only read-only tools", async () => {
  const { server } = await setup();
  const response = await server.post(request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
    protocolVersion: "2030-01-01", capabilities: {}, clientInfo: { name: "test", version: "1" },
  } }));
  assert.equal(response.status, 200);
  assert.equal((await reply<{ protocolVersion: string }>(response)).result.protocolVersion, "2025-11-25");
  const listing = await server.post(request({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
  const { result } = await reply<{ tools: ToolDescription[] }>(listing);
  assert.deepEqual(result.tools.map((tool) => tool.name), ["inspect_circle", "suggest_next_question", "explain_match", "plan_exchanges"]);
  assert.ok(result.tools.every((tool) => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
});

test("tool calls require the private capability and cannot use it for a different circle", async () => {
  const { server, room, reads } = await setup();
  const call = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "inspect_circle", arguments: { roomId: room.id } } };
  assert.equal((await server.post(request(call))).status, 401);
  assert.equal(reads(), 0);
  assert.equal((await server.post(request({ ...call, params: { ...call.params, arguments: { roomId: crypto.randomUUID() } } }, TOKEN))).status, 401);
  const result = await reply<{ structuredContent: { circle: { id: string }; mode: string } }>(await server.post(request(call, TOKEN)));
  assert.equal(result.result.structuredContent.circle.id, room.id);
  assert.equal(result.result.structuredContent.mode, "demo");
  assert.ok(!JSON.stringify(result).includes(TOKEN));
});

test("planning and question tools never persist events, choices or approvals", async () => {
  const { server, room } = await setup();
  const before = JSON.stringify(room);
  for (const name of ["plan_exchanges", "suggest_next_question"]) {
    const response = await server.post(request({ jsonrpc: "2.0", id: name, method: "tools/call", params: { name, arguments: { roomId: room.id } } }, TOKEN));
    const result = (await reply<{ isError: boolean; structuredContent: { readOnly: boolean } }>(response)).result;
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.readOnly, true);
    assert.equal(JSON.stringify(room), before);
  }
  const forbidden = await server.post(request({ jsonrpc: "2.0", id: 7, method: "tools/call", params: {
    name: "approve_exchange", arguments: { roomId: room.id, memberId: "maya" },
  } }, TOKEN));
  assert.equal((await reply(forbidden)).error.code, -32602);
  assert.equal(JSON.stringify(room), before);
});

test("match explanation distinguishes fixture ranking and unknown evidence from consent", async () => {
  const { server, room } = await setup();
  const call = (bookId: string) => request({ jsonrpc: "2.0", id: 8, method: "tools/call", params: {
    name: "explain_match", arguments: { roomId: room.id, memberId: "maya", bookId },
  } }, TOKEN);
  const known = (await reply<MatchResult>(await server.post(call("book-leo")))).result.structuredContent;
  assert.ok(known.evidence);
  assert.equal(known.evidence.source, "fixture");
  assert.equal(known.readingChoice, "yes");
  assert.match(known.interpretation, /not a prediction/);
  room.rankings = [];
  const unknown = (await reply<MatchResult>(await server.post(call("book-leo")))).result.structuredContent;
  assert.equal(unknown.evidenceStatus, "unknown");
  assert.equal(unknown.evidence, null);
  assert.equal(unknown.readingChoice, "yes");
});

test("notifications are acknowledged without a body or room read; SSE GET is unsupported", async () => {
  const { server, reads } = await setup();
  const response = await server.post(request({ jsonrpc: "2.0", method: "notifications/initialized" }));
  assert.equal(response.status, 202);
  assert.equal(await response.text(), "");
  assert.equal(reads(), 0);
  const get = server.get(new Request(`${ORIGIN}/api/mcp`, { headers: { Accept: "text/event-stream" } }));
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");
});

test("MCP rejects cross-origin requests, unsupported versions and malformed envelopes", async () => {
  const { server } = await setup();
  const ping = { jsonrpc: "2.0", id: 1, method: "ping" };
  assert.equal((await server.post(request(ping, undefined, { Origin: "https://another.example" }))).status, 403);
  assert.equal((await server.post(request(ping, undefined, { "MCP-Protocol-Version": "1900-01-01" }))).status, 400);
  assert.equal((await server.post(request(ping, undefined, { Accept: "application/json" }))).status, 406);
  assert.equal((await reply(await server.post(request([ping])))).error.code, -32600);
  const malformed = new Request(`${ORIGIN}/api/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: "{" });
  assert.equal((await reply(await server.post(malformed))).error.code, -32700);
});
