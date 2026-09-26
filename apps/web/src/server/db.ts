import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import type { Config } from "./config.ts";

// SQL columns are decoded by their owning domain module.
export type Row = Record<string, any>;
export interface Sql {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}
export interface Database extends Sql {
  transaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function openDatabase(
  config: Pick<Config, "databaseUrl" | "dataDir">,
  memory = false,
): Promise<Database> {
  if (config.databaseUrl) {
    const pool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 8,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
      idle_in_transaction_session_timeout: 60000,
    });
    const query = async <T extends Row>(text: string, values: unknown[] = []) =>
      (await pool.query(text, values)).rows as T[];
    return {
      query,
      exec: async (text) => {
        await pool.query(text);
      },
      close: () => pool.end(),
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          // One transaction lock keeps quotas, idempotency and job selection identical on both backends.
          await client.query("SELECT pg_advisory_xact_lock(72626808)");
          const result = await fn({
            query: async (q, p = []) => (await client.query(q, p)).rows,
            exec: async (q) => {
              await client.query(q);
            },
          });
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
    };
  }
  const lock = join(config.dataDir, "database.lock");
  if (!memory) {
    await mkdir(config.dataDir, { recursive: true });
    try {
      await writeFile(lock, String(process.pid), { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number(await readFile(lock, "utf8"));
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch (probe) {
        if ((probe as NodeJS.ErrnoException).code === "ESRCH") alive = false;
      }
      if (alive)
        throw new Error(
          "Local database already open. Stop the other process or use PostgreSQL for multiple processes.",
        );
      await unlink(lock);
      await writeFile(lock, String(process.pid), { flag: "wx" });
    }
  }
  const engine = new PGlite(
    memory ? undefined : join(config.dataDir, "postgres"),
  );
  try {
    await engine.waitReady;
  } catch (error) {
    if (!memory) await unlink(lock);
    throw error;
  }
  const sql: Sql = {
    query: async <T extends Row>(text: string, params: unknown[] = []) =>
      (await engine.query<T>(text, params)).rows,
    exec: async (text) => {
      await engine.exec(text);
    },
  };
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = tail.then(fn, fn);
    tail = result.catch(() => {});
    return result;
  };
  return {
    query: (q, p) => serial(() => sql.query(q, p)),
    exec: (q) => serial(() => sql.exec(q)),
    transaction: (fn) =>
      serial(async () => {
        await sql.exec("BEGIN");
        try {
          const value = await fn(sql);
          await sql.exec("COMMIT");
          return value;
        } catch (error) {
          await sql.exec("ROLLBACK");
          throw error;
        }
      }),
    close: () =>
      serial(async () => {
        await engine.close();
        if (!memory) await unlink(lock);
      }),
  };
}

export async function migrate(db: Database, through?: string): Promise<string[]> {
  const dir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../infra/migrations",
  );
  return db.transaction(async (sql) => {
    await sql.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL)",
    );
    const applied: string[] = [];
    for (const name of (await readdir(dir))
      .filter((n) => /^\d+.*\.sql$/.test(n))
      .sort()) {
      if(through && name>through)continue;
      const text = (await readFile(join(dir, name), "utf8")).replaceAll("\r\n","\n");
      const checksum = createHash("sha256").update(text).digest("hex");
      const [existing] = await sql.query(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error("Applied migration was modified: " + name);
        continue;
      }
      await sql.exec(text);
      await sql.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
      applied.push(name);
    }
    return applied;
  });
}
