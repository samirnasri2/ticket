import crypto from "crypto";
import { db, dashboardTokensTable } from "./db.js";
import { lt } from "drizzle-orm";

export function generateToken(): string {
  const raw = crypto.randomBytes(8).toString("hex").toUpperCase();
  return ${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)};
}

export async function createDashboardToken(guildId: string, userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(dashboardTokensTable).values({
    token,
    guildId,
    userId,
    expiresAt,
    used: false,
  });
  return token;
}

export async function cleanExpiredTokens(): Promise<void> {
  await db.delete(dashboardTokensTable).where(lt(dashboardTokensTable.expiresAt, new Date()));
}
