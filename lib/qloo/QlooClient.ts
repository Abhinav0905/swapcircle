import type { BookOffer, EntityType, Member, RankingEntry, RankingEvidence, TasteEntity, TasteProvider } from "../domain/types";
import { asRecord, EntityResolver, QLOO_ENTITY_ID, type JsonRecord } from "./EntityResolver";
import { QlooError } from "./QlooError";
import { QlooTransport, type QlooConfig } from "./QlooTransport";

/** Live Qloo evidence only. The fixture provider is a separate implementation. */
export class QlooClient implements TasteProvider {
  readonly source = "qloo" as const;
  #transport: QlooTransport;
  #resolver = new EntityResolver();

  constructor(config: QlooConfig) {
    this.#transport = new QlooTransport(config);
  }

  async search(query: string, type: EntityType): Promise<TasteEntity[]> {
    if (typeof query !== "string" || query.trim().length < 2 || query.length > 150 || !this.#resolver.supportedType(type)) {
      throw new QlooError("Search using 2 to 150 characters and a supported category.", "qloo_invalid_input", 400);
    }
    const payload = this.validEnvelope(await this.#transport.get("/search", {
      query: query.trim(), types: `urn:entity:${type}`, take: "8", sort_by: "match",
    }));
    if (!Array.isArray(payload.results)) throw this.invalidResponse();
    const seen = new Set<string>();
    return payload.results.slice(0, 100).flatMap((value) => {
      const entity = this.#resolver.parse(value, type);
      if (!entity || seen.has(entity.id)) return [];
      seen.add(entity.id);
      return [entity];
    }).slice(0, 8);
  }

  async rank(member: Member, offers: BookOffer[]): Promise<RankingEvidence> {
    this.validateRankingInput(member, offers);
    const available = offers.filter((offer) => offer.available && offer.ownerId !== member.id);
    const candidateIds = [...new Set(available.map((offer) => offer.entityId.toUpperCase()))];
    const seedIds = [...new Set(member.seeds.map((seed) => seed.id.toUpperCase()))];
    const parameters: Record<string, string> = {
      "filter.type": "urn:entity:book",
      "signal.interests.entities": seedIds.join(","),
      "filter.results.entities": candidateIds.join(","),
      "feature.explainability": "true",
      take: String(candidateIds.length),
    };
    const evidence: RankingEvidence = {
      id: crypto.randomUUID(), memberId: member.id, source: this.source,
      fetchedAt: new Date().toISOString(), seeds: member.seeds.map((seed) => ({ ...seed })),
      requestedBookIds: available.map((offer) => offer.id), entries: [], missingBookIds: [], warnings: [],
      request: { endpoint: `${this.#transport.origin}/v2/insights`, parameters },
    };
    if (!candidateIds.length) {
      evidence.warnings.push("No other available books were eligible. No Qloo request was made.");
      return evidence;
    }
    const payload = this.validEnvelope(await this.#transport.get("/v2/insights", parameters));
    const results = asRecord(payload.results);
    if (!results || !Array.isArray(results.entities) || results.entities.length > 200) throw this.invalidResponse();
    evidence.fetchedAt = new Date().toISOString();
    this.collectWarnings(payload, evidence.warnings);
    const allowed = new Set(candidateIds);
    const returned = new Map<string, Omit<RankingEntry, "bookId" | "entityId">>();
    let ignored = 0;
    let duplicate = 0;
    let missingScores = 0;
    let unparsedExplanations = 0;
    for (const raw of results.entities) {
      const entity = asRecord(raw);
      const entityId = typeof entity?.entity_id === "string" ? entity.entity_id.toUpperCase() : "";
      if (!entity || !allowed.has(entityId) || this.#resolver.typeOf(entity) !== "book") { ignored += 1; continue; }
      if (returned.has(entityId)) { duplicate += 1; continue; }
      const query = asRecord(entity.query);
      const score = typeof query?.affinity === "number" && Number.isFinite(query.affinity) && query.affinity >= 0 ? query.affinity : null;
      if (score === null) missingScores += 1;
      const explanation = asRecord(query?.explainability);
      if (explanation) {
        this.appendWarning(explanation.warning, evidence.warnings);
        if (Object.keys(explanation).some((key) => key !== "warning")) unparsedExplanations += 1;
      }
      // Qloo documents this section but not its nested contribution schema. Until
      // verified against a real response, do not invent an attribution sentence.
      returned.set(entityId, { rank: returned.size + 1, providerScore: score, explanation: null });
    }
    for (const offer of available) {
      const ranking = returned.get(offer.entityId.toUpperCase());
      if (ranking) evidence.entries.push({ bookId: offer.id, entityId: offer.entityId, ...ranking });
      else evidence.missingBookIds.push(offer.id);
    }
    evidence.entries.sort((a, b) => a.rank - b.rank || a.bookId.localeCompare(b.bookId));
    if (ignored) evidence.warnings.push(`Ignored ${ignored} result(s) outside the requested book identities.`);
    if (duplicate) evidence.warnings.push(`Ignored ${duplicate} duplicate result(s); the first returned position was retained.`);
    if (missingScores) evidence.warnings.push(`Qloo omitted an affinity value for ${missingScores} title(s). Their returned order is retained.`);
    if (unparsedExplanations) evidence.warnings.push("Qloo returned attribution metadata that this version does not interpret; no personal reason was inferred.");
    if (evidence.missingBookIds.length) evidence.warnings.push(`${evidence.missingBookIds.length} available copy/copies were not scored by Qloo. Missing evidence is unknown, not dislike.`);
    evidence.warnings = [...new Set(evidence.warnings)];
    return evidence;
  }

  private validateRankingInput(member: Member, offers: BookOffer[]): void {
    if (!member.active || !Array.isArray(member.seeds) || !member.seeds.length || member.seeds.length > 4) {
      throw new QlooError("An active reader needs one to four confirmed favorites.", "qloo_invalid_input", 400);
    }
    if (member.seeds.some((seed) => !QLOO_ENTITY_ID.test(seed.id) || !this.#resolver.supportedType(seed.type))) {
      throw new QlooError("Resolve each favorite to a Qloo entity before ranking.", "qloo_invalid_input", 400);
    }
    if (!Array.isArray(offers) || offers.length > 50 || new Set(offers.map((offer) => offer.id)).size !== offers.length) {
      throw new QlooError("Provide at most 50 distinct physical book offers.", "qloo_invalid_input", 400);
    }
    if (offers.some((offer) => offer.available && offer.ownerId !== member.id && !QLOO_ENTITY_ID.test(offer.entityId))) {
      throw new QlooError("Resolve each available book to a Qloo entity before ranking.", "qloo_invalid_input", 400);
    }
  }

  private validEnvelope(value: unknown): JsonRecord {
    const payload = asRecord(value);
    if (!payload || payload.success !== true) throw this.invalidResponse();
    return payload;
  }

  private collectWarnings(payload: JsonRecord, warnings: string[]): void {
    if (Array.isArray(payload.warnings)) payload.warnings.slice(0, 10).forEach((warning) => this.appendWarning(warning, warnings));
    const query = asRecord(payload.query);
    const explainability = asRecord(query?.explainability);
    this.appendWarning(explainability?.warning, warnings);
  }

  private appendWarning(value: unknown, warnings: string[]): void {
    if (typeof value !== "string") return;
    const sanitized = this.#transport.sanitizeWarning(value);
    if (sanitized) warnings.push(`Qloo: ${sanitized}`);
  }

  private invalidResponse(): QlooError {
    return new QlooError("Qloo returned an unexpected response. No sample results were substituted.", "qloo_invalid_response");
  }
}
