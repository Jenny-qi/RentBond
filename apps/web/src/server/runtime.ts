import { readConfig } from "./config.ts";
import { openDatabase } from "./db.ts";
import { createChain } from "./chain.ts";
import { createStorage } from "./storage.ts";
import type { App } from "./context.ts";
import { runExportJob, runGasJob, cleanup } from "./jobs.ts";
import { syncLease } from "./projections.ts";

const state = globalThis as typeof globalThis & {
  rentbondBackend?: Promise<App>;
};
export async function getApp(): Promise<App> {
  state.rentbondBackend ??= (async () => {
    const config = readConfig(),
      db = await openDatabase(config);
    try {
      const migrations = await db.query(
        "SELECT name FROM schema_migrations WHERE name='0002_new_account_invitations.sql'",
      );
      if (!migrations.length)
        throw new Error("Run db:migrate before starting the API.");
      const app: App = {
        config,
        db,
        storage: createStorage(config),
        chain: createChain(config),
        now: Date.now,
      };
      if (!config.databaseUrl) {
        let running = false,
          cycle = 0;
        const timer = setInterval(async () => {
          if (running) return;
          running = true;
          try {
            await runExportJob(app);
            await runGasJob(app);
            if (cycle++ % 12 === 0) {
              const leases = await db.query(
                "SELECT id FROM leases WHERE contract_address IS NOT NULL AND purged_at IS NULL",
              );
              for (const lease of leases) {
                try {
                  await syncLease(app, lease.id);
                } catch {
                  console.error(
                    JSON.stringify({
                      event: "projection.retry",
                      leaseId: lease.id,
                    }),
                  );
                }
              }
              await cleanup(app);
            }
          } catch {
            console.error(JSON.stringify({ event: "local_jobs.retry" }));
          } finally {
            running = false;
          }
        }, 5000);
        timer.unref();
      }
      return app;
    } catch (error) {
      await db.close();
      throw error;
    }
  })().catch((error) => {
    state.rentbondBackend = undefined;
    throw error;
  });
  return state.rentbondBackend;
}
