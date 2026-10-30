import assert from "node:assert/strict";
import test from "node:test";
import type { BookOffer, Member } from "../lib/domain/types";
import { QlooClient, QlooError } from "../lib/qloo/index";

// Invented identities and responses exercise contracts, not real Qloo behavior.
const IDS = {
  seed: "11111111-1111-4111-8111-111111111111",
  self: "22222222-2222-4222-8222-222222222222",
  first: "33333333-3333-4333-8333-333333333333",
  second: "44444444-4444-4444-8444-444444444444",
  absent: "55555555-5555-4555-8555-555555555555",
  unrelated: "66666666-6666-4666-8666-666666666666",
};
const SECRET = "test-key-never-public";
const makeOffer = (id: string, ownerId: string, entityId: string, available = true): BookOffer => ({
  id, ownerId, entityId, title: `Invented book ${id}`, author: "Test Author", condition: "Test copy", color: "#123456", available,
});
const member = (): Member => ({
  id: "reader-a", name: "Test reader", color: "#123456", active: true,
  seeds: [{ id: IDS.seed, name: "Invented favorite", type: "movie" }],
  offer: makeOffer("self", "reader-a", IDS.self),
});
const entity = (id: string, affinity?: unknown, extra: Record<string, unknown> = {}) => ({
  entity_id: id, name: "Invented title", type: "urn:entity", subtype: "urn:entity:book",
  query: { ...(affinity === undefined ? {} : { affinity }) }, ...extra,
});
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", ...headers } });

function fakeFetch(fn: (url: URL, init: RequestInit) => Promise<Response> | Response): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? new URL(input.url) : new URL(String(input));
    return fn(url, init ?? {});
  }) as typeof fetch;
}

test("search uses the typed official GET contract and returns choices without auto-selection", async () => {
  let calls = 0;
  const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch((url, init) => {
    calls += 1;
    assert.equal(url.origin, "https://hackathon.api.qloo.com");
    assert.equal(url.pathname, "/search");
    assert.equal(url.searchParams.get("query"), "Two interpretations");
    assert.equal(url.searchParams.get("types"), "urn:entity:book");
    assert.equal(url.searchParams.get("take"), "8");
    assert.equal(init.method, "GET");
    assert.equal(new Headers(init.headers).get("X-Api-Key"), SECRET);
    assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit");
    assert.ok(!String(url).includes(SECRET));
    return json({ success: true, results: [
      entity(IDS.first, 0.8, { name: "One interpretation", disambiguation: "Test author, 1990" }),
      entity(IDS.second, 0.7, { name: "Another interpretation" }),
      entity(IDS.first, 0.8),
      entity(IDS.unrelated, 0.9, { subtype: "urn:entity:movie" }),
      entity("not-a-qloo-uuid", 0.7),
    ] });
  }) });
  const choices = await client.search(" Two interpretations ", "book");
  assert.equal(calls, 1);
  assert.equal(choices.length, 2);
  assert.equal(choices[0].subtitle, "Test author, 1990");
  assert.deepEqual(choices.map((choice) => choice.id), [IDS.first, IDS.second]);
  assert.ok(!JSON.stringify(client).includes(SECRET));
});

test("search supports the live typed type field and treats a documented 404 as no matches", async () => {
  const typed = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => json({ success: true, results: [
    { entity_id: IDS.seed, name: "Invented movie", type: "urn:entity:movie" },
  ] })) });
  assert.equal((await typed.search("Invented", "movie"))[0].type, "movie");
  const absent = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => new Response("not returned to user", { status: 404 })) });
  assert.deepEqual(await absent.search("Missing title", "book"), []);
});

test("rank sends only other available books, preserves Qloo order and maps duplicate physical copies", async () => {
  const reader = member();
  const offers = [reader.offer, makeOffer("copy-b", "reader-b", IDS.first), makeOffer("copy-c", "reader-c", IDS.second),
    makeOffer("copy-d", "reader-d", IDS.first.toLowerCase()), makeOffer("withdrawn", "reader-e", IDS.absent, false)];
  const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch((url) => {
    assert.equal(url.pathname, "/v2/insights");
    assert.equal(url.searchParams.get("filter.type"), "urn:entity:book");
    assert.equal(url.searchParams.get("signal.interests.entities"), IDS.seed);
    assert.equal(url.searchParams.get("filter.results.entities"), [IDS.first, IDS.second].join(","));
    assert.equal(url.searchParams.get("feature.explainability"), "true");
    assert.equal(url.searchParams.get("take"), "2");
    // Order is authoritative; the client must not normalize or sort raw scores.
    return json({ success: true, results: { entities: [entity(IDS.first, 0.2), entity(IDS.second, 0.9)] } });
  }) });
  const evidence = await client.rank(reader, offers);
  assert.equal(evidence.source, "qloo");
  assert.deepEqual(evidence.requestedBookIds, ["copy-b", "copy-c", "copy-d"]);
  assert.deepEqual(evidence.entries.map((row) => [row.bookId, row.rank, row.providerScore]), [
    ["copy-b", 1, 0.2], ["copy-d", 1, 0.2], ["copy-c", 2, 0.9],
  ]);
  assert.deepEqual(evidence.missingBookIds, []);
  assert.ok(!JSON.stringify(evidence).includes(SECRET));
});

test("unknown identities never create entries and missing results remain unknown", async () => {
  const reader = member();
  const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => json({ success: true, results: { entities: [
    entity(IDS.unrelated, 0.99), entity(IDS.first, 0.81), entity(IDS.first, 0.01),
    entity(IDS.second, 0.9, { subtype: "urn:entity:movie" }),
  ] } })) });
  const evidence = await client.rank(reader, [
    makeOffer("first", "reader-b", IDS.first), makeOffer("second", "reader-c", IDS.second), makeOffer("missing", "reader-d", IDS.absent),
  ]);
  assert.deepEqual(evidence.entries.map((row) => [row.bookId, row.rank, row.providerScore]), [["first", 1, 0.81]]);
  assert.deepEqual(evidence.missingBookIds, ["second", "missing"]);
  assert.ok(evidence.warnings.some((warning) => warning.includes("outside")));
  assert.ok(evidence.warnings.some((warning) => warning.includes("duplicate")));
  assert.ok(evidence.warnings.some((warning) => warning.includes("unknown, not dislike")));
});

test("missing affinity is null and undocumented explanation structures do not become invented reasons", async () => {
  const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => json({
    success: true,
    query: { explainability: { warning: `Cannot explain ${SECRET}` } },
    warnings: ["Partial evidence"],
    results: { entities: [entity(IDS.first, undefined, { query: {
      explainability: { sources: [{ entity_id: IDS.seed, contribution: 0.9 }] },
    } })] },
  })) });
  const evidence = await client.rank(member(), [makeOffer("first", "reader-b", IDS.first)]);
  assert.equal(evidence.entries[0].providerScore, null);
  assert.equal(evidence.entries[0].explanation, null);
  assert.ok(evidence.warnings.some((warning) => warning.includes("Partial evidence")));
  assert.ok(evidence.warnings.some((warning) => warning.includes("[redacted]")));
  assert.ok(!JSON.stringify(evidence).includes(SECRET));
});

test("empty candidate lists do not make an unfiltered upstream request", async () => {
  let called = false;
  const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => { called = true; throw new Error("must not call"); }) });
  const reader = member();
  const evidence = await client.rank(reader, [reader.offer, makeOffer("withdrawn", "reader-b", IDS.first, false)]);
  assert.equal(called, false);
  assert.deepEqual(evidence.entries, []);
  assert.deepEqual(evidence.requestedBookIds, []);
  assert.ok(evidence.warnings[0].includes("No Qloo request was made"));
});

test("malformed envelopes fail visibly with no fixture fallback or body exposure", async () => {
  for (const payload of [null, { success: false, error: SECRET }, { success: true, results: { wrong: SECRET } }]) {
    const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => json(payload)) });
    await assert.rejects(client.rank(member(), [makeOffer("first", "reader-b", IDS.first)]), (error: unknown) => {
      assert.ok(error instanceof QlooError);
      assert.equal(error.code, "qloo_invalid_response");
      assert.ok(!error.message.includes(SECRET));
      return true;
    });
  }
});

test("foreign origins, paths, HTTP, credentials and missing keys are rejected before fetch", () => {
  for (const baseUrl of ["https://example.com", "http://hackathon.api.qloo.com", "https://api.qloo.com.evil.example", "https://api.qloo.com/path", "https://user@api.qloo.com", "https://api.qloo.com/?next=evil", "https://api.qloo.com:8443"]) {
    assert.throws(() => new QlooClient({ apiKey: SECRET, baseUrl }), QlooError);
  }
  assert.throws(() => new QlooClient({ apiKey: "" }), QlooError);
  assert.throws(() => new QlooClient({ apiKey: "key\nHeader: nope" }), QlooError);
  assert.doesNotThrow(() => new QlooClient({ apiKey: SECRET, baseUrl: "https://api.qloo.com/" }));
});

test("401 is not retried and its raw error body is discarded", async () => {
  let calls = 0;
  const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => { calls += 1; return new Response(SECRET, { status: 401 }); }) });
  await assert.rejects(client.search("Test", "book"), (error: unknown) => {
    assert.ok(error instanceof QlooError);
    assert.equal(error.code, "qloo_auth");
    assert.ok(!error.message.includes(SECRET));
    return true;
  });
  assert.equal(calls, 1);
});

test("429 and 5xx retry once, preserving the typed request", async () => {
  for (const status of [429, 503]) {
    let calls = 0;
    const urls: string[] = [];
    const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch((url) => {
      calls += 1;
      urls.push(String(url));
      return calls === 1 ? new Response(SECRET, { status, headers: { "retry-after": "0" } }) : json({ success: true, results: [] });
    }) });
    assert.deepEqual(await client.search("Test", "book"), []);
    assert.equal(calls, 2);
    assert.equal(urls[0], urls[1]);
  }
});

test("repeat rate limits stop after two requests instead of looping", async () => {
  let calls = 0;
  const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => {
    calls += 1;
    return new Response(SECRET, { status: 429, headers: { "retry-after": "0" } });
  }) });
  await assert.rejects(client.search("Test", "book"), (error: unknown) => error instanceof QlooError && error.code === "qloo_rate_limit");
  assert.equal(calls, 2);
});

test("timeouts abort transport even if an injected fetch ignores its signal", async () => {
  let signal: AbortSignal | null | undefined;
  const client = new QlooClient({ apiKey: SECRET, timeoutMs: 15, fetch: fakeFetch((_url, init) => {
    signal = init.signal;
    return new Promise<Response>(() => undefined);
  }) });
  await assert.rejects(client.search("Test", "book"), (error: unknown) => error instanceof QlooError && error.code === "qloo_timeout");
  assert.equal(signal?.aborted, true);
});

test("the timeout covers response reading too", async () => {
  const stream = new ReadableStream<Uint8Array>({ start() { /* A stalled upstream body. */ } });
  const client = new QlooClient({ apiKey: SECRET, timeoutMs: 15, fetch: fakeFetch(() => new Response(stream)) });
  await assert.rejects(client.search("Test", "book"), (error: unknown) => error instanceof QlooError && error.code === "qloo_timeout");
});

test("network exception text never reaches a user", async () => {
  const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => { throw new Error(`network included ${SECRET}`); }) });
  await assert.rejects(client.search("Test", "book"), (error: unknown) => {
    assert.ok(error instanceof QlooError);
    assert.equal(error.code, "qloo_network");
    assert.ok(!error.message.includes(SECRET));
    return true;
  });
});

test("response body limits reject oversized data", async () => {
  const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => new Response("{}", { headers: { "content-length": "2000000" } })) });
  await assert.rejects(client.search("Test", "book"), (error: unknown) => error instanceof QlooError && error.code === "qloo_response_limit");
});

test("invalid IDs, too many candidates and duplicate offer IDs stop before Qloo", async () => {
  let calls = 0;
  const client = new QlooClient({ apiKey: SECRET, fetch: fakeFetch(() => { calls += 1; return json({ success: true, results: [] }); }) });
  const reader = member();
  await assert.rejects(client.rank({ ...reader, seeds: [{ id: "seed,inject", name: "bad", type: "book" }] }, []), QlooError);
  await assert.rejects(client.rank(reader, [makeOffer("bad", "reader-b", "unresolved")]), QlooError);
  await assert.rejects(client.rank(reader, [makeOffer("same", "reader-b", IDS.first), makeOffer("same", "reader-c", IDS.second)]), QlooError);
  await assert.rejects(client.rank(reader, Array.from({ length: 51 }, (_, i) => makeOffer(`copy-${i}`, "reader-b", IDS.first))), QlooError);
  assert.equal(calls, 0);
});
