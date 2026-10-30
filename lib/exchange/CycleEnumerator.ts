import type { SwapCycle, SwapEdge } from "@/lib/domain/types";
import type { PreferenceGraph } from "./PreferenceGraphBuilder";
import { ExchangeError } from "./ExchangeError";

/** Enumerates each directed cycle once, anchored at its smallest member ID. */
export class CycleEnumerator {
  enumerate(graph: PreferenceGraph, maxLength = 4): SwapCycle[] {
    if (graph.memberIds.length > 8) throw new ExchangeError("An exchange supports at most eight members.", "member_limit");
    if (!Number.isInteger(maxLength) || maxLength < 2 || maxLength > 4) throw new ExchangeError("Exchange circles must contain two to four members.");
    const memberIds = [...new Set(graph.memberIds)].sort();
    const known = new Set(memberIds);
    const outgoing = new Map(memberIds.map((memberId) => [memberId, [] as SwapEdge[]]));
    for (const edge of graph.edges) {
      if (edge.giverId !== edge.recipientId && known.has(edge.giverId) && known.has(edge.recipientId)) {
        outgoing.get(edge.giverId)!.push(edge);
      }
    }
    for (const edges of outgoing.values()) edges.sort((a, b) => a.recipientId.localeCompare(b.recipientId) || a.bookId.localeCompare(b.bookId));
    const cycles = new Map<string, SwapCycle>();

    for (const start of memberIds) {
      const visit = (current: string, path: string[], edges: SwapEdge[]): void => {
        for (const edge of outgoing.get(current) ?? []) {
          if (edge.recipientId === start) {
            if (path.length >= 2) {
              const cycle = this.create([...edges, edge]);
              cycles.set(cycle.fingerprint, cycle);
            }
          } else if (path.length < maxLength && edge.recipientId > start && !path.includes(edge.recipientId)) {
            visit(edge.recipientId, [...path, edge.recipientId], [...edges, edge]);
          }
        }
      };
      visit(start, [start], []);
    }
    return [...cycles.values()].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
  }

  create(edges: SwapEdge[]): SwapCycle {
    const sorted = [...edges].sort((a, b) => a.giverId.localeCompare(b.giverId) || a.recipientId.localeCompare(b.recipientId));
    // This is the full, lossless exchange identity. Consent does not depend on a short hash.
    const fingerprint = `swap-v1:${JSON.stringify(sorted.map(({ giverId, recipientId, bookId }) => [giverId, recipientId, bookId]))}`;
    return {
      id: `circle-${sorted.map((edge) => encodeURIComponent(edge.giverId)).join("-")}`,
      fingerprint,
      memberIds: sorted.map((edge) => edge.giverId),
      edges: edges.map((edge) => ({ ...edge })),
    };
  }
}
