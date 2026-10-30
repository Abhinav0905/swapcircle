import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../lib/domain/errors";
import type { CreatedRoom, RoomSession } from "../lib/domain/types";
import { DemoFactory } from "../lib/demo/DemoFactory";
import { ApiHandlers, type RoomOperations } from "../lib/server/ApiHandlers";
import { bearerToken, readLimitedJson, RequestLimiter, type LimitStore } from "../lib/server/HttpBoundary";
import { readRuntimeConfiguration } from "../lib/server/RuntimeConfiguration";

const ORIGIN = "https://swapcircle.example";
const TOKEN = "a".repeat(64);
class RecordingLimits implements LimitStore {
  calls: string[] = [];
  blocked = false;
  async consumeLimit(key: string): Promise<void> {
    this.calls.push(key);
    if (this.blocked) throw new AppError("Try again shortly.", 429, "rate_limited");
  }
}
function setup(configured = false) {
  const room = DemoFactory.create();
  const session: RoomSession = { room, role: { kind: "host" } };
  const counts = { create: 0, read: 0, act: 0, remove: 0, search: 0 };
  const limits = new RecordingLimits();
  const rooms: RoomOperations = {
    async create() { counts.create += 1; return { ...session, hostToken: TOKEN, memberTokens: {} } as CreatedRoom; },
    async read(_id, token) { counts.read += 1; if (token !== TOKEN) throw new AppError("Private circle.", 401, "unauthorized"); return session; },
    async act() { counts.act += 1; return session; },
    async remove() { counts.remove += 1; },
  };
  const api = new ApiHandlers({ rooms, limiter: new RequestLimiter(limits), qlooConfigured: configured,
    async search() { counts.search += 1; return Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: `Book ${i}`, type: "book" as const })); },
  });
  return { api, room, session, counts, limits, rooms };
}
function request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}

test("anonymous room reads are rejected before storage; URL tokens do not authenticate", async () => {
  const { api, room, counts } = setup();
  const response = await api.read(request(`/api/rooms/${room.id}?token=${TOKEN}`), room.id);
  assert.equal(response.status, 401);
  assert.equal(counts.read, 0);
  assert.throws(() => bearerToken(request("/", "GET", undefined, { Authorization: "Basic secret" })), /private invitation/);
});

test("foreign origins cannot create circles or make authenticated writes", async () => {
  const { api, room, counts } = setup();
  const headers = { Origin: "https://another.example", Authorization: `Bearer ${TOKEN}` };
  const created = await api.create(request("/api/rooms", "POST", { mode: "demo" }, headers));
  const changed = await api.act(request(`/api/rooms/${room.id}`, "POST", { revision: 0, action: { type: "plan" } }, headers), room.id);
  assert.equal(created.status, 403);
  assert.equal(changed.status, 403);
  assert.equal(counts.create + counts.act, 0);
});

test("demo creation works without credentials and returns private noncached capability response", async () => {
  const { api, counts } = setup();
  const response = await api.create(request("/api/rooms", "POST", { mode: "demo" }));
  assert.equal(response.status, 201);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const created = await response.json() as CreatedRoom;
  assert.equal(created.room.mode, "demo");
  assert.equal(created.role.kind, "host");
  assert.equal(created.hostToken, TOKEN);
  assert.equal(counts.search, 0);
});

test("missing Qloo configuration never converts a live search to fixture success", async () => {
  const { api, counts } = setup();
  const response = await api.search(request("/api/search?q=Arrival&type=movie"));
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "qloo_not_configured");
  assert.equal(counts.search, 0);
  assert.deepEqual(await api.status().json(), { qlooConfigured: false });
});

test("search input and provider budgets are checked before a request and results are bounded", async () => {
  const { api, limits, counts } = setup(true);
  assert.equal((await api.search(request("/api/search?q=x&type=book"))).status, 400);
  assert.equal((await api.search(request("/api/search?q=Arrival&type=secret"))).status, 400);
  assert.equal(counts.search, 0);
  const response = await api.search(request("/api/search?q=Arrival&type=movie", "GET", undefined, { "cf-connecting-ip": "192.0.2.18" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { entities: unknown[] }).entities.length, 8);
  assert.equal(counts.search, 1);
  assert.ok(limits.calls.every((key) => !key.includes("192.0.2.18")));
  limits.blocked = true;
  const blocked = await api.search(request("/api/search?q=Arrival&type=movie"));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "60");
  assert.equal(counts.search, 1);
});

test("unknown action fields cannot reach the mutation service", async () => {
  const { api, room, counts } = setup();
  const response = await api.act(request(`/api/rooms/${room.id}`, "POST", {
    revision: 0, action: { type: "approve", memberId: "maya", fingerprint: "cycle", asHost: true },
  }, { Authorization: `Bearer ${TOKEN}` }), room.id);
  assert.equal(response.status, 400);
  assert.equal(counts.act, 0);
});

test("unexpected storage errors never leak request data or internal text", async () => {
  const { api, room, rooms } = setup();
  rooms.read = async () => { throw new Error(`Database error with secret ${TOKEN}`); };
  const response = await api.read(request(`/api/rooms/${room.id}`, "GET", undefined, { Authorization: `Bearer ${TOKEN}` }), room.id);
  assert.equal(response.status, 500);
  const text = await response.text();
  assert.ok(!text.includes(TOKEN));
  assert.ok(!text.includes("Database"));
});

test("streaming body limits count bytes even without Content-Length", async () => {
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode('"' + "é".repeat(30_000) + '"'));
    controller.close();
  } });
  const input = new Request(`${ORIGIN}/api/rooms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" } as RequestInit & { duplex: string });
  await assert.rejects(readLimitedJson(input), (error: unknown) => error instanceof AppError && error.status === 413);
  await assert.rejects(readLimitedJson(new Request(`${ORIGIN}/`, { method: "POST", body: "{}" })), (error: unknown) => error instanceof AppError && error.status === 415);
});

test("Worker secrets take precedence and production does not fall back to process credentials", () => {
  const worker = readRuntimeConfiguration({ QLOO_API_KEY: "worker-key" }, { QLOO_API_KEY: "local-key", NODE_ENV: "development" });
  assert.equal(worker.apiKey, "worker-key");
  assert.equal(worker.qlooConfigured, true);
  const production = readRuntimeConfiguration({}, { QLOO_API_KEY: "local-key", NODE_ENV: "production" });
  assert.equal(production.qlooConfigured, false);
  assert.equal(production.apiKey, "");
  assert.equal(readRuntimeConfiguration({ QLOO_API_KEY: "key", QLOO_BASE_URL: "https://attacker.example" }).qlooConfigured, false);
});
