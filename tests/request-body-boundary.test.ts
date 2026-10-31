import test from "node:test";
import assert from "node:assert/strict";
import { RequestBodyBoundary } from "../lib/server/RequestBodyBoundary";

const origin = "https://swapcircle.example";
const encode = (value: string) => new TextEncoder().encode(value);
function streamingRequest(body: ReadableStream<Uint8Array>, headers: Record<string, string> = {}): Request {
  return new Request(`${origin}/api/rooms`, { method: "POST", headers, body, duplex: "half" } as RequestInit & { duplex: string });
}

test("an early origin rejection occurs only after the original input reaches EOF", async () => {
  let ended = false;
  let chunk = 0;
  const body = new ReadableStream<Uint8Array>({ pull(controller) {
    const parts = ['{"mode":', '"demo"}'];
    if (chunk < parts.length) controller.enqueue(encode(parts[chunk++]));
    else { ended = true; controller.close(); }
  } });
  const original = streamingRequest(body, { Origin: "https://another.example", "Content-Type": "application/json", Authorization: "Bearer opaque-test-value" });
  let calls = 0;
  const response = await new RequestBodyBoundary().handle(original, async (buffered) => {
    calls += 1;
    assert.equal(ended, true);
    assert.equal(original.bodyUsed, true);
    assert.equal(original.body!.locked, false);
    assert.notEqual(buffered, original);
    assert.equal(buffered.url, original.url);
    assert.equal(buffered.method, "POST");
    assert.equal(buffered.headers.get("origin"), "https://another.example");
    assert.equal(buffered.headers.get("authorization"), "Bearer opaque-test-value");
    assert.deepEqual(await buffered.json(), { mode: "demo" });
    return new Response("Forbidden", { status: 403 });
  });
  assert.equal(calls, 1);
  assert.equal(response.status, 403);
});

test("valid binary input, headers and abort signal reach the handler unchanged", async () => {
  const controller = new AbortController();
  const bytes = Uint8Array.from([0, 128, 255, 13, 10]);
  const request = new Request(`${origin}/api/mcp`, { method: "POST", body: bytes,
    headers: { "Content-Type": "application/octet-stream", "X-Test": "retained" }, signal: controller.signal });
  const response = await new RequestBodyBoundary().handle(request, async (buffered) => {
    assert.equal(buffered.headers.get("x-test"), "retained");
    assert.deepEqual(new Uint8Array(await buffered.arrayBuffer()), bytes);
    controller.abort();
    assert.equal(buffered.signal.aborted, true);
    return new Response(null, { status: 204 });
  });
  assert.equal(response.status, 204);
});

test("bodyless API requests and non-API requests retain their original Request", async () => {
  for (const request of [new Request(`${origin}/api/status`), new Request(`${origin}/apiary`, { method: "POST", body: "unchanged" })]) {
    await new RequestBodyBoundary().handle(request, (forwarded) => {
      assert.equal(forwarded, request);
      assert.equal(request.bodyUsed, false);
      return new Response("ok");
    });
  }
});

test("actual byte limits reject a lying Content-Length and cancellation cannot hang", { timeout: 1_000 }, async () => {
  let canceled = 0;
  let calls = 0;
  const request = streamingRequest(new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(encode("123456")); },
    cancel() { canceled += 1; return new Promise<void>(() => {}); },
  }), { "Content-Length": "1" });
  const response = await new RequestBodyBoundary(8).handle(request, () => { calls += 1; return new Response("bad"); });
  assert.equal(response.status, 413);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "request_too_large");
  assert.equal(canceled, 1);
  assert.equal(calls, 0);
  assert.equal(request.body!.locked, false);
});

test("the byte cap accepts its exact boundary and counts UTF-8 bytes", async () => {
  const boundary = new RequestBodyBoundary(8);
  let calls = 0;
  for (const [text, status] of [["éééé", 200], ["ééééx", 413]] as const) {
    const request = new Request(`${origin}/api/rooms`, { method: "POST", body: text });
    const response = await boundary.handle(request, async (buffered) => {
      calls += 1;
      assert.equal(await buffered.text(), text);
      return new Response("ok");
    });
    assert.equal(response.status, status);
  }
  assert.equal(calls, 1);
});

test("a stalled upload times out even when cancellation never settles", { timeout: 1_000 }, async () => {
  let canceled = false;
  let calls = 0;
  const request = streamingRequest(new ReadableStream<Uint8Array>({
    pull() { return new Promise<void>(() => {}); },
    cancel() { canceled = true; return new Promise<void>(() => {}); },
  }));
  const response = await new RequestBodyBoundary(48_000, 20).handle(request, () => { calls += 1; return new Response("bad"); });
  assert.equal(response.status, 408);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "request_timeout");
  assert.equal(canceled, true);
  assert.equal(calls, 0);
  assert.equal(request.body!.locked, false);
});

test("body progress does not reset the total read deadline", { timeout: 1_000 }, async (context) => {
  let interval: ReturnType<typeof setInterval>;
  let canceled = false;
  context.after(() => clearInterval(interval));
  const request = streamingRequest(new ReadableStream<Uint8Array>({
    start(controller) { interval = setInterval(() => controller.enqueue(encode("x")), 5); },
    cancel() { canceled = true; clearInterval(interval); },
  }));
  const response = await new RequestBodyBoundary(48_000, 25).handle(request, () => new Response("bad"));
  assert.equal(response.status, 408);
  assert.equal(canceled, true);
});

test("input stream errors are private and never reach the handler", async () => {
  const secret = "private transport detail";
  const request = streamingRequest(new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error(secret)); } }));
  let calls = 0;
  const response = await new RequestBodyBoundary().handle(request, () => { calls += 1; return new Response("bad"); });
  assert.equal(response.status, 400);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.ok(!(await response.text()).includes(secret));
  assert.equal(calls, 0);
});

test("a rejected request cannot retain body state or cancel the next request", async () => {
  const boundary = new RequestBodyBoundary(8);
  const rejected = await boundary.handle(new Request(`${origin}/api/rooms`, { method: "POST", body: "too many bytes" }), () => new Response("bad"));
  assert.equal(rejected.status, 413);
  let calls = 0;
  const accepted = await boundary.handle(new Request(`${origin}/api/rooms`, { method: "POST", body: "{}" }), async (request) => {
    calls += 1;
    assert.equal(await request.text(), "{}");
    return new Response("created", { status: 201 });
  });
  assert.equal(accepted.status, 201);
  assert.equal(calls, 1);
});

test("handler failures are propagated without dispatch retries", async () => {
  const failure = new Error("framework failure");
  let calls = 0;
  await assert.rejects(new RequestBodyBoundary().handle(new Request(`${origin}/api/rooms`, { method: "POST", body: "{}" }), () => {
    calls += 1;
    throw failure;
  }), (error) => error === failure);
  assert.equal(calls, 1);
});
