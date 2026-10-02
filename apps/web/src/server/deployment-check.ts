import { randomUUID } from "node:crypto";
import type { App } from "./context.ts";
import { sha256 } from "./crypto.ts";

// Standard harmless antivirus test signature, assembled only in memory.
export const eicar = () =>
  Buffer.from(
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}$" +
      "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
  );
export async function verifyDeployment(app: App) {
  if (!app.config.databaseUrl)
    throw new Error("Deployment verification requires PostgreSQL.");
  if (app.config.scanMode !== "clamav")
    throw new Error("Deployment verification cannot use a local scan bypass.");
  if (app.config.storageUrl)
    throw new Error(
      "This verifier targets self-hosted local storage. Supabase requires project-specific anon/authenticated JWT ACL probes.",
    );
  const tables = await app.db.query(
    "SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname=current_schema() AND tablename<>'schema_migrations'",
  );
  const required = [
    "sessions",
    "leases",
    "document_uploads",
    "document_versions",
    "exports",
    "worker_tasks",
    "chain_events",
    "chain_checkpoints",
  ];
  if (
    !required.every((name) =>
      tables.some((row) => row.tablename === name && row.rowsecurity),
    )
  )
    throw new Error("Private tables must exist and have RLS enabled.");
  // D's schema deliberately has no client policies; all access is through the API.
  const policies = await app.db.query(
    "SELECT tablename FROM pg_policies WHERE schemaname=current_schema()",
  );
  if (policies.length)
    throw new Error(
      "Unexpected RLS policies require review before deployment.",
    );
  if (!(await app.storage.health()) || !(await app.quarantine.health()))
    throw new Error("Private storage configuration failed.");
  const health = await app.scanner.health();
  if (!health.ready) throw new Error("Scanner definitions are not fresh.");
  const clean = Buffer.from(
    "%PDF-1.4\n% Fictional RentBond deployment probe\n%%EOF\n",
  );
  if (
    !(await app.scanner.scan(clean)).clean ||
    (await app.scanner.scan(eicar())).clean
  )
    throw new Error(
      "The real scanner did not distinguish clean bytes from the EICAR test signature.",
    );
  const key = randomUUID() + "/" + randomUUID();
  try {
    await app.quarantine.put(key, clean, "application/pdf");
    if (sha256(await app.quarantine.get(key)) !== sha256(clean))
      throw new Error("Quarantine round trip failed.");
    let leaked = false;
    try {
      await app.storage.get(key);
      leaked = true;
    } catch {
      /* Missing clean object is required. */
    }
    if (leaked)
      throw new Error("Quarantine and clean storage are not isolated.");
    await app.storage.put(key, clean, "application/pdf");
    if (sha256(await app.storage.get(key)) !== sha256(clean))
      throw new Error("Private storage round trip failed.");
    let overwrite = false;
    try {
      await app.storage.put(key, clean, "application/pdf");
      overwrite = true;
    } catch {}
    if (overwrite) throw new Error("Immutable object overwrite was accepted.");
  } finally {
    await app.quarantine.remove(key);
    await app.storage.remove(key);
  }
  return {
    database: "PostgreSQL",
    privateTables: tables.length,
    rls: "enabled, no client policies",
    storage: "local private objects and quarantine isolated",
    scanner: health.engine,
    eicar: "rejected",
    cleanFixture: "accepted",
    boundary:
      "Service checks only. Run deployment.integration.mjs and HTTP ACL tests on this environment before accepting public uploads.",
  };
}
