import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

import * as schema from "../../../../db/src/schema/index.js";
export const db = drizzle(pool, { schema });

export * from "../../../../db/src/schema/index.js";
