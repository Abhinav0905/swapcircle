import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "@/lib/domain/errors";
import type { BookOffer, CreatedRoom, ExchangeRoom, Member, RankingEvidence, RoomAction, TasteProvider } from "@/lib/domain/types";
import { DemoFactory } from "@/lib/demo/DemoFactory";
import { FixtureTasteProvider } from "@/lib/demo/FixtureTasteProvider";
import { CapabilityService, type CredentialRecord } from "@/lib/storage/CapabilityService";
import type { RoomRepository, StoredRoom } from "@/lib/storage/RoomRepository";
import { RoomService } from "@/lib/storage/RoomService";

/** A separate storage double: copies snapshots and implements real revision CAS. */
class MemoryRepository implements Pick<RoomRepository, "create" | "get" | "save" | "remove" | "consumeLimit"> {
  readonly records = new Map<string, StoredRoom>();
  readonly limits = new Map<string, number>();
  writes = 0;
  conflictBeforeNextSave = false;

  async create(room: ExchangeRoom, credentials: CredentialRecord[]): Promise<void> {
    if (this.records.has(room.id)) throw new Error("Duplicate room");
    this.records.set(room.id, structuredClone({ room, credentials }));
  }
  async get(id: string): Promise<StoredRoom | null> {
    return this.records.has(id) ? structuredClone(this.records.get(id)!) : null;
  }
  async save(room: ExchangeRoom, expectedRevision: number): Promise<void> {
    const current = this.records.get(room.id);
    if (this.conflictBeforeNextSave && current) {
      this.conflictBeforeNextSave = false;
      current.room = { ...current.room, revision: current.room.revision + 1, title: "Changed in another tab" };
    }
    if (!current || current.room.revision !== expectedRevision) throw new AppError("The room changed during this request.", 409, "stale_revision");
    this.records.set(room.id, { room: structuredClone(room), credentials: structuredClone(current.credentials) });
    this.writes++;
  }
  async remove(id: string): Promise<void> { this.records.delete(id); }
  async consumeLimit(key: string, limit: number): Promise<void> {
    const count = (this.limits.get(key) ?? 0) + 1;
    this.limits.set(key, count);
    if (count > limit) throw new AppError("Rate limit exceeded.", 429, "rate_limited");
  }
}

/** Test data only. This does not send requests to Qloo. */
class ContractProvider implements TasteProvider {
  readonly source = "qloo" as const;
  async search() { return []; }
  async rank(member: Member, offers: BookOffer[]): Promise<RankingEvidence> {
    return {
      id: `test-${crypto.randomUUID()}`, memberId: member.id, source: "qloo", fetchedAt: new Date().toISOString(),
      seeds: structuredClone(member.seeds), requestedBookIds: offers.map((offer) => offer.id),
      entries: offers.map((offer, index) => ({ bookId: offer.id, entityId: offer.entityId, rank: index + 1, providerScore: null, explanation: null })),
      missingBookIds: [], warnings: ["Test contract data; no provider request made."],
      request: { endpoint: "test://contract-provider", parameters: {} },
    };
  }
}

function liveMembers(count = 2): Member[] {
  return Array.from({ length: count }, (_, index) => {
    const template = DemoFactory.members()[index % 6];
    const id = `reader-${index}`;
    return {
      ...template, id, name: `Reader ${index}`,
      seeds: template.seeds.map((seed) => ({ ...seed, id: crypto.randomUUID() })),
      offer: { ...template.offer, id: `copy-${index}`, ownerId: id, entityId: crypto.randomUUID() },
    };
  });
}

function setup(provider: (mode: ExchangeRoom["mode"]) => TasteProvider = (mode) => mode === "demo" ? new FixtureTasteProvider() : new ContractProvider()) {
  const repository = new MemoryRepository();
  const capabilities = new CapabilityService();
  return { repository, capabilities, service: new RoomService(repository, capabilities, provider) };
}

const status = (expected: number) => (error: unknown) => error instanceof AppError && error.status === expected;

async function act(service: RoomService, created: CreatedRoom, token: string, action: RoomAction): Promise<ExchangeRoom> {
  const current = await service.read(created.room.id, token);
  return (await service.act(created.room.id, token, current.room.revision, action)).room;
}

async function approvedPair(service: RoomService, created: CreatedRoom): Promise<ExchangeRoom> {
  await act(service, created, created.hostToken, { type: "rank" });
  for (const member of created.room.members) {
    const other = created.room.members.find((item) => item.id !== member.id)!;
    await act(service, created, created.memberTokens[member.id], { type: "choice", memberId: member.id, bookId: other.offer.id, value: "yes" });
  }
  let current = (await service.read(created.room.id, created.hostToken)).room;
  for (const member of created.room.members) {
    current = await act(service, created, created.memberTokens[member.id], { type: "approve", memberId: member.id, fingerprint: current.plan!.cycles[0].fingerprint });
  }
  return current;
}

test("capabilities use 256-bit tokens and SHA-256 digests", async () => {
  const capabilities = new CapabilityService();
  const tokens = Array.from({ length: 32 }, () => capabilities.issue());
  assert.equal(new Set(tokens).size, 32);
  assert.ok(tokens.every((token) => /^[a-f0-9]{64}$/.test(token)));
  assert.equal(await capabilities.hash("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const token = tokens[0];
  const credentials: CredentialRecord[] = [{ hash: await capabilities.hash(token), role: { kind: "member", memberId: "maya" } }];
  assert.notEqual(credentials[0].hash, token);
  assert.deepEqual(await capabilities.identify(token, credentials), { kind: "member", memberId: "maya" });
  for (const invalid of ["", "short", "g".repeat(64), `${token}x`, tokens[1]]) assert.equal(await capabilities.identify(invalid, credentials), null);
});

test("creation stores only credential digests and returns each invitation once", async () => {
  const { service, repository } = setup();
  const created = await service.create({ mode: "demo" });
  const stored = repository.records.get(created.room.id)!;
  const serialized = JSON.stringify(stored);
  for (const token of [created.hostToken, ...Object.values(created.memberTokens)]) assert.ok(!serialized.includes(token));
  assert.equal(stored.credentials.length, created.room.members.length + 1);
  const read = await service.read(created.room.id, created.hostToken);
  assert.deepEqual(read.role, { kind: "host" });
  assert.ok(!("hostToken" in read));
  assert.ok(!("memberTokens" in read));
  assert.ok(!("credentials" in read));
});

test("credentials are scoped to a room, with unknown and invalid access rejected", async () => {
  const { service } = setup();
  const first = await service.create({ mode: "demo" });
  const second = await service.create({ mode: "demo" });
  await assert.rejects(() => service.read(first.room.id, second.hostToken), status(401));
  await assert.rejects(() => service.read(first.room.id, "invalid"), status(401));
  await assert.rejects(() => service.read(crypto.randomUUID(), first.hostToken), status(404));
  assert.deepEqual((await service.read(first.room.id, first.memberTokens.maya)).role, { kind: "member", memberId: "maya" });
});

test("a legal prototype-like member ID still gets a usable token", async () => {
  const { service } = setup();
  const members = liveMembers();
  members[0].id = "__proto__";
  members[0].offer.ownerId = "__proto__";
  const created = await service.create({ mode: "live", title: "Shared shelf", members });
  assert.ok(Object.hasOwn(created.memberTokens, "__proto__"));
  assert.match(created.memberTokens.__proto__, /^[a-f0-9]{64}$/);
  const session = await service.read(created.room.id, created.memberTokens.__proto__);
  assert.deepEqual(session.role, { kind: "member", memberId: "__proto__" });
});

test("live creation requires unique members and physical copies", async () => {
  const { service, repository } = setup();
  const duplicateMembers = liveMembers();
  duplicateMembers[1].id = duplicateMembers[0].id;
  duplicateMembers[1].offer.ownerId = duplicateMembers[0].id;
  await assert.rejects(() => service.create({ mode: "live", title: "Duplicate reader", members: duplicateMembers }), /different ID/);
  const duplicateCopies = liveMembers();
  duplicateCopies[1].offer.id = duplicateCopies[0].offer.id;
  await assert.rejects(() => service.create({ mode: "live", title: "Duplicate copy", members: duplicateCopies }), /different ID/);
  assert.equal(repository.records.size, 0);
  const duplicateWork = liveMembers();
  duplicateWork[1].offer.entityId = duplicateWork[0].offer.entityId;
  assert.equal((await service.create({ mode: "live", title: "Two copies of one work", members: duplicateWork })).room.members.length, 2);
});

test("live creation checks book ownership, seed UUIDs, book UUIDs and room bounds", async () => {
  const { service, repository } = setup();
  for (const corrupt of [
    (members: Member[]) => { members[0].offer.ownerId = members[1].id; },
    (members: Member[]) => { members[0].offer.entityId = "fixture-book"; },
    (members: Member[]) => { members[0].seeds[0].id = "fixture-interest"; },
  ]) {
    const members = liveMembers(); corrupt(members);
    await assert.rejects(() => service.create({ mode: "live", title: "Invalid identity", members }), /confirmed Qloo entities/);
  }
  for (const count of [0, 1, 9]) await assert.rejects(() => service.create({ mode: "live", title: "Wrong size", members: liveMembers(count) }));
  const emptySeeds = liveMembers(); emptySeeds[0].seeds = [];
  await assert.rejects(() => service.create({ mode: "live", title: "Missing tastes", members: emptySeeds }));
  await assert.rejects(() => service.create({ mode: "live", title: " ", members: liveMembers() }));
  assert.equal(repository.records.size, 0);
});

test("live hosts cannot act as readers and readers cannot act as each other", async () => {
  const { service, repository } = setup();
  const created = await service.create({ mode: "live", title: "Real readers", members: liveMembers() });
  const [first, second] = created.room.members;
  const forbidden: RoomAction[] = [
    { type: "choice", memberId: first.id, bookId: second.offer.id, value: "yes" },
    { type: "approve", memberId: first.id, fingerprint: "not-a-current-circle" },
    { type: "withdraw", memberId: first.id },
    { type: "restore", memberId: first.id },
    { type: "update_member", memberId: first.id, member: first },
  ];
  for (const action of forbidden) {
    await assert.rejects(() => service.act(created.room.id, created.hostToken, 0, action), status(403));
    await assert.rejects(() => service.act(created.room.id, created.memberTokens[second.id], 0, action), status(403));
  }
  assert.equal(repository.writes, 0);
});

test("only hosts can refresh rankings and plan, including in demo rooms", async () => {
  const { service, repository } = setup();
  const created = await service.create({ mode: "demo" });
  for (const type of ["rank", "plan"] as const) await assert.rejects(() => service.act(created.room.id, created.memberTokens.maya, 0, { type }), status(403));
  assert.equal(repository.limits.size, 0);
  assert.equal(repository.writes, 0);
  assert.equal((await act(service, created, created.hostToken, { type: "plan" })).revision, 1);
});

test("demo hosts may explicitly simulate a reader choice", async () => {
  const { service } = setup();
  const created = await service.create({ mode: "demo" });
  await act(service, created, created.hostToken, { type: "rank" });
  const result = await act(service, created, created.hostToken, { type: "choice", memberId: "noor", bookId: "book-jules", value: "yes" });
  assert.equal(result.plan!.matchedCount, 6);
  assert.equal(result.mode, "demo");
  assert.ok(result.rankings.every((item) => item.source === "fixture"));
});

test("each live reader can choose and approve only their exact current exchange", async () => {
  const { service } = setup();
  const created = await service.create({ mode: "live", title: "Independent approvals", members: liveMembers() });
  const result = await approvedPair(service, created);
  assert.equal(result.plan!.matchedCount, 2);
  assert.equal(result.approvals.length, 2);
  assert.deepEqual(result.approvals.map((approval) => approval.memberId).sort(), created.room.members.map((member) => member.id).sort());
  const member = created.room.members[0];
  await assert.rejects(() => service.act(created.room.id, created.memberTokens[member.id], result.revision, { type: "approve", memberId: member.id, fingerprint: `${result.plan!.cycles[0].fingerprint}-old` }), /changed/);
});

test("live rooms reject a fixture provider and save no fabricated success", async () => {
  const { service, repository } = setup(() => new FixtureTasteProvider());
  const created = await service.create({ mode: "live", title: "No fallback", members: liveMembers() });
  await assert.rejects(() => service.act(created.room.id, created.hostToken, 0, { type: "rank" }), /Sample rankings cannot replace/);
  const current = repository.records.get(created.room.id)!.room;
  assert.equal(current.revision, 0);
  assert.equal(current.rankings.length, 0);
  assert.equal(repository.writes, 0);
});

test("stale browser revisions are rejected before any state change", async () => {
  const { service, repository } = setup();
  const created = await service.create({ mode: "demo" });
  await act(service, created, created.hostToken, { type: "plan" });
  const before = structuredClone(repository.records.get(created.room.id));
  await assert.rejects(() => service.act(created.room.id, created.hostToken, 0, { type: "withdraw", memberId: "maya" }), status(409));
  assert.deepEqual(repository.records.get(created.room.id), before);
});

test("compare-and-swap rejects a write that becomes stale after the read", async () => {
  const { service, repository } = setup();
  const created = await service.create({ mode: "demo" });
  repository.conflictBeforeNextSave = true;
  await assert.rejects(() => service.act(created.room.id, created.hostToken, 0, { type: "withdraw", memberId: "maya" }), status(409));
  const current = repository.records.get(created.room.id)!.room;
  assert.equal(current.title, "Changed in another tab");
  assert.equal(current.revision, 1);
  assert.equal(current.members.find((member) => member.id === "maya")!.active, true);
  assert.equal(repository.writes, 0);
});

test("two requests from the same snapshot cannot both commit", async () => {
  const { service, repository } = setup();
  const created = await service.create({ mode: "demo" });
  const results = await Promise.allSettled([
    service.act(created.room.id, created.hostToken, 0, { type: "withdraw", memberId: "maya" }),
    service.act(created.room.id, created.hostToken, 0, { type: "withdraw", memberId: "leo" }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(status(409)(rejected.reason));
  const current = repository.records.get(created.room.id)!.room;
  assert.equal(current.revision, 1);
  assert.equal(current.members.filter((member) => !member.active).length, 1);
});

test("changing a book or tastes clears rankings, reading choices and all approvals", async () => {
  const { service } = setup();
  const created = await service.create({ mode: "live", title: "Changed offer", members: liveMembers() });
  const approved = await approvedPair(service, created);
  const owner = approved.members[0];
  const changed = { ...owner, seeds: owner.seeds.map((seed, index) => index === 0 ? { ...seed, id: crypto.randomUUID(), name: "A new favorite" } : seed) };
  const result = await service.act(created.room.id, created.memberTokens[owner.id], approved.revision, { type: "update_member", memberId: owner.id, member: changed });
  assert.deepEqual(result.room.rankings, []);
  assert.deepEqual(result.room.choices, []);
  assert.deepEqual(result.room.approvals, []);
  assert.equal(result.room.plan, null);
  assert.equal(result.room.question, null);
  await assert.rejects(() => service.act(created.room.id, created.memberTokens[owner.id], result.room.revision, { type: "approve", memberId: owner.id, fingerprint: approved.plan!.cycles[0].fingerprint }), /changed/);
});

test("a member update cannot transfer a physical copy, change IDs or insert fixture identities into live rooms", async () => {
  const { service, repository } = setup();
  const created = await service.create({ mode: "live", title: "Fixed ownership", members: liveMembers() });
  const owner = created.room.members[0];
  for (const changed of [
    { ...owner, id: "another-reader" },
    { ...owner, offer: { ...owner.offer, id: "another-copy" } },
    { ...owner, offer: { ...owner.offer, ownerId: created.room.members[1].id } },
    { ...owner, offer: { ...owner.offer, entityId: "fixture-book" } },
  ]) await assert.rejects(() => service.act(created.room.id, created.memberTokens[owner.id], 0, { type: "update_member", memberId: owner.id, member: changed }));
  assert.equal(repository.writes, 0);
});

test("only the room host can delete it and deletion invalidates every capability", async () => {
  const { service, repository } = setup();
  const created = await service.create({ mode: "demo" });
  await assert.rejects(() => service.remove(created.room.id, created.memberTokens.maya), status(403));
  await assert.rejects(() => service.remove(created.room.id, "0".repeat(64)), status(401));
  assert.ok(repository.records.has(created.room.id));
  await service.remove(created.room.id, created.hostToken);
  assert.ok(!repository.records.has(created.room.id));
  for (const token of [created.hostToken, created.memberTokens.maya]) await assert.rejects(() => service.read(created.room.id, token), status(404));
});

test("the room ranking budget is enforced before another provider run", async () => {
  let calls = 0;
  class CountingProvider extends FixtureTasteProvider {
    async rank(member: Member, offers: BookOffer[]) { calls++; return super.rank(member, offers); }
  }
  const { service } = setup(() => new CountingProvider());
  const created = await service.create({ mode: "demo" });
  for (let index = 0; index < 8; index++) await act(service, created, created.hostToken, { type: "rank" });
  assert.equal(calls, 48);
  await assert.rejects(() => act(service, created, created.hostToken, { type: "rank" }), status(429));
  assert.equal(calls, 48);
});

test("authored demo reproduces 2 to 6 matches and a consent-safe 5-person repair", async () => {
  const { service } = setup();
  const created = await service.create({ mode: "demo" });
  let current = await act(service, created, created.hostToken, { type: "rank" });
  assert.equal(current.plan!.matchedCount, 2);
  assert.equal(current.plan!.directSwapCount, 2);
  assert.deepEqual([current.question!.memberId, current.question!.bookId], ["noor", "book-jules"]);
  current = await act(service, created, created.hostToken, { type: "choice", memberId: "noor", bookId: "book-jules", value: "yes" });
  assert.equal(current.plan!.matchedCount, 6);
  assert.equal(current.plan!.directSwapCount, 2);
  for (const circle of current.plan!.cycles) for (const memberId of circle.memberIds) {
    current = await act(service, created, created.hostToken, { type: "approve", memberId, fingerprint: circle.fingerprint });
  }
  current = await act(service, created, created.hostToken, { type: "withdraw", memberId: "noor" });
  assert.equal(current.plan!.matchedCount, 2);
  assert.deepEqual(current.approvals.map((approval) => approval.memberId).sort(), ["iris", "sam"]);
  assert.deepEqual([current.question!.memberId, current.question!.bookId], ["leo", "book-jules"]);
  current = await act(service, created, created.hostToken, { type: "choice", memberId: "leo", bookId: "book-jules", value: "yes" });
  assert.equal(current.plan!.matchedCount, 5);
  assert.equal(current.plan!.directSwapCount, 2);
  assert.deepEqual(current.approvals.map((approval) => approval.memberId).sort(), ["iris", "sam"]);
  assert.ok(!current.plan!.matchedMemberIds.includes("noor"));
});
