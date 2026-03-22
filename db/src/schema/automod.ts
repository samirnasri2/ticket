import { pgTable, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const automodSettingsTable = pgTable("automod_settings", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  badWordFilter: boolean("bad_word_filter").notNull().default(false),
  badWords: jsonb("bad_words").$type<string[]>().notNull().default([]),
  linkFilter: boolean("link_filter").notNull().default(false),
  spamProtection: boolean("spam_protection").notNull().default(false),
  scamDetection: boolean("scam_detection").notNull().default(false),
  capsLimit: integer("caps_limit").notNull().default(70),
  mentionLimit: integer("mention_limit").notNull().default(5),
  antiRaid: boolean("anti_raid").notNull().default(false),
  antiInvite: boolean("anti_invite").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAutomodSettingsSchema = createInsertSchema(automodSettingsTable).omit({ updatedAt: true });
export type InsertAutomodSettings = z.infer<typeof insertAutomodSettingsSchema>;
export type AutomodSettings = typeof automodSettingsTable.$inferSelect;
