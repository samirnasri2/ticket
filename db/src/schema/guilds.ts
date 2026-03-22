import { pgTable, text, boolean, integer, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guildSettingsTable = pgTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  aiChannelId: text("ai_channel_id"),
  maxResponseLength: integer("max_response_length").notNull().default(500),
  aiModeration: boolean("ai_moderation").notNull().default(false),
  autoReplies: boolean("auto_replies").notNull().default(false),
  contextMemory: boolean("context_memory").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGuildSettingsSchema = createInsertSchema(guildSettingsTable).omit({ createdAt: true, updatedAt: true });
export type InsertGuildSettings = z.infer<typeof insertGuildSettingsSchema>;
export type GuildSettings = typeof guildSettingsTable.$inferSelect;
