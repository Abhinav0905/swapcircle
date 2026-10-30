import type { EntityType, TasteEntity } from "../domain/types";

export type JsonRecord = Record<string, unknown>;

export const asRecord = (value: unknown): JsonRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;

export const QLOO_ENTITY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES: readonly EntityType[] = ["book", "movie", "artist", "tv_show", "podcast", "videogame"];

/** Normalize identity, but never silently choose among ambiguous search results. */
export class EntityResolver {
  supportedType(value: unknown): value is EntityType {
    return typeof value === "string" && TYPES.includes(value as EntityType);
  }

  typeOf(value: JsonRecord): EntityType | null {
    const subtype = typeof value.subtype === "string" ? value.subtype : value.type;
    if (typeof subtype !== "string" || !subtype.startsWith("urn:entity:")) return null;
    const type = subtype.slice("urn:entity:".length);
    return this.supportedType(type) ? type : null;
  }

  parse(value: unknown, requestedType: EntityType): TasteEntity | null {
    const entity = asRecord(value);
    if (!entity || typeof entity.entity_id !== "string" || !QLOO_ENTITY_ID.test(entity.entity_id)) return null;
    if (this.typeOf(entity) !== requestedType || typeof entity.name !== "string") return null;
    const name = this.cleanText(entity.name, 150);
    if (!name) return null;
    const subtitle = typeof entity.disambiguation === "string" ? this.cleanText(entity.disambiguation, 180) : "";
    return { id: entity.entity_id.toUpperCase(), name, type: requestedType, ...(subtitle ? { subtitle } : {}) };
  }

  private cleanText(value: string, limit: number): string {
    return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
  }
}
