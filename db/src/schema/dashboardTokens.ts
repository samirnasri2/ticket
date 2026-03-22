import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dashboardTokensTable = pgTable("dashboard_tokens", {
  token: text("token").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  used: boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDashboardTokenSchema = createInsertSchema(dashboardTokensTable).omit({ createdAt: true });
export type InsertDashboardToken = z.infer<typeof insertDashboardTokenSchema>;
export type DashboardToken = typeof dashboardTokensTable.$inferSelect;
