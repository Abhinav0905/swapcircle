import type { BridgeQuestion, ExchangePlan, ExchangeRoom, SwapCycle, SwapEdge } from "@/lib/domain/types";
import { ExchangeOptimizer } from "./ExchangeOptimizer";
import { PreferenceGraphBuilder, type PreferenceGraph } from "./PreferenceGraphBuilder";

interface QuestionCandidate {
  question: BridgeQuestion;
  additionalMembers: number;
  changedAssignments: number;
  key: string;
}

/** Asks only about an unreviewed, evidenced book that would improve a feasible plan. */
export class BridgeQuestionPlanner {
  constructor(
    private readonly graphBuilder = new PreferenceGraphBuilder(),
    private readonly optimizer = new ExchangeOptimizer(),
  ) {}

  find(room: ExchangeRoom, graph: PreferenceGraph, plan: ExchangePlan, locked: SwapCycle[] = []): BridgeQuestion | null {
    if (plan.matchedCount === graph.memberIds.length) return null;
    const active = room.members.filter((member) => graph.memberIds.includes(member.id));
    const candidates: QuestionCandidate[] = [];
    for (const recipient of active) {
      const evidence = this.graphBuilder.evidenceFor(room, recipient.id);
      if (!evidence) continue;
      for (const giver of active) {
        if (giver.id === recipient.id || room.choices.some((choice) => choice.memberId === recipient.id && choice.bookId === giver.offer.id)) continue;
        const entry = this.graphBuilder.entryFor(evidence, giver.offer.id, giver.offer.entityId);
        if (!entry) continue;
        const edge: SwapEdge = {
          giverId: giver.id,
          recipientId: recipient.id,
          bookId: giver.offer.id,
          recipientRank: entry.rank,
          evidenceId: evidence.id,
        };
        const possible = this.optimizer.solve({ ...graph, edges: [...graph.edges, edge] }, plan, locked);
        if (possible.matchedCount <= plan.matchedCount) continue;
        const circle = possible.cycles.find((cycle) => cycle.edges.some((item) => item.giverId === giver.id && item.recipientId === recipient.id && item.bookId === giver.offer.id));
        if (!circle) continue;
        candidates.push({
          question: {
            memberId: recipient.id,
            bookId: giver.offer.id,
            connectsMemberIds: [...circle.memberIds],
            rank: entry.rank,
            reason: `If you want to read this book, a ${circle.memberIds.length}-person circle becomes possible. Everyone still approves their exact trade.`,
          },
          additionalMembers: possible.matchedCount - plan.matchedCount,
          changedAssignments: possible.changedAssignments,
          key: JSON.stringify([recipient.id, giver.offer.id]),
        });
      }
    }
    candidates.sort((a, b) =>
      b.additionalMembers - a.additionalMembers ||
      a.changedAssignments - b.changedAssignments ||
      a.question.rank - b.question.rank ||
      a.key.localeCompare(b.key),
    );
    return candidates[0]?.question ?? null;
  }
}
