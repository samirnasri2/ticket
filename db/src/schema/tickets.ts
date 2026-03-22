import { pgTable, text, boolean, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ticketSettingsTable = pgTable("ticket_settings", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  panelChannelId: text("panel_channel_id"),
  supportRoleId: text("support_role_id"),
  categories: text("categories").array().notNull().default([]),
  autoCloseHours: integer("auto_close_hours"),
  transcriptChannelId: text("transcript_channel_id"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id"),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  category: text("category"),
  status: text("status").notNull().default("open"),
  claimedBy: text("claimed_by"),
  transcript: text("transcript"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const insertTicketSettingsSchema = createInsertSchema(ticketSettingsTable).omit({ updatedAt: true });
export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, createdAt: true });
export type InsertTicketSettings = z.infer<typeof insertTicketSettingsSchema>;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type TicketSettings = typeof ticketSettingsTable.$inferSelect;
export type Ticket = typeof ticketsTable.$inferSelect;
