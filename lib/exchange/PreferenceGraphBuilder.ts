import type { ExchangeRoom, RankingEntry, RankingEvidence, SwapEdge } from "@/lib/domain/types";
import { ExchangeError } from "./ExchangeError";

export interface PreferenceGraph {
  memberIds: string[];
  edges: SwapEdge[];
}

/** Suggestions establish evidence. A person's separate yes establishes an edge. */
export class PreferenceGraphBuilder {
  build(room: ExchangeRoom): PreferenceGraph {
    this.validateMembers(room);
    const available = room.members.filter((member) => member.active && member.offer.available);
    const memberIds = available.map((member) => member.id).sort();
    const participants = new Set(memberIds);
    const edges: SwapEdge[] = [];

    for (const recipient of available) {
      const evidence = this.evidenceFor(room, recipient.id);
      if (!evidence) continue;
      for (const giver of available) {
        if (giver.id === recipient.id) continue;
        const choices = room.choices.filter((item) => item.memberId === recipient.id && item.bookId === giver.offer.id);
        // Duplicate or contradictory imported choices are not a usable yes.
        if (choices.length !== 1 || choices[0].value !== "yes") continue;
        const ranking = this.entryFor(evidence, giver.offer.id, giver.offer.entityId);
        if (!ranking || !participants.has(giver.id)) continue;
        edges.push({
          giverId: giver.id,
          recipientId: recipient.id,
          bookId: giver.offer.id,
          recipientRank: ranking.rank,
          evidenceId: evidence.id,
        });
      }
    }
    edges.sort((left, right) => this.edgeKey(left).localeCompare(this.edgeKey(right)));
    return { memberIds, edges };
  }

  evidenceFor(room: ExchangeRoom, memberId: string): RankingEvidence | undefined {
    const member = room.members.find((item) => item.id === memberId);
    if (!member) return undefined;
    const candidates = room.rankings.filter((item) => item.memberId === memberId);
    if (candidates.length !== 1) return undefined;
    const evidence = candidates[0];
    if (room.mode === "live" && evidence.source !== "qloo") return undefined;
    const seeds = (values: { id: string; type: string }[]) =>
      JSON.stringify(values.map((item) => [item.id, item.type]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    if (seeds(evidence.seeds) !== seeds(member.seeds)) return undefined;
    return evidence;
  }

  entryFor(evidence: RankingEvidence, bookId: string, entityId: string): RankingEntry | undefined {
    if (!evidence.requestedBookIds.includes(bookId) || evidence.missingBookIds.includes(bookId)) return undefined;
    const entries = evidence.entries.filter((item) => item.bookId === bookId);
    if (entries.length !== 1) return undefined;
    const entry = entries[0];
    if (entry.entityId !== entityId || !Number.isInteger(entry.rank) || entry.rank < 1) return undefined;
    return entry;
  }

  edgeKey(edge: Pick<SwapEdge, "giverId" | "recipientId" | "bookId">): string {
    return JSON.stringify([edge.giverId, edge.recipientId, edge.bookId]);
  }

  private validateMembers(room: ExchangeRoom): void {
    if (room.members.length > 8) throw new ExchangeError("An exchange supports at most eight members.", "member_limit");
    const memberIds = new Set<string>();
    const bookIds = new Set<string>();
    for (const member of room.members) {
      if (!member.id || memberIds.has(member.id)) throw new ExchangeError("Member identifiers must be unique.");
      if (!member.offer.id || bookIds.has(member.offer.id)) throw new ExchangeError("Each physical book needs a unique offer identifier.");
      if (member.offer.ownerId !== member.id) throw new ExchangeError("A book offer must belong to its member.");
      memberIds.add(member.id);
      bookIds.add(member.offer.id);
    }
  }
}
