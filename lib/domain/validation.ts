import { z } from "zod";
import { AppError } from "./errors";

const safeText = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const entityTypeSchema = z.enum(["book", "movie", "artist", "tv_show", "podcast", "videogame"]);
export const entitySchema = z.object({
  id: safeText(80), name: safeText(150), type: entityTypeSchema, subtitle: z.string().max(180).optional(),
}).strict();
export const memberSchema = z.object({
  id, name: safeText(50), color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  seeds: z.array(entitySchema).min(1).max(4), active: z.boolean(),
  offer: z.object({
    id, ownerId: id, title: safeText(180), author: z.string().max(150), entityId: safeText(80),
    condition: z.string().max(240), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), available: z.boolean(),
  }).strict(),
}).strict();
export const createRoomSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("demo"), title: z.string().max(100).optional() }).strict(),
  z.object({ mode: z.literal("live"), title: safeText(100), members: z.array(memberSchema).min(2).max(8) }).strict(),
]);
export const actionSchema = z.object({
  revision: z.number().int().nonnegative(),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("rank") }).strict(),
    z.object({ type: z.literal("plan") }).strict(),
    z.object({ type: z.literal("choice"), memberId: id, bookId: id, value: z.enum(["yes", "no"]) }).strict(),
    z.object({ type: z.literal("approve"), memberId: id, fingerprint: safeText(4000) }).strict(),
    z.object({ type: z.literal("withdraw"), memberId: id }).strict(),
    z.object({ type: z.literal("restore"), memberId: id }).strict(),
    z.object({ type: z.literal("update_member"), memberId: id, member: memberSchema }).strict(),
  ]),
}).strict();

export async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new AppError("Send a JSON request.", 415);
  }
  const body = await request.text();
  if (body.length > 48_000) throw new AppError("This request is too large.", 413);
  try { return JSON.parse(body); } catch { throw new AppError("The request contains invalid JSON."); }
}
