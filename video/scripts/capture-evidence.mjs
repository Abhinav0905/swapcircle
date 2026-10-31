#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

// Evidence for an illustrated walkthrough, not a browser recording. Each write
// runs once. Private room identifiers and capabilities remain in process memory.
const DEFAULT_BASE = "https://swapcircle-books.abhinav-0905.chatgpt.site";
const OUTPUT = new URL("../src/data/evidence.json", import.meta.url);
class CaptureError extends Error {}
function requireThat(condition, message) { if (!condition) throw new CaptureError(message); }
const sorted = (values) => [...values].sort().join(",");

class PublicSampleClient {
  constructor(base) {
    const url = new URL(base);
    requireThat(url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/", "Use the public HTTPS site origin without a private path or credentials.");
    this.base = url.origin;
  }

  async request(path, { method = "GET", token, body, label = "request" } = {}) {
    let response;
    let data;
    try {
      response = await fetch(new URL(path, this.base), {
        method, redirect: "error", signal: AbortSignal.timeout(20_000),
        headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      data = await response.json();
    } catch { throw new CaptureError("The public " + label + " failed or returned an unexpected response. No response body was logged."); }
    return { status: response.status, data };
  }

  async act(created, room, action, token = created.hostToken) {
    const result = await this.request("/api/rooms/" + room.id, { method: "POST", token,
      body: { revision: room.revision, action }, label: action.type,
    });
    requireThat(result.status === 200, "The public " + action.type + " action failed with HTTP " + result.status + ". It was not retried.");
    requireThat(result.data.room?.revision === room.revision + 1, "An action did not advance the room revision exactly once.");
    return result.data.room;
  }

  async persisted(created, expected) {
    const result = await this.request("/api/rooms/" + expected.id, { token: created.hostToken, label: "persisted-state read" });
    requireThat(result.status === 200, "The persisted sample could not be read.");
    requireThat(JSON.stringify(result.data.room) === JSON.stringify(expected), "The persisted sample did not match the action response.");
    return result.data.room;
  }
}

class VideoEvidence {
  constructor(publicBase, status) {
    this.data = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      publicBase,
      source: "fixture",
      mode: "demo",
      captureMethod: "Responses from the public application's HTTP API",
      presentation: "Illustrated walkthrough based on captured application state; not a browser recording",
      fictionalParticipants: true,
      readingChoicesSimulated: true,
      approvalsSimulated: true,
      liveQlooVerifiedByThisCapture: false,
      liveQlooCallsRequested: false,
      qlooConfiguredAtCapture: status.qlooConfigured,
      evidenceBoundary: "Authored taste rankings and simulated responses prove the sample exchange behavior. They do not establish live Qloo ranking quality, real participant consent or a completed physical handoff.",
      members: [],
      stages: [],
      approvalSequence: [],
      cleanup: null,
    };
  }

  identifyMembers(room) {
    requireThat(room.mode === "demo", "The server did not create a sample room.");
    requireThat(sorted(room.members.map((member) => member.id)) === "iris,jules,leo,maya,noor,sam", "The sample cast differs from the documented scenario.");
    this.data.members = room.members.map((member) => ({
      id: member.id, name: member.name, color: member.color,
      book: { id: member.offer.id, title: member.offer.title, author: member.offer.author, color: member.offer.color, condition: member.offer.condition },
      culturalSeeds: member.seeds.map(({ name, type }) => ({ name, type })),
    }));
  }

  stage(room, id, label, expectedMatched, expectedApproved) {
    requireThat(room.mode === "demo" && room.rankings.length === 6 && room.rankings.every((ranking) => ranking.source === "fixture"), "A captured stage did not retain fixture provenance.");
    requireThat(room.plan?.matchedCount === expectedMatched && room.plan.directSwapCount === 2, "The sample counts differ from the documented scenario.");
    requireThat(sorted(room.approvals.map((approval) => approval.memberId)) === sorted(expectedApproved), "The stage's exact approvals differ from the documented scenario.");
    const names = (ids) => ids.map((id) => room.members.find((member) => member.id === id).name);
    const edges = room.plan.cycles.flatMap((cycle) => cycle.edges);
    for (const field of ["giverId", "recipientId", "bookId"]) requireThat(new Set(edges.map((edge) => edge[field])).size === edges.length, "The captured plan allocated a person or physical copy twice.");
    requireThat(edges.every((edge) => room.choices.some((choice) => choice.memberId === edge.recipientId && choice.bookId === edge.bookId && choice.value === "yes")), "A captured proposal lacked an explicit simulated reading choice.");
    const cycles = room.plan.cycles.map((cycle) => {
      const approvedIds = cycle.memberIds.filter((id) => room.approvals.some((approval) => approval.memberId === id && approval.fingerprint === cycle.fingerprint));
      return {
        memberIds: [...cycle.memberIds], members: names(cycle.memberIds), size: cycle.memberIds.length,
        fullyApproved: approvedIds.length === cycle.memberIds.length,
        approvedMemberIds: approvedIds, approvedMembers: names(approvedIds),
        trades: cycle.edges.map((edge) => {
          const giver = room.members.find((member) => member.id === edge.giverId);
          const recipient = room.members.find((member) => member.id === edge.recipientId);
          const evidence = room.rankings.find((ranking) => ranking.id === edge.evidenceId && ranking.memberId === edge.recipientId);
          requireThat(evidence?.source === "fixture" && evidence.entries.some((entry) => entry.bookId === edge.bookId), "A captured trade did not have its fixture evidence.");
          return { giverId: giver.id, giver: giver.name, recipientId: recipient.id, recipient: recipient.name,
            bookId: giver.offer.id, book: giver.offer.title, author: giver.offer.author, recipientRank: edge.recipientRank, source: "fixture" };
        }),
      };
    });
    let question = null;
    if (room.question) {
      const recipient = room.members.find((member) => member.id === room.question.memberId);
      const owner = room.members.find((member) => member.offer.id === room.question.bookId);
      question = { memberId: recipient.id, member: recipient.name, bookId: owner.offer.id, book: owner.offer.title,
        offeredBy: owner.name, rank: room.question.rank, connectsMembers: names(room.question.connectsMemberIds),
        reason: room.question.reason, source: "fixture" };
    }
    const approvedIds = room.approvals.map((approval) => approval.memberId);
    const availableIds = room.members.filter((member) => member.active && member.offer.available).map((member) => member.id);
    this.data.stages.push({
      id, label, observedAt: new Date().toISOString(), revision: room.revision, source: "fixture", persistedReadVerified: true,
      matchedCount: room.plan.matchedCount, directSwapCount: room.plan.directSwapCount,
      availableMemberIds: availableIds, availableMembers: names(availableIds),
      matchedMemberIds: [...room.plan.matchedMemberIds], matchedMembers: names(room.plan.matchedMemberIds),
      unmatchedMemberIds: [...room.plan.unmatchedMemberIds], unmatchedMembers: names(room.plan.unmatchedMemberIds),
      approvalCount: approvedIds.length, approvedMemberIds: approvedIds, approvedMembers: names(approvedIds),
      approvalsSimulated: true, cycles, question,
    });
  }

  recordApproval(room, memberId) {
    const member = room.members.find((item) => item.id === memberId);
    const approval = room.approvals.find((item) => item.memberId === memberId);
    const cycle = room.plan.cycles.find((item) => item.fingerprint === approval?.fingerprint && item.memberIds.includes(memberId));
    requireThat(cycle, "A simulated approval did not bind to the current exchange.");
    const incoming = cycle.edges.find((edge) => edge.recipientId === memberId);
    const receivedBook = room.members.find((item) => item.offer.id === incoming.bookId).offer;
    this.data.approvalSequence.push({ memberId, member: member.name, revision: room.revision,
      approvedAt: approval.approvedAt, gives: member.offer.title, receives: receivedBook.title,
      cycleMembers: cycle.memberIds.map((id) => room.members.find((item) => item.id === id).name), simulated: true });
  }
}

function verifyNoSecrets(serialized, created) {
  const privateValues = [created.room.id, created.hostToken, ...Object.values(created.memberTokens)];
  requireThat(privateValues.every((value) => typeof value === "string" && !serialized.includes(value)), "Sanitization rejected private data before writing evidence.");
  requireThat(!/\b[a-f0-9]{64}\b/i.test(serialized) && !/Bearer\s+|#key=|\/circle\/|\/api\/rooms\//i.test(serialized), "Sanitization rejected a possible credential or private URL.");
}

async function main() {
  const client = new PublicSampleClient(process.argv[2] ?? DEFAULT_BASE);
  const status = await client.request("/api/status", { label: "status check" });
  requireThat(status.status === 200 && typeof status.data.qlooConfigured === "boolean", "The public status response was not valid.");
  const evidence = new VideoEvidence(client.base, status.data);
  let created;
  try {
    const result = await client.request("/api/rooms", { method: "POST", body: { mode: "demo" }, label: "sample creation" });
    requireThat(result.status === 201, "The public sample creation failed with HTTP " + result.status + ". It was not retried.");
    created = result.data;
    requireThat(created.role?.kind === "host" && /^[a-f0-9]{64}$/.test(created.hostToken) && Object.keys(created.memberTokens ?? {}).length === 6, "Sample creation did not return the expected in-memory access credentials.");
    evidence.identifyMembers(created.room);

    let room = await client.act(created, created.room, { type: "rank" });
    room = await client.persisted(created, room);
    requireThat(room.question?.memberId === "noor" && room.question.bookId === "book-jules", "The first question differs from the documented sample.");
    evidence.stage(room, "initial_rank", "Two readers can swap directly", 2, []);

    room = await client.act(created, room, { type: "choice", memberId: "noor", bookId: "book-jules", value: "yes" }, created.memberTokens.noor);
    room = await client.persisted(created, room);
    evidence.stage(room, "noor_accepts", "Noor's simulated yes completes a four-person circle", 6, []);

    const exactCycles = room.plan.cycles;
    for (const cycle of exactCycles) for (const memberId of cycle.memberIds) {
      room = await client.act(created, room, { type: "approve", memberId, fingerprint: cycle.fingerprint }, created.memberTokens[memberId]);
      evidence.recordApproval(room, memberId);
    }
    room = await client.persisted(created, room);
    evidence.stage(room, "all_approved", "All six fictional readers have simulated exact approvals", 6, ["maya", "leo", "noor", "jules", "iris", "sam"]);

    room = await client.act(created, room, { type: "withdraw", memberId: "noor" }, created.memberTokens.noor);
    room = await client.persisted(created, room);
    requireThat(room.question?.memberId === "leo" && room.question.bookId === "book-jules", "The repair question differs from the documented sample.");
    evidence.stage(room, "noor_withdraws", "Noor steps out; Iris and Sam keep their approved pair", 2, ["iris", "sam"]);

    room = await client.act(created, room, { type: "choice", memberId: "leo", bookId: "book-jules", value: "yes" }, created.memberTokens.leo);
    room = await client.persisted(created, room);
    requireThat(!room.plan.matchedMemberIds.includes("noor"), "The withdrawn reader appeared in the repaired plan.");
    evidence.stage(room, "leo_repairs", "Leo's simulated yes proposes a new three-person circle", 5, ["iris", "sam"]);
  } finally {
    if (created?.room?.id && created.hostToken) {
      const path = "/api/rooms/" + created.room.id;
      const deleted = await client.request(path, { method: "DELETE", token: created.hostToken, label: "sample cleanup" });
      const absent = await client.request(path, { token: created.hostToken, label: "deletion verification" });
      requireThat(deleted.status === 200 && absent.status === 404, "Disposable sample deletion could not be verified. No evidence file was written.");
      evidence.data.cleanup = { deletedAt: new Date().toISOString(), deleteStatus: deleted.status, readAfterDeleteStatus: absent.status, verified: true };
    }
  }
  requireThat(evidence.data.stages.length === 5 && evidence.data.approvalSequence.length === 6 && evidence.data.cleanup?.verified, "The evidence capture is incomplete.");
  evidence.data.completedAt = new Date().toISOString();
  const serialized = JSON.stringify(evidence.data, null, 2) + "\n";
  verifyNoSecrets(serialized, created);
  await mkdir(new URL("./", OUTPUT), { recursive: true });
  const temporary = new URL("./evidence.json.tmp", import.meta.url);
  await writeFile(temporary, serialized, { mode: 0o600 });
  await rename(temporary, OUTPUT);
  const written = await readFile(OUTPUT, "utf8");
  requireThat(written === serialized, "The saved evidence did not match the verified capture.");
  verifyNoSecrets(written, created);
  console.log("Captured five public fixture stages: 2, 6, 6 approved, 2, 5. Six simulated approvals recorded. Deletion verified with HTTP 200 then 404. Saved sanitized evidence.json; no private links or credentials were written.");
}

try { await main(); }
catch (error) {
  console.error(error instanceof CaptureError ? error.message : "Evidence capture failed. No private values or response bodies were logged.");
  process.exitCode = 1;
}
