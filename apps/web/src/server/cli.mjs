import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { readConfig } from "./config.ts";
import { openDatabase, migrate } from "./db.ts";
import { createChain } from "./chain.ts";
import { createStorage } from "./storage.ts";
import {
  runExportJob,
  runGasJob,
  cleanup,
  purgeRequestedLease,
} from "./jobs.ts";
import { syncLease } from "./projections.ts";
import { computeTermsCommitment, canonicalJson } from "./crypto.ts";
import { address, hash, uuid } from "./schemas.ts";

const command = process.argv[2];
if (command === "init") {
  const file = resolve(".env.local");
  if (existsSync(file))
    throw new Error(
      ".env.local already exists; keep your existing configuration.",
    );
  await writeFile(
    file,
    [
      "NEXT_PUBLIC_APP_ENV=local",
      "NEXT_PUBLIC_APP_URL=http://localhost:3000",
      "CHAIN_ID=31337",
      "NEXT_PUBLIC_CHAIN_ID=31337",
      "SESSION_SECRET=" + randomBytes(32).toString("hex"),
      "RENTBOND_DATA_DIR=.rentbond",
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created ignored local configuration. No cloud account is required.",
  );
  process.exit(0);
}
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const config = readConfig();
const db = await openDatabase(config);
const app = {
  config,
  db,
  chain: createChain(config),
  storage: createStorage(config),
  now: Date.now,
};
try {
  if (command === "migrate")
    console.log(JSON.stringify({ applied: await migrate(db) }));
  else if (command === "worker") {
    let stopping = false;
    process.on("SIGINT", () => {
      stopping = true;
    });
    process.on("SIGTERM", () => {
      stopping = true;
    });
    let cycle = 0;
    do {
      await runExportJob(app);
      await runGasJob(app);
      if (cycle++ % 12 === 0) {
        await cleanup(app);
        const leases = await db.query(
          "SELECT id FROM leases WHERE contract_address IS NOT NULL AND purged_at IS NULL",
        );
        for (const lease of leases) {
          try {
            await syncLease(app, lease.id);
          } catch {
            console.error(
              JSON.stringify({ event: "projection.retry", leaseId: lease.id }),
            );
          }
        }
      }
      if (process.argv.includes("--once") || stopping) break;
      await setTimeout(5000);
    } while (!stopping);
  } else if (command === "cleanup")
    console.log(JSON.stringify(await cleanup(app)));
  else if (command === "purge-requested")
    console.log(
      JSON.stringify(
        await purgeRequestedLease(app, uuid.parse(process.argv[3])),
      ),
    );
  else if (command === "profile-import") {
    const path = process.argv[3];
    if (!path) throw new Error("Pass a reviewed service manifest JSON file.");
    const input = JSON.parse(await readFile(path, "utf8"));
    const profileId = hash.parse(input.profileId),
      registry = address.parse(config.registryAddress);
    if (input.reviewed !== true)
      throw new Error(
        "Explicit reviewed:true is required for test-service registration.",
      );
    const commitment = computeTermsCommitment(
      canonicalJson(input.manifest),
      input.salt,
    );
    const live = await app.chain.profile(profileId);
    if (live.profile.serviceTermsHash !== commitment)
      throw new Error("Service manifest hash does not match the registry.");
    const id = registry + ":" + profileId;
    await db.query(
      "INSERT INTO service_profiles(id,chain_id,registry_address,profile_id,manifest,salt,commitment,reviewed,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,true,$8)",
      [
        id,
        config.chainId,
        registry,
        profileId,
        JSON.stringify(input.manifest),
        input.salt,
        commitment,
        Date.now(),
      ],
    );
    console.log(JSON.stringify({ id, imported: true }));
  } else if (command === "sync") {
    if (!process.argv[3]) throw new Error("Pass a lease UUID.");
    await syncLease(app, process.argv[3]);
    console.log("Lease projection synchronized from chain.");
  } else if (command === "seed") {
    const { seedLocal } = await import("./seed.mjs");
    console.log(JSON.stringify(await seedLocal(app)));
  } else
    throw new Error(
      "Commands: init, migrate, worker [--once], cleanup, purge-requested LEASE_ID, profile-import FILE, sync LEASE_ID, seed",
    );
} finally {
  await db.close();
}
