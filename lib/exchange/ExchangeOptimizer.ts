import type { ExchangePlan, SwapCycle } from "@/lib/domain/types";
import type { PreferenceGraph } from "./PreferenceGraphBuilder";
import { CycleEnumerator } from "./CycleEnumerator";
import { ExchangeError } from "./ExchangeError";

interface Candidate {
  cycles: SwapCycle[];
  matched: number;
  changed: number;
  worstRank: number;
  rankSum: number;
  stableKey: string;
}

/** Exact bounded allocation. Qloo scores are never added or compared across people. */
export class ExchangeOptimizer {
  constructor(private readonly enumerator = new CycleEnumerator()) {}

  solve(graph: PreferenceGraph, previous: ExchangePlan | null = null, locked: SwapCycle[] = []): ExchangePlan {
    const cycles = this.enumerator.enumerate(graph);
    const currentByFingerprint = new Map(cycles.map((cycle) => [cycle.fingerprint, cycle]));
    const lockedMembers = new Set<string>();
    const protectedCycles = locked.map((cycle) => {
      const current = currentByFingerprint.get(cycle.fingerprint);
      if (!current) throw new ExchangeError("A protected exchange is no longer possible. Review its participants first.");
      for (const memberId of current.memberIds) {
        if (lockedMembers.has(memberId)) throw new ExchangeError("Protected exchanges cannot share a member.");
        lockedMembers.add(memberId);
      }
      return current;
    });

    const chosen = this.optimize(graph.memberIds, cycles, previous, protectedCycles);
    const direct = this.optimize(graph.memberIds, cycles.filter((cycle) => cycle.memberIds.length === 2), null, []);
    const matchedMemberIds = chosen.cycles.flatMap((cycle) => cycle.memberIds).sort();
    const matched = new Set(matchedMemberIds);
    return {
      cycles: chosen.cycles,
      matchedMemberIds,
      unmatchedMemberIds: graph.memberIds.filter((id) => !matched.has(id)).sort(),
      // Number of people matched, not number of pairs: comparable with matchedCount.
      directSwapCount: direct.matched,
      matchedCount: chosen.matched,
      changedAssignments: chosen.changed,
    };
  }

  private optimize(memberIds: string[], cycles: SwapCycle[], previous: ExchangePlan | null, locked: SwapCycle[]): Candidate {
    const ids = [...memberIds].sort();
    const bit = new Map(ids.map((id, index) => [id, 1 << index]));
    const maskFor = (cycle: SwapCycle) => cycle.memberIds.reduce((mask, id) => mask | (bit.get(id) ?? 0), 0);
    const previousAssignments = new Map(previous?.cycles.flatMap((cycle) => cycle.edges.map((edge) => [edge.recipientId, edge.bookId] as const)) ?? []);
    const lockedMask = locked.reduce((mask, cycle) => mask | maskFor(cycle), 0);
    const usable = cycles.map((cycle) => ({ cycle, mask: maskFor(cycle) })).filter(({ mask }) => (mask & lockedMask) === 0);
    const byMember = new Map(ids.map((id) => [id, usable.filter(({ cycle }) => cycle.memberIds.includes(id))]));
    let best: Candidate | null = null;

    const evaluate = (selected: SwapCycle[]): Candidate => {
      const ordered = [...selected].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
      const edges = ordered.flatMap((cycle) => cycle.edges);
      const assignments = new Map(edges.map((edge) => [edge.recipientId, edge.bookId]));
      const changed = previous ? ids.reduce((count, id) => count + (previousAssignments.get(id) !== assignments.get(id) ? 1 : 0), 0) : 0;
      return {
        cycles: ordered,
        matched: edges.length,
        changed,
        worstRank: edges.reduce((worst, edge) => Math.max(worst, edge.recipientRank), 0),
        rankSum: edges.reduce((sum, edge) => sum + edge.recipientRank, 0),
        stableKey: ordered.map((cycle) => cycle.fingerprint).join("|"),
      };
    };

    // At most eight people: enumerate disjoint partitions by handling the first free
    // member. The unmatched branch is necessary; a feasible exchange is not forced.
    const visit = (handledMask: number, selected: SwapCycle[]): void => {
      const next = ids.find((id) => (handledMask & bit.get(id)!) === 0);
      if (!next) {
        const candidate = evaluate(selected);
        if (!best || this.isBetter(candidate, best)) best = candidate;
        return;
      }
      visit(handledMask | bit.get(next)!, selected);
      for (const { cycle, mask } of byMember.get(next) ?? []) {
        if ((handledMask & mask) === 0) visit(handledMask | mask, [...selected, cycle]);
      }
    };
    visit(lockedMask, protectedCopy(locked));
    return best ?? evaluate(locked);
  }

  private isBetter(a: Candidate, b: Candidate): boolean {
    if (a.matched !== b.matched) return a.matched > b.matched;
    if (a.changed !== b.changed) return a.changed < b.changed;
    if (a.worstRank !== b.worstRank) return a.worstRank < b.worstRank;
    if (a.rankSum !== b.rankSum) return a.rankSum < b.rankSum;
    return a.stableKey < b.stableKey;
  }
}

function protectedCopy(cycles: SwapCycle[]): SwapCycle[] {
  return cycles.map((cycle) => ({ ...cycle, memberIds: [...cycle.memberIds], edges: cycle.edges.map((edge) => ({ ...edge })) }));
}
