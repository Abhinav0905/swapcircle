import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("exchange_rooms", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull(),
  state: text("state").notNull(),
  credentials: text("credentials").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetsAt: integer("resets_at").notNull(),
});
