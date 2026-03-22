import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moderationActionsTable = pgTable("moderation_actions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  targetUserId: text("target_user_id").notNull(),
  targetUsername: text("target_username").notNull(),
  moderatorId: text("moderator_id").notNull(),
  moderatorUsername: text("moderator_username").notNull(),
  action: text("action").notNull(),
  reason: text("reason"),
  duration: text("duration"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertModerationActionSchema = createInsertSchema(moderationActionsTable).omit({ id: true, createdAt: true });
export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;
export type ModerationAction = typeof moderationActionsTable.$inferSelect;
