import { pgTable, text, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serverLogsTable = pgTable("server_logs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  userId: text("user_id"),
  username: text("username"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertServerLogSchema = createInsertSchema(serverLogsTable).omit({ id: true, createdAt: true });
export type InsertServerLog = z.infer<typeof insertServerLogSchema>;
export type ServerLog = typeof serverLogsTable.$inferSelect;
