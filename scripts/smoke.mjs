#!/usr/bin/env node
import { setTimeout as pause } from "node:timers/promises";
import { readFile, writeFile } from "node:fs/promises";

// Only disposable demo circles are created. Capabilities stay in memory and
// never enter logs or files. This checks HTTP routes and real database state.
const base = new URL(process.argv[2] || "http://127.0.0.1:5173");
if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
  throw new Error("Use an HTTP(S) site origin without credentials or query parameters.");
}
const origin = base.origin;
const workerLog = process.argv.find((argument) => argument.startsWith("--worker-log="))?.slice("--worker-log=".length);
const originProbe = process.argv.includes("--origin-probe");
const created = [];
let checks = 0;
class SmokeFailure extends Error {}
function check(condition, description) {
  if (!condition) throw new SmokeFailure(description);
  checks += 1;
}
function sorted(values) { return [...values].sort().join(","); }

// Match the installed Wrangler proxy's fixed response, never print its body.
const workerRestartResponse = "Your worker restarted mid-request. Please try sending the request again. Only GET or HEAD requests are retried automatically.";
function responseDetails(response) {
  const code = /^[a-z_]{1,48}$/.test(response.data?.error?.code ?? "") ? response.data.error.code : "unknown";
  return `${response.status}, ${code}, ${response.contentType}, ${response.classification}`;
}

/** Output only fixed lifecycle labels and bounded HTTP fields, never raw lines. */
function summarizeWorkerLog(raw) {
  const summary = [];
  const lifecycle = [
    ["Starting local server", "starting"],
    ["Reloading local server", "reloading"],
    ["Local server updated and ready", "reload-ready"],
    ["Connection status updated", "connection-update"],
    ["Ready on", "listening"],
    ["Error reloading local server", "reload-error"],
    ["Shutting down local server", "stopping"],
    ["D1_ERROR", "d1-error"],
    ["SQLITE_BUSY", "sqlite-busy"],
    ["The script will never generate a response", "unresolved-response"],
    ["Can't perform I/O on behalf of a different request", "request-context"],
    ["Network connection lost", "connection-lost"],
    ["The request was canceled", "canceled-request"],
  ];
  const lines = raw.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.replace(/\u001b\[[0-9;]*m/g, "");
    for (const [match, label] of lifecycle) {
      if (line.includes(match)) summary.push(`line ${index + 1}: worker ${label}`);
    }
    const proxy = /SWAPCIRCLE_PROXY_FAILURE (unresolved-response|request-context|request-body|connection-lost|canceled|resource-limit|timeout|fetch-failed|other) (Error|TypeError|AbortError|TimeoutError|DOMException|OtherError) same-upstream=(true|false)\b/.exec(line);
    if (proxy) summary.push(`line ${index + 1}: proxy ${proxy[1]} ${proxy[2]} same-upstream=${proxy[3]}`);
    const request = /\b(GET|HEAD|POST|DELETE|OPTIONS) (\/[^\s]*) ([1-5]\d{2})\b/.exec(line);
    if (request) {
      const path = request[2].split(/[?#]/, 1)[0];
      const route = /^\/api\/rooms\/[0-9a-f-]{36}$/i.test(path) ? "/api/rooms/:id"
        : ["/api/status", "/api/rooms", "/api/mcp", "/api/search"].includes(path) ? path : "<other-route>";
      summary.push(`line ${index + 1}: ${request[1]} ${route} ${request[3]}`);
    }
  }
  return `Safe Worker log summary (${lines.length} source lines; raw lines omitted).\n${summary.join("\n")}\n`;
}

async function captureWorkerDiagnostics() {
  if (!workerLog) return;
  try {
    const summary = summarizeWorkerLog(await readFile(workerLog, "utf8"));
    await writeFile(`${workerLog}.safe.txt`, summary, { mode: 0o600 });
    console.error(summary.trimEnd());
  } catch { console.error("Worker diagnostics were unavailable. No raw log data was printed."); }
}

async function call(path, { method = "GET", token, body, headers = {}, timeout = 20_000 } = {}) {
  let response;
  try {
    response = await fetch(new URL(path, origin), {
      method, headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers,
      }, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout), redirect: "error",
    });
  } catch { throw new SmokeFailure("An HTTP request failed or timed out. No response data was logged."); }
  let data = null;
  let classification = "empty";
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  const contentType = ["application/json", "text/plain", "text/html"].includes(mediaType) ? mediaType : mediaType ? "other-type" : "no-type";
  if (response.status !== 202 && response.status !== 204) {
    const text = await response.text();
    try { data = JSON.parse(text); classification = "json"; }
    catch {
      // The framework may reject foreign origins before our JSON route runs.
      // Do not log that body or mistake a plain-text rejection for a success.
      classification = response.status === 503 && response.headers.get("retry-after") === "0" && text === workerRestartResponse
        ? "wrangler-worker-restarted" : "non-json";
      if (response.ok) throw new SmokeFailure("A successful endpoint returned a non-JSON response.");
    }
  }
  return { status: response.status, data, headers: response.headers, contentType, classification };
}

async function ready() {
  let consecutiveSuccesses = 0;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const result = await call("/api/status", { timeout: 3_000 });
      if (result.status === 200 && typeof result.data?.qlooConfigured === "boolean") {
        consecutiveSuccesses += 1;
        // A fresh dev Worker can answer before its configuration settles.
        // Observe read-only stability before any test mutations; never retry a write.
        if (consecutiveSuccesses >= 3) return result.data;
      } else consecutiveSuccesses = 0;
    } catch { consecutiveSuccesses = 0; /* Bounded read-only readiness retry. */ }
    await pause(1_000);
  }
  throw new SmokeFailure("The status endpoint did not become ready within the bounded wait.");
}

async function createDemo() {
  const response = await call("/api/rooms", { method: "POST", body: { mode: "demo" } });
  check(response.status === 201, `Demo circle creation failed (${responseDetails(response)}).`);
  const value = response.data;
  check(value?.room?.mode === "demo" && value.role?.kind === "host", "Creation did not return a demo host session.");
  check(typeof value.hostToken === "string" && Object.keys(value.memberTokens ?? {}).length === 6, "Creation did not return six separate participant capabilities.");
  check(new Set([value.hostToken, ...Object.values(value.memberTokens)]).size === 7, "Participant and host capabilities must be distinct.");
  check(response.headers.get("cache-control")?.includes("no-store"), "Capabilities must never be cached.");
  check(response.headers.get("referrer-policy") === "no-referrer", "Private responses need no-referrer.");
  created.push(value);
  return value;
}

async function read(circle, token = circle.hostToken) {
  const response = await call(`/api/rooms/${circle.room.id}`, { token });
  check(response.status === 200, "Authenticated room read failed.");
  check(!("hostToken" in response.data) && !("memberTokens" in response.data), "A room read disclosed capabilities.");
  return response.data;
}

async function act(circle, state, action, token = circle.hostToken) {
  const response = await call(`/api/rooms/${circle.room.id}`, { method: "POST", token, body: { revision: state.revision, action } });
  check(response.status === 200, `Authorized ${action.type} action failed at revision ${state.revision} after ${checks} checks (${responseDetails(response)}).`);
  check(response.data.room.revision === state.revision + 1, "A state change did not increment the revision exactly once.");
  return response.data.room;
}

function checkPlan(room, requireAllApproved = false) {
  const edges = room.plan.cycles.flatMap((cycle) => cycle.edges);
  check(new Set(edges.map((edge) => edge.giverId)).size === edges.length, "A member gave more than once.");
  check(new Set(edges.map((edge) => edge.recipientId)).size === edges.length, "A member received more than once.");
  check(new Set(edges.map((edge) => edge.bookId)).size === edges.length, "A physical book was allocated twice.");
  check(edges.every((edge) => edge.giverId !== edge.recipientId), "A self-trade appeared in the plan.");
  check(edges.every((edge) => room.choices.some((choice) => choice.memberId === edge.recipientId && choice.bookId === edge.bookId && choice.value === "yes")), "A plan used an unaccepted reading choice.");
  check(edges.every((edge) => room.rankings.some((ranking) => ranking.id === edge.evidenceId && ranking.memberId === edge.recipientId && ranking.entries.some((entry) => entry.bookId === edge.bookId))), "A plan contains a match without its taste evidence.");
  if (requireAllApproved) {
    check(room.plan.cycles.every((cycle) => cycle.memberIds.every((memberId) => room.approvals.some((approval) => approval.memberId === memberId && approval.fingerprint === cycle.fingerprint))), "A ready-to-handoff plan is missing exact member approval.");
  }
}

async function mcp(body, token) {
  return call("/api/mcp", { method: "POST", token, body,
    headers: { Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25" },
  });
}

/** One optional local-Worker diagnostic: each new room receives exactly one rank. */
async function probeOriginRejection() {
  if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) {
    throw new SmokeFailure("The transport probe is restricted to a local Worker.");
  }
  await ready();
  let rankFailures = 0;
  for (let index = 0; index < 8; index += 1) {
    const circle = await createDemo();
    const path = `/api/rooms/${circle.room.id}`;
    const closeRejectedConnection = index >= 4;
    const rejected = await call("/api/rooms", {
      method: "POST", body: { mode: "demo" },
      headers: { Origin: "https://another.example", ...(closeRejectedConnection ? { Connection: "close" } : {}) },
    });
    check(rejected.status === 403, "The transport probe's foreign-origin request was not rejected.");
    const ranked = await call(path, { method: "POST", token: circle.hostToken,
      body: { revision: 0, action: { type: "rank" } },
    });
    const observed = await call(path, { token: circle.hostToken });
    check(observed.status === 200 && Number.isInteger(observed.data?.room?.revision), "The transport probe could not inspect the persisted revision.");
    const revision = observed.data.room.revision;
    // A failed HTTP response can follow a committed write. Record its revision,
    // then delete the disposable room. Never repeat the rank to find out.
    console.log(`PROBE case=${index + 1} rejected-connection=${closeRejectedConnection ? "close" : "default"} origin=${rejected.status} rank=(${responseDetails(ranked)}) persisted-revision=${revision}`);
    if (ranked.status !== 200) rankFailures += 1;
    else check(revision === 1, "A successful probe rank did not persist revision one.");
    const removed = await call(path, { method: "DELETE", token: circle.hostToken });
    const missing = await call(path, { token: circle.hostToken });
    check(removed.status === 200 && missing.status === 404, "The transport probe could not remove its disposable circle.");
    created.splice(created.indexOf(circle), 1);
  }
  check(rankFailures === 0, `${rankFailures} of eight single-attempt ranks failed. Their persisted revisions are recorded above.`);
  console.log("PASS: Eight bounded transport cases. Each rank was sent once; all disposable circles were deleted.");
}

async function run() {
  const status = await ready();
  console.log("HTTP ready. Starting disposable demo-circle checks.");
  const circle = await createDemo();
  const other = await createDemo();
  const path = `/api/rooms/${circle.room.id}`;

  check((await call(path)).status === 401, "Anonymous room access was not denied.");
  check((await call(`${path}?token=${"0".repeat(64)}`)).status === 401, "A query-string credential was accepted.");
  check((await call(`/api/rooms/${other.room.id}`, { token: circle.hostToken })).status === 401, "A capability crossed room boundaries.");
  const participant = await read(circle, circle.memberTokens.maya);
  check(participant.role.kind === "member" && participant.role.memberId === "maya", "A participant token did not retain its own role.");
  check((await call(path, { method: "POST", token: circle.memberTokens.maya, body: { revision: 0, action: { type: "rank" } } })).status === 403, "A participant performed a host-only ranking action.");
  check((await call(path, { method: "DELETE", token: circle.memberTokens.maya })).status === 403, "A participant deleted a host's circle.");
  check((await call("/api/rooms", { method: "POST", body: { mode: "demo" }, headers: { Origin: "https://another.example" } })).status === 403, "A foreign browser origin created a circle.");

  let state = await act(circle, circle.room, { type: "rank" });
  check(state.rankings.length === 6 && state.rankings.every((evidence) => evidence.source === "fixture"), "Demo rankings lost fixture provenance.");
  check(state.plan.matchedCount === 2 && state.plan.directSwapCount === 2, "The initial two-person swap did not match the authored scenario.");
  check(state.question?.memberId === "noor" && state.question.bookId === "book-jules", "The first bridge question did not target the missing reading choice.");
  const forbidden = await call(path, { method: "POST", token: circle.memberTokens.maya,
    body: { revision: state.revision, action: { type: "choice", memberId: "noor", bookId: "book-jules", value: "yes" } },
  });
  check(forbidden.status === 403, "One member changed another member's reading choice.");

  // Both requests read the same expected revision. D1 compare-and-swap must
  // allow exactly one commit, including when their reads race.
  const concurrent = await Promise.all([0, 1].map(() => call(path, { method: "POST", token: circle.hostToken,
    body: { revision: state.revision, action: { type: "plan" } },
  })));
  check(sorted(concurrent.map((result) => result.status)) === "200,409", "Concurrent writes did not produce one success and one stale-revision rejection.");
  const afterRace = (await read(circle)).room;
  check(afterRace.revision === state.revision + 1, "D1 committed more than one concurrent update.");
  state = afterRace;
  check((await call(path, { method: "POST", token: circle.hostToken, body: { revision: 0, action: { type: "plan" } } })).status === 409, "An old revision was accepted.");

  state = await act(circle, state, { type: "choice", memberId: "noor", bookId: "book-jules", value: "yes" }, circle.memberTokens.noor);
  check(state.plan.matchedCount === 6 && state.plan.directSwapCount === 2, "The accepted bridge did not produce the six-person allocation.");
  check(sorted(state.plan.cycles.map((cycle) => cycle.memberIds.length)) === "2,4", "Expected one pair and one four-person cycle.");
  check(state.approvals.length === 0, "Reading acceptance was incorrectly treated as exchange approval.");
  checkPlan(state);
  const pair = state.plan.cycles.find((cycle) => cycle.memberIds.length === 2);
  const four = state.plan.cycles.find((cycle) => cycle.memberIds.length === 4);
  for (const cycle of state.plan.cycles) {
    for (const memberId of cycle.memberIds) state = await act(circle, state, { type: "approve", memberId, fingerprint: cycle.fingerprint }, circle.memberTokens[memberId]);
  }
  checkPlan(state, true);

  const initialized = await mcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "swapcircle-http-smoke", version: "1.0.0" } } });
  check(initialized.status === 200 && initialized.data.result?.protocolVersion === "2025-11-25", "MCP initialization failed.");
  const listed = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  check(listed.data.result?.tools?.length === 4 && listed.data.result.tools.every((tool) => tool.annotations.readOnlyHint), "MCP did not expose exactly four read-only tools.");
  const beforeTools = JSON.stringify((await read(circle)).room);
  for (const [index, name] of ["inspect_circle", "suggest_next_question", "explain_match", "plan_exchanges"].entries()) {
    const args = { roomId: state.id, ...(name === "explain_match" ? { memberId: "maya", bookId: "book-leo" } : {}) };
    const result = await mcp({ jsonrpc: "2.0", id: index + 3, method: "tools/call", params: { name, arguments: args } }, circle.memberTokens.maya);
    check(result.status === 200 && result.data.result?.isError === false && result.data.result.structuredContent.readOnly === true, "An authenticated read-only MCP tool failed.");
  }
  check(JSON.stringify((await read(circle)).room) === beforeTools, "A read-only MCP tool changed persisted room state.");
  check((await mcp({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "inspect_circle", arguments: { roomId: state.id } } })).status === 401, "Anonymous MCP access to room data succeeded.");
  const mutation = await mcp({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "approve_exchange", arguments: { roomId: state.id } } }, circle.hostToken);
  check(mutation.data.error?.code === -32602, "MCP accepted an undeclared approval tool.");
  check((await call("/api/mcp", { headers: { Accept: "text/event-stream" } })).status === 405, "MCP GET should decline an unsupported SSE stream.");

  state = await act(circle, state, { type: "withdraw", memberId: "noor" }, circle.memberTokens.noor);
  check(state.plan.matchedCount === 2 && state.plan.cycles[0]?.fingerprint === pair.fingerprint, "Withdrawal changed an independent approved pair.");
  check(sorted(state.approvals.map((approval) => approval.memberId)) === "iris,sam", "Withdrawal did not clear only the affected approvals.");
  check(state.question?.memberId === "leo" && state.question.bookId === "book-jules", "Withdrawal did not produce the next feasible bridge question.");
  const oldApproval = await call(path, { method: "POST", token: circle.memberTokens.maya,
    body: { revision: state.revision, action: { type: "approve", memberId: "maya", fingerprint: four.fingerprint } },
  });
  check(oldApproval.status === 400 && oldApproval.data.error?.code === "stale_approval", "Approval of a broken cycle was accepted.");
  state = await act(circle, state, { type: "choice", memberId: "leo", bookId: "book-jules", value: "yes" }, circle.memberTokens.leo);
  check(state.plan.matchedCount === 5 && !state.plan.matchedMemberIds.includes("noor"), "The repair did not produce a five-person allocation without the withdrawn member.");
  check(sorted(state.approvals.map((approval) => approval.memberId)) === "iris,sam", "A repaired cycle inherited old approvals.");
  checkPlan(state);
  for (const cycle of state.plan.cycles.filter((item) => item.fingerprint !== pair.fingerprint)) {
    for (const memberId of cycle.memberIds) state = await act(circle, state, { type: "approve", memberId, fingerprint: cycle.fingerprint }, circle.memberTokens[memberId]);
  }
  checkPlan(state, true);

  if (!status.qlooConfigured) {
    const search = await call("/api/search?q=Arrival&type=movie");
    check(search.status === 503 && search.data.error?.code === "qloo_not_configured", "Missing live credentials did not produce a clear 503.");
    const members = circle.room.members.slice(0, 2).map((member) => ({ ...member,
      seeds: member.seeds.map((seed) => ({ ...seed, id: crypto.randomUUID() })),
      offer: { ...member.offer, entityId: crypto.randomUUID() },
    }));
    const live = await call("/api/rooms", { method: "POST", body: { mode: "live", title: "Smoke should reject this", members } });
    check(live.status === 503, "A live circle was created without a configured Qloo key.");
  } else {
    console.log("Qloo is configured; missing-key checks skipped. This smoke makes no live provider calls.");
  }

  console.log(`PASS: ${checks} HTTP/D1 assertions. Demo allocation: 2 → 6 → 2 → 5. Exact approvals and CAS verified.`);
}

let failed = false;
try { if (originProbe) await probeOriginRejection(); else await run(); }
catch (error) {
  failed = true;
  console.error(error instanceof SmokeFailure ? `FAIL: ${error.message}` : "FAIL: Unexpected smoke-script error. Sensitive values were not logged.");
} finally {
  for (const circle of created) {
    try {
      const removed = await call(`/api/rooms/${circle.room.id}`, { method: "DELETE", token: circle.hostToken });
      const missing = await call(`/api/rooms/${circle.room.id}`, { token: circle.hostToken });
      if (removed.status !== 200 || missing.status !== 404) {
        failed = true;
        console.error("FAIL: A disposable circle could not be fully removed.");
      }
    } catch {
      failed = true;
      console.error("FAIL: Cleanup could not reach the server. Disposable demo state may remain.");
    }
  }
  console.log(`Cleanup checked for ${created.length} disposable demo circles. No capabilities were written to disk.`);
  if (failed || originProbe) await captureWorkerDiagnostics();
}
if (failed) process.exitCode = 1;
