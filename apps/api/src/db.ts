import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, type SQL } from "drizzle-orm";
import { config } from "./config.js";
export { sql };
export const pool = new pg.Pool({
  connectionString: config.database,
  max: 8,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
  query_timeout: 20000,
  idle_in_transaction_session_timeout: 30000,
  options: "-c lock_timeout=5000",
});
// Idle connections may be severed by PostgreSQL/network recovery. pg removes
// the failed client; handling this event prevents an unrelated process crash.
pool.on("error", (error: any) => {
  if (process.env.LOG_LEVEL !== "silent")
    console.warn(
      JSON.stringify({
        event: "database_idle_connection_lost",
        code: error.code || "CONNECTION_LOST",
      }),
    );
});
export const db = drizzle(pool);
export type Row = Record<string, any>;
export async function rows<T extends Row = Row>(statement: SQL): Promise<T[]> {
  return (await db.execute(statement)).rows as T[];
}
export async function one<T extends Row = Row>(
  statement: SQL,
): Promise<T | undefined> {
  return (await rows<T>(statement))[0];
}
export async function tx<T>(
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    throw e;
  } finally {
    client.release(broken);
  }
}
export async function audit(
  actor: string | null,
  action: string,
  target: string | null = null,
  metadata: object = {},
) {
  await db.execute(
    sql`INSERT INTO audit_logs(actor_id,action,target,metadata) VALUES(${actor},${action},${target},${JSON.stringify(metadata)}::jsonb)`,
  );
}
export async function auditTx(
  c: pg.PoolClient,
  actor: string | null,
  action: string,
  target: string | null = null,
  metadata: object = {},
) {
  await c.query(
    "INSERT INTO audit_logs(actor_id,action,target,metadata) VALUES($1,$2,$3,$4)",
    [actor, action, target, JSON.stringify(metadata)],
  );
}
export async function setting(key: string) {
  return (await one(sql`SELECT value FROM settings WHERE key=${key}`))?.value;
}
