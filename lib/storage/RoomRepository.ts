import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { rooms, rateLimits } from "../../db/schema";
import { AppError } from "../domain/errors";
import type { ExchangeRoom } from "../domain/types";
import type { CredentialRecord } from "./CapabilityService";

export interface StoredRoom { room: ExchangeRoom; credentials: CredentialRecord[] }

/** D1-backed room storage. Compare-and-swap prevents stale browser writes. */
export class RoomRepository {
  async create(room: ExchangeRoom, credentials: CredentialRecord[]): Promise<void> {
    await getDb().insert(rooms).values({
      id: room.id, revision: room.revision, state: JSON.stringify(room),
      credentials: JSON.stringify(credentials), createdAt: room.createdAt,
      updatedAt: room.createdAt,
    });
  }

  async get(id: string): Promise<StoredRoom | null> {
    const row = await getDb().select().from(rooms).where(eq(rooms.id, id)).get();
    if (!row) return null;
    return { room: JSON.parse(row.state), credentials: JSON.parse(row.credentials) };
  }

  async save(room: ExchangeRoom, expectedRevision: number): Promise<void> {
    const changed = await getDb().update(rooms).set({
      revision: room.revision, state: JSON.stringify(room), updatedAt: new Date().toISOString(),
    }).where(and(eq(rooms.id, room.id), eq(rooms.revision, expectedRevision))).returning({ id: rooms.id });
    if (!changed.length) throw new AppError("This circle changed in another window. Refresh and try again.", 409, "stale_revision");
  }

  async remove(id: string): Promise<void> {
    await getDb().delete(rooms).where(eq(rooms.id, id));
  }

  /** Atomic fixed-window rate limit, shared across Worker isolates. */
  async consumeLimit(key: string, limit: number, windowMs: number): Promise<void> {
    const now = Date.now();
    const result = await getDb().insert(rateLimits).values({ key, count: 1, resetsAt: now + windowMs })
      .onConflictDoUpdate({ target: rateLimits.key, set: {
        count: sql`CASE WHEN ${rateLimits.resetsAt} <= ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetsAt: sql`CASE WHEN ${rateLimits.resetsAt} <= ${now} THEN ${now + windowMs} ELSE ${rateLimits.resetsAt} END`,
      } }).returning({ count: rateLimits.count });
    if (result[0].count > limit) throw new AppError("A few too many requests. Please try again shortly.", 429, "rate_limited");
  }
}
