import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const welcomeSettingsTable = pgTable("welcome_settings", {
  guildId: text("guild_id").primaryKey(),
  welcomeEnabled: boolean("welcome_enabled").notNull().default(false),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeMessage: text("welcome_message"),
  goodbyeEnabled: boolean("goodbye_enabled").notNull().default(false),
  goodbyeChannelId: text("goodbye_channel_id"),
  goodbyeMessage: text("goodbye_message"),
  autoRoleId: text("auto_role_id"),
  welcomeImageEnabled: boolean("welcome_image_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWelcomeSettingsSchema = createInsertSchema(welcomeSettingsTable).omit({ updatedAt: true });
export type InsertWelcomeSettings = z.infer<typeof insertWelcomeSettingsSchema>;
export type WelcomeSettings = typeof welcomeSettingsTable.$inferSelect;
