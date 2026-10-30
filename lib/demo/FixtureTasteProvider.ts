import type { BookOffer, EntityType, Member, RankingEvidence, TasteEntity, TasteProvider } from "../domain/types";
import { DemoFactory } from "./DemoFactory";

const ORDERS: Record<string, string[]> = {
  maya: ["leo", "jules", "noor", "iris", "sam"],
  leo: ["noor", "jules", "iris", "sam", "maya"],
  noor: ["maya", "jules", "leo", "sam", "iris"],
  jules: ["maya", "noor", "sam", "leo", "iris"],
  iris: ["sam", "leo", "jules", "maya", "noor"],
  sam: ["iris", "maya", "noor", "leo", "jules"],
};

export class FixtureTasteProvider implements TasteProvider {
  readonly source = "fixture" as const;

  async search(query: string, type: EntityType): Promise<TasteEntity[]> {
    const all = DemoFactory.members().flatMap((member) => [
      ...member.seeds,
      { id: member.offer.entityId, name: member.offer.title, type: "book" as const, subtitle: member.offer.author },
    ]);
    return all.filter((entity) => entity.type === type && entity.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  }

  async rank(member: Member, offers: BookOffer[]): Promise<RankingEvidence> {
    const available = offers.filter((offer) => offer.ownerId !== member.id && offer.available);
    const order = ORDERS[member.id] ?? [];
    const ordered = [...available].sort((a, b) => order.indexOf(a.ownerId) - order.indexOf(b.ownerId));
    return {
      id: `fixture-${crypto.randomUUID()}`, memberId: member.id, source: "fixture",
      fetchedAt: new Date().toISOString(), seeds: structuredClone(member.seeds),
      requestedBookIds: available.map((offer) => offer.id),
      entries: ordered.map((offer, i) => ({ bookId: offer.id, entityId: offer.entityId, rank: i + 1,
        providerScore: null, explanation: null })),
      missingBookIds: [],
      warnings: ["Authored scenario rankings. These are not Qloo data or predictions about real readers."],
      request: { endpoint: "fixture://swapcircle/sunday-circle", parameters: { scenario: "six-readers-v1" } },
    };
  }
}
