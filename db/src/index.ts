import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../../db/src/schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export {
  guildSettingsTable,
  moderationActionsTable,
  automodSettingsTable,
  ticketSettingsTable,
  ticketsTable,
  giveawaysTable,
  welcomeSettingsTable,
  reactionRolesTable,
  serverLogsTable,
  dashboardTokensTable,
} from "../../../db/src/schema/index.js";
