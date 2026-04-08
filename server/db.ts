import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,  // 10s — gives Neon time to wake from cold start
  idleTimeoutMillis: 30000,
  max: 5,
  ssl: process.env.DATABASE_URL.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

// Retry helper — Neon cold-start can need 1-2 attempts
pool.on("error", (err) => {
  console.error("[db] Pool error:", err.message);
});

export async function queryWithRetry(sql: string, params?: unknown[], retries = 3): Promise<pg.QueryResult> {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.query(sql, params as unknown[]);
    } catch (err: unknown) {
      const isLast = i === retries - 1;
      const msg = err instanceof Error ? err.message : String(err);
      if (isLast) throw err;
      console.warn(`[db] Query attempt ${i + 1} failed (${msg}), retrying in ${(i + 1) * 2}s…`);
      await new Promise(r => setTimeout(r, (i + 1) * 2000));
    }
  }
  throw new Error("Query failed after retries");
}

export const db = drizzle(pool, { schema });
