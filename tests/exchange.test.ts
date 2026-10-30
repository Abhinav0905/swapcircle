import assert from "node:assert/strict";
import test from "node:test";
import type { BookOffer, ExchangePlan, ExchangeRoom, Member, RankingEvidence, SwapEdge, TasteProvider } from "@/lib/domain/types";
import { ExchangeAgent } from "@/lib/agent/ExchangeAgent";
import { BridgeQuestionPlanner } from "@/lib/exchange/BridgeQuestionPlanner";
import { ConsentService } from "@/lib/exchange/ConsentService";
import { CycleEnumerator } from "@/lib/exchange/CycleEnumerator";
import { ExchangeOptimizer } from "@/lib/exchange/ExchangeOptimizer";
import { PreferenceGraphBuilder, type PreferenceGraph } from "@/lib/exchange/PreferenceGraphBuilder";

const now = "2026-10-30T21:00:00.000Z";

function member(id: string): Member {
  return {
    id, name: `Member ${id}`, color: "#234", active: true,
    seeds: [{ id: `seed-${id}`, name: `Artist ${id}`, type: "artist" }],
    offer: { id: `book-${id}`, ownerId: id, title: `Book ${id}`, author: `Author ${id}`, entityId: `entity-${id}`, condition: "Good", color: "#234", available: true },
  };
}

function evidence(reader: Member, offers: BookOffer[]): RankingEvidence {
  return {
    id: `evidence-${reader.id}`, memberId: reader.id, source: "fixture", fetchedAt: now,
    seeds: structuredClone(reader.seeds), requestedBookIds: offers.map((offer) => offer.id),
    entries: offers.map((offer, index) => ({ bookId: offer.id, entityId: offer.entityId, rank: index + 1, providerScore: null, explanation: null })),
    missingBookIds: [], warnings: [], request: { endpoint: "fixture", parameters: {} },
  };
}

function room(ids = ["a", "b", "c", "d"]): ExchangeRoom {
  const members = ids.map(member);
  return {
    id: "room-test", title: "Test exchange", mode: "demo", revision: 1, createdAt: now,
    members, rankings: members.map((reader) => evidence(reader, members.filter((giver) => giver.id !== reader.id).map((giver) => giver.offer))),
    choices: [], plan: null, approvals: [], question: null, events: [],
  };
}

function addYes(input: ExchangeRoom, giver: string, recipient: string): ExchangeRoom {
  return { ...input, choices: [...input.choices, { memberId: recipient, bookId: `book-${giver}`, value: "yes", updatedAt: now }] };
}

function graph(ids: string[], pairs: [string, string, number?][]): PreferenceGraph {
  return {
    memberIds: ids,
    edges: pairs.map(([giverId, recipientId, rank]) => ({ giverId, recipientId, bookId: `book-${giverId}`, recipientRank: rank ?? 1, evidenceId: `evidence-${recipientId}` })),
  };
}

class TestProvider implements TasteProvider {
  readonly source = "fixture" as const;
  async search() { return []; }
  async rank(reader: Member, offers: BookOffer[]) { return evidence(reader, offers); }
}

function assertPlan(plan: ExchangePlan, input: PreferenceGraph): void {
  const giving = new Set<string>();
  const receiving = new Set<string>();
  const books = new Set<string>();
  for (const cycle of plan.cycles) {
    assert.ok(cycle.memberIds.length >= 2 && cycle.memberIds.length <= 4);
    for (const edge of cycle.edges) {
      assert.notEqual(edge.giverId, edge.recipientId);
      assert.ok(!giving.has(edge.giverId));
      assert.ok(!receiving.has(edge.recipientId));
      assert.ok(!books.has(edge.bookId));
      assert.ok(input.edges.some((allowed) => allowed.giverId === edge.giverId && allowed.recipientId === edge.recipientId && allowed.bookId === edge.bookId));
      giving.add(edge.giverId); receiving.add(edge.recipientId); books.add(edge.bookId);
    }
  }
  assert.deepEqual([...giving].sort(), [...receiving].sort());
  assert.deepEqual(plan.matchedMemberIds, [...giving].sort());
  assert.equal(plan.matchedCount, giving.size);
}

test("Qloo suggestions alone do not create exchange edges", () => {
  const input = room();
  const result = new PreferenceGraphBuilder().build(input);
  assert.equal(result.edges.length, 0);
  assert.equal(new ExchangeOptimizer().solve(result).matchedCount, 0);
});

test("only explicit yes choices with matching, present evidence create edges", () => {
  let input = addYes(room(), "a", "b");
  input = addYes(input, "b", "c");
  input.choices.push({ memberId: "a", bookId: "book-c", value: "no", updatedAt: now });
  input.rankings.find((item) => item.memberId === "c")!.missingBookIds.push("book-b");
  assert.deepEqual(new PreferenceGraphBuilder().build(input).edges.map((edge) => [edge.giverId, edge.recipientId]), [["a", "b"]]);
  input.rankings.find((item) => item.memberId === "b")!.entries.find((item) => item.bookId === "book-a")!.entityId = "wrong-work";
  assert.equal(new PreferenceGraphBuilder().build(input).edges.length, 0);
});

test("old seed evidence and fixture evidence in live rooms cannot create edges", () => {
  const input = addYes(room(), "a", "b");
  const live = { ...input, mode: "live" as const };
  assert.equal(new PreferenceGraphBuilder().build(live).edges.length, 0);
  input.members.find((item) => item.id === "b")!.seeds[0].id = "new-interest";
  assert.equal(new PreferenceGraphBuilder().build(input).edges.length, 0);
});

test("contradictory imported choices cannot override a decline", () => {
  const input = addYes(room(), "a", "b");
  input.choices.push({ memberId: "b", bookId: "book-a", value: "no", updatedAt: now });
  assert.equal(new PreferenceGraphBuilder().build(input).edges.length, 0);
});

test("a three-person circle succeeds when direct swaps cannot", () => {
  const input = graph(["a", "b", "c", "d"], [["a", "b"], ["b", "c"], ["c", "a"]]);
  const result = new ExchangeOptimizer().solve(input);
  assert.equal(result.matchedCount, 3);
  assert.equal(result.directSwapCount, 0);
  assert.deepEqual(result.unmatchedMemberIds, ["d"]);
  assertPlan(result, input);
});

test("enumeration produces no duplicate rotations and rejects five-person circles", () => {
  const input = graph(["a", "b", "c", "d", "e"], [["a", "b"], ["b", "c"], ["c", "d"], ["d", "e"], ["e", "a"]]);
  assert.equal(new CycleEnumerator().enumerate(input).length, 0);
  const complete = graph(["a", "b", "c"], [["a", "b"], ["b", "a"], ["a", "c"], ["c", "a"], ["b", "c"], ["c", "b"]]);
  const result = new CycleEnumerator().enumerate(complete);
  assert.equal(result.length, 5); // Three pairs and two directed triples.
  assert.equal(new Set(result.map((cycle) => cycle.fingerprint)).size, 5);
});

test("physical copies with the same Qloo entity remain separate offers", () => {
  let input = room(["a", "b"]);
  input.members[1].offer.entityId = input.members[0].offer.entityId;
  input.rankings = input.members.map((reader) => evidence(reader, input.members.filter((giver) => giver.id !== reader.id).map((giver) => giver.offer)));
  input = addYes(addYes(input, "a", "b"), "b", "a");
  const result = new ExchangeOptimizer().solve(new PreferenceGraphBuilder().build(input));
  assert.equal(result.matchedCount, 2);
  assert.deepEqual(result.cycles[0].edges.map((edge) => edge.bookId).sort(), ["book-a", "book-b"]);
});

test("stable tie resolution ignores input ordering", () => {
  const input = graph(["a", "b", "c", "d"], [["a", "b"], ["b", "a"], ["c", "d"], ["d", "c"], ["a", "c"], ["c", "a"], ["b", "d"], ["d", "b"]]);
  const optimizer = new ExchangeOptimizer();
  assert.deepEqual(optimizer.solve(input), optimizer.solve({ memberIds: [...input.memberIds].reverse(), edges: [...input.edges].reverse() }));
});

test("repair preserves assignments before improving ordinal rank", () => {
  const initial = graph(["a", "b", "c", "d"], [["a", "b", 2], ["b", "a", 2], ["c", "d", 2], ["d", "c", 2]]);
  const optimizer = new ExchangeOptimizer();
  const previous = optimizer.solve(initial);
  const expanded = { ...initial, edges: [...initial.edges, ...graph(initial.memberIds, [["a", "c"], ["c", "a"], ["b", "d"], ["d", "b"]]).edges] };
  const repaired = optimizer.solve(expanded, previous);
  assert.equal(repaired.changedAssignments, 0);
  assert.deepEqual(repaired.cycles, previous.cycles);
});

test("approvals bind to exact circles and stale fingerprints are rejected", () => {
  const agent = new ExchangeAgent(new TestProvider());
  let input = addYes(addYes(addYes(room(), "a", "b"), "b", "c"), "c", "a");
  input = agent.plan(input);
  const fingerprint = input.plan!.cycles[0].fingerprint;
  input = agent.approve(input, "a", fingerprint);
  assert.equal(input.approvals.length, 1);
  assert.throws(() => agent.approve(input, "d", fingerprint), /changed/);
  assert.throws(() => agent.approve(input, "a", `${fingerprint}-old`), /changed/);
  input = agent.choose(input, "b", "book-a", "no");
  assert.equal(input.approvals.length, 0);
  assert.equal(input.plan!.matchedCount, 0);
  assert.throws(() => agent.approve(input, "a", fingerprint), /changed/);
});

test("withdrawal repairs its circle and preserves an independent fully approved swap", () => {
  const agent = new ExchangeAgent(new TestProvider());
  let input = room(["a", "b", "c", "d", "e", "f"]);
  for (const [giver, recipient] of [["a", "b"], ["b", "c"], ["c", "a"], ["b", "d"], ["d", "a"], ["e", "f"], ["f", "e"]]) input = addYes(input, giver, recipient);
  // Make the initial c circle preferred to d before any approval exists.
  input.rankings.find((item) => item.memberId === "a")!.entries.find((item) => item.bookId === "book-d")!.rank = 5;
  input = agent.plan(input);
  const protectedCircle = input.plan!.cycles.find((cycle) => cycle.memberIds.includes("e"))!;
  const changedCircle = input.plan!.cycles.find((cycle) => cycle.memberIds.includes("c"))!;
  assert.ok(changedCircle);
  for (const memberId of [...protectedCircle.memberIds, ...changedCircle.memberIds]) {
    input = agent.approve(input, memberId, protectedCircle.memberIds.includes(memberId) ? protectedCircle.fingerprint : changedCircle.fingerprint);
  }
  const before = structuredClone(input);
  const result = agent.withdraw(input, "c");
  assert.deepEqual(input, before);
  assert.equal(result.plan!.matchedCount, 5);
  assert.ok(result.plan!.cycles.some((cycle) => cycle.fingerprint === protectedCircle.fingerprint));
  assert.ok(result.plan!.cycles.some((cycle) => cycle.memberIds.includes("d")));
  assert.deepEqual(result.approvals.map((approval) => approval.memberId).sort(), ["e", "f"]);
  assert.ok(!result.plan!.matchedMemberIds.includes("c"));
  const restored = agent.restore(result, "c");
  assert.ok(!restored.approvals.some((approval) => approval.memberId === "c"));
});

test("a fully approved circle remains protected even if another arrangement covers more people", () => {
  const input = graph(["a", "b", "c", "d"], [["a", "b"], ["b", "a"], ["a", "c"], ["c", "d"], ["d", "b"]]);
  const optimizer = new ExchangeOptimizer();
  const locked = new CycleEnumerator().enumerate(input).filter((cycle) => cycle.memberIds.length === 2);
  assert.equal(optimizer.solve(input).matchedCount, 4);
  assert.equal(optimizer.solve(input, null, locked).matchedCount, 2);
});

test("bridge question asks about one unreviewed evidenced book, never a declined book", () => {
  const input = addYes(addYes(room(["a", "b", "c"]), "a", "b"), "b", "c");
  const builder = new PreferenceGraphBuilder();
  const current = builder.build(input);
  const plan = new ExchangeOptimizer().solve(current);
  const planner = new BridgeQuestionPlanner();
  const question = planner.find(input, current, plan);
  assert.ok(question);
  const improved = new ExchangeAgent(new TestProvider()).choose(input, question.memberId, question.bookId, "yes");
  assert.ok(improved.plan!.matchedCount > plan.matchedCount);
  const declined = { ...input, choices: [...input.choices, { memberId: question.memberId, bookId: question.bookId, value: "no" as const, updatedAt: now }] };
  const next = planner.find(declined, builder.build(declined), plan);
  assert.notDeepEqual(next && [next.memberId, next.bookId], [question.memberId, question.bookId]);
  const allReviewed = { ...input, choices: input.members.flatMap((reader) => input.members.filter((giver) => reader.id !== giver.id).map((giver) => ({ memberId: reader.id, bookId: giver.offer.id, value: "no" as const, updatedAt: now }))) };
  assert.equal(planner.find(allReviewed, builder.build(allReviewed), plan), null);
});

test("rank refresh is atomic on provider error and never substitutes fixtures in live mode", async () => {
  class BrokenProvider extends TestProvider {
    async rank(reader: Member, offers: BookOffer[]) {
      if (reader.id === "b") throw new Error("Provider is unavailable");
      return evidence(reader, offers);
    }
  }
  const input = room();
  const before = structuredClone(input);
  await assert.rejects(() => new ExchangeAgent(new BrokenProvider()).rank(input), /unavailable/);
  assert.deepEqual(input, before);
  await assert.rejects(() => new ExchangeAgent(new TestProvider()).rank({ ...input, mode: "live" }), /Sample rankings/);
});

test("refreshed evidence cannot fabricate requests or become consent", async () => {
  const input = room();
  const result = await new ExchangeAgent(new TestProvider()).rank(input);
  assert.equal(result.rankings.length, 4);
  assert.equal(result.plan!.matchedCount, 0);
  assert.equal(result.choices.length, 0);
  class WrongProvider extends TestProvider {
    async rank(reader: Member, offers: BookOffer[]) {
      return { ...evidence(reader, offers), requestedBookIds: ["outside-offer"] };
    }
  }
  await assert.rejects(() => new ExchangeAgent(new WrongProvider()).rank(input), /different request/);
});

test("out-of-pool choices, own books and missing evidence are rejected", () => {
  const input = room();
  const agent = new ExchangeAgent(new TestProvider());
  assert.throws(() => agent.choose(input, "a", "book-a", "yes"), /another member/);
  assert.throws(() => agent.choose(input, "a", "imagined-book", "yes"), /another member/);
  assert.throws(() => agent.choose({ ...input, rankings: [] }, "a", "book-b", "yes"), /evidence/);
  assert.equal(agent.choose({ ...input, rankings: [] }, "a", "book-b", "no").choices.length, 1);
});

test("duplicate physical IDs and oversized rooms are rejected", () => {
  const duplicate = room();
  duplicate.members[1].offer.id = duplicate.members[0].offer.id;
  assert.throws(() => new PreferenceGraphBuilder().build(duplicate), /unique offer/);
  assert.throws(() => new PreferenceGraphBuilder().build(room(Array.from({ length: 9 }, (_, i) => String(i)))), /at most eight/);
});

interface Objective { matched: number; changed: number; worst: number; sum: number; }

/** Independent oracle: enumerate subsets and all bijections of books to recipients.
 * This does not use the production cycle enumerator or partition search. */
function bruteForce(input: PreferenceGraph, maxLength: number, previous: ExchangePlan | null = null): Objective {
  const ids = input.memberIds;
  const lookup = new Map(input.edges.map((edge) => [`${edge.giverId}:${edge.recipientId}`, edge]));
  const previousAssignments = new Map(previous?.cycles.flatMap((cycle) => cycle.edges.map((edge) => [edge.recipientId, edge.bookId] as const)) ?? []);
  let best: Objective = { matched: 0, changed: previous ? previousAssignments.size : 0, worst: 0, sum: 0 };
  const better = (a: Objective, b: Objective) => a.matched > b.matched || (a.matched === b.matched && (a.changed < b.changed || (a.changed === b.changed && (a.worst < b.worst || (a.worst === b.worst && a.sum < b.sum)))));
  for (let mask = 0; mask < 1 << ids.length; mask++) {
    const subset = ids.filter((_, index) => mask & (1 << index));
    const inspect = (donors: string[]): void => {
      const edges: SwapEdge[] = [];
      for (let index = 0; index < subset.length; index++) {
        const edge = lookup.get(`${donors[index]}:${subset[index]}`);
        if (!edge || donors[index] === subset[index]) return;
        edges.push(edge);
      }
      const next = new Map(edges.map((edge) => [edge.giverId, edge.recipientId]));
      const visited = new Set<string>();
      for (const start of subset) {
        if (visited.has(start)) continue;
        let cursor = start;
        let length = 0;
        do {
          visited.add(cursor); length++;
          cursor = next.get(cursor)!;
        } while (cursor !== start && length <= subset.length);
        if (length < 2 || length > maxLength) return;
      }
      const assigned = new Map(edges.map((edge) => [edge.recipientId, edge.bookId]));
      const candidate = {
        matched: subset.length,
        changed: previous ? ids.reduce((count, id) => count + Number(previousAssignments.get(id) !== assigned.get(id)), 0) : 0,
        worst: Math.max(0, ...edges.map((edge) => edge.recipientRank)),
        sum: edges.reduce((sum, edge) => sum + edge.recipientRank, 0),
      };
      if (better(candidate, best)) best = candidate;
    };
    const permutations = (prefix: string[], remaining: string[]): void => {
      if (remaining.length === 0) return inspect(prefix);
      for (let index = 0; index < remaining.length; index++) permutations([...prefix, remaining[index]], remaining.filter((_, other) => other !== index));
    };
    permutations([], subset);
  }
  return best;
}

test("exact optimizer agrees with an independent brute-force oracle on 120 seeded graphs", () => {
  let state = 81723;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const optimizer = new ExchangeOptimizer();
  for (let run = 0; run < 120; run++) {
    const count = 2 + run % 5;
    const ids = Array.from({ length: count }, (_, index) => String(index));
    const edges: [string, string, number][] = [];
    for (const giver of ids) for (const recipient of ids) {
      if (giver !== recipient && random() < 0.48) edges.push([giver, recipient, 1 + Math.floor(random() * (count - 1))]);
    }
    const input = graph(ids, edges);
    const result = optimizer.solve(input);
    const oracle = bruteForce(input, 4);
    const selectedEdges = result.cycles.flatMap((cycle) => cycle.edges);
    assert.deepEqual({ matched: result.matchedCount, changed: result.changedAssignments, worst: Math.max(0, ...selectedEdges.map((edge) => edge.recipientRank)), sum: selectedEdges.reduce((sum, edge) => sum + edge.recipientRank, 0) }, oracle, `graph ${run}`);
    assert.equal(result.directSwapCount, bruteForce(input, 2).matched, `direct graph ${run}`);
    assert.ok(result.matchedCount >= result.directSwapCount);
    assertPlan(result, input);
    const reduced = { ...input, edges: input.edges.filter(() => random() < 0.75) };
    const repaired = optimizer.solve(reduced, result);
    const repairEdges = repaired.cycles.flatMap((cycle) => cycle.edges);
    assert.deepEqual({ matched: repaired.matchedCount, changed: repaired.changedAssignments, worst: Math.max(0, ...repairEdges.map((edge) => edge.recipientRank)), sum: repairEdges.reduce((sum, edge) => sum + edge.recipientRank, 0) }, bruteForce(reduced, 4, result), `repair graph ${run}`);
  }
});
