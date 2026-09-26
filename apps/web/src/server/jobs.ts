import { randomUUID } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import type { App, Context } from "./context.ts";
import type { Row } from "./db.ts";
import { scopeAccess, leaseAccess, liveLease, verifyManifest } from "./acl.ts";
import { documentAccess } from "./documents.ts";
import { exportSchema, gasSchema } from "./schemas.ts";
import { sha256, canonicalJson } from "./crypto.ts";
import { audit } from "./auth.ts";
import { ApiFailure, requireThat } from "./errors.ts";
import { privateHistory, caseMaterialRefs } from "./presentation.ts";

export async function createExport(ctx: Context, body: unknown) {
  const input = exportSchema.parse(body);
  await scopeAccess(ctx, input.leaseId, input.caseId);
  const [pending] = await ctx.sql.query(
    "SELECT COUNT(*) AS n FROM exports WHERE actor=$1 AND state IN ('queued','processing')",
    [ctx.session.wallet],
  );
  requireThat(
    Number(pending.n) < 3,
    429,
    "EXPORT_LIMIT",
    "Wait for existing exports to finish.",
  );
  const id = randomUUID();
  await ctx.sql.query(
    "INSERT INTO exports(id,lease_id,case_id,actor,next_attempt_at,created_at) VALUES($1,$2,$3,$4,$5,$5)",
    [id, input.leaseId, input.caseId ?? null, ctx.session.wallet, ctx.now],
  );
  return { id, state: "queued", statusUrl: "/api/exports/" + id };
}
export async function exportAccess(ctx: Context, id: string) {
  const [job] = await ctx.sql.query(
    "SELECT * FROM exports WHERE id=$1 AND actor=$2",
    [id, ctx.session.wallet],
  );
  requireThat(job, 403, "FORBIDDEN", "You cannot access this export.");
  await scopeAccess(ctx, job.lease_id, job.case_id ?? undefined);
  return job;
}
export async function requestGas(ctx: Context, body: unknown) {
  const { leaseId } = gasSchema.parse(body),
    cfg = ctx.app.config;
  requireThat(
    cfg.mode === "testnet" && cfg.chainId === 10143 && cfg.sponsorKey,
    503,
    "GAS_DISABLED",
    "Test gas sponsor is not configured.",
  );
  const lease = await leaseAccess(ctx, leaseId, ["T", "L", "R", "F"]);
  await gasEligibility(ctx, lease);
  const dayStart = Math.floor(ctx.now / 86400000) * 86400000;
  const rows = await ctx.sql.query(
    "SELECT wallet,lease_id,created_at,state FROM test_gas_requests WHERE created_at >= $1 OR (wallet=$2 AND created_at > $3)",
    [dayStart, ctx.session.wallet, ctx.now - cfg.gasCooldownMs],
  );
  const day = rows.filter((row) => Number(row.created_at) >= dayStart);
  requireThat(
    day.length < cfg.gasGlobalDaily &&
      day.filter((r) => r.wallet === ctx.session.wallet).length <
        cfg.gasAccountDaily &&
      day.filter((r) => r.lease_id === leaseId).length < cfg.gasLeaseDaily &&
      !rows.some(
        (r) =>
          r.wallet === ctx.session.wallet &&
          Number(r.created_at) > ctx.now - cfg.gasCooldownMs,
      ),
    429,
    "GAS_QUOTA",
    "Test gas cooldown or daily quota reached.",
  );
  const id = randomUUID();
  await ctx.sql.query(
    "INSERT INTO test_gas_requests(id,lease_id,wallet,amount,chain_id,next_attempt_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$6)",
    [
      id,
      leaseId,
      ctx.session.wallet,
      cfg.gasAmount.toString(),
      cfg.chainId,
      ctx.now,
    ],
  );
  return {
    id,
    state: "queued",
    amount: cfg.gasAmount.toString(),
    statusUrl: "/api/test-gas/requests/" + id,
  };
}
async function gasEligibility(ctx: Context, lease: Row) {
  if (!lease.contract_address) {
    requireThat(
      ctx.app.config.gasOrganizers.includes(lease.landlord) &&
        lease.prepared_at &&
        lease.tenant &&
        ["T", "L"].includes(lease.role) &&
        lease.terms.acceptDeadline * 1000 > ctx.now,
      403,
      "GAS_NOT_ELIGIBLE",
      "Pre-deployment gas requires a frozen draft approved by a configured test organizer.",
    );
    await ctx.app.chain.health();
    return;
  }
  const live = await liveLease(ctx, lease);
  const outstanding =
    BigInt(live.accounting.unallocated) +
    BigInt(live.accounting.tenantCredit) +
    BigInt(live.accounting.landlordCredit);
  const fundedExit =
    ["T", "L"].includes(lease.role) &&
    BigInt(live.accounting.fundedAmount) > 0n &&
    outstanding > 0n;
  requireThat(
    live.phase !== 9 &&
      live.phase !== 11 &&
      (live.chainTime < Number(live.terms.hardEndAt) || fundedExit),
    409,
    "LEASE_NOT_ACTIVE",
    "This lease is not eligible for test gas.",
  );
  const roles: Record<string, string> = {
    T: live.terms.tenant,
    L: live.terms.landlord,
    R: live.terms.primaryResolver,
    F: live.terms.fallbackResolver,
  };
  requireThat(
    roles[lease.role]?.toLowerCase() === ctx.session.wallet,
    403,
    "FORBIDDEN",
    "Account is not a chain participant.",
  );
}
function jobContext(app: App, sql: Context["sql"], actor: string): Context {
  return {
    app,
    sql,
    now: app.now(),
    requestId: randomUUID(),
    session: { hash: "", wallet: actor, expiresAt: 0 },
  };
}
async function exportArchive(ctx: Context, job: Row) {
  const lease = await scopeAccess(ctx, job.lease_id, job.case_id ?? undefined);
  if (lease.contract_address && ["T", "L"].includes(lease.role))
    await liveLease(ctx, lease);
  const bundles = await ctx.sql.query(
    "SELECT * FROM evidence_bundles WHERE lease_id=$1 AND ($2::uuid IS NULL OR case_id=$2) ORDER BY created_at,id",
    [lease.id, job.case_id],
  );
  const history = await privateHistory(ctx, lease.id, job.case_id ?? undefined);
  const scopedRefs = job.case_id
    ? await caseMaterialRefs(ctx, lease.id, job.case_id)
    : [];
  const visibleClaims = history.claims;
  const cases = await ctx.sql.query(
    "SELECT id,chain_case_id,snapshot,synced_at FROM cases WHERE lease_id=$1 AND ($2::uuid IS NULL OR id=$2)",
    [lease.id, job.case_id],
  );
  const events = await ctx.sql.query(
    "SELECT tx_hash,log_index,block_number,block_hash,event_name,payload,canonical FROM chain_events WHERE lease_id=$1 ORDER BY block_number,log_index",
    [lease.id],
  );
  bundles.forEach(verifyManifest);
  visibleClaims.forEach(verifyManifest);
  const versions = await ctx.sql.query(
    "SELECT v.*,d.case_id FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE d.lease_id=$1 ORDER BY v.document_id,v.version",
    [lease.id],
  );
  const files: Record<string, Uint8Array> = {},
    originals: Row[] = [];
  let total = 0;
  for (const version of versions) {
    if (
      job.case_id &&
      version.case_id !== job.case_id &&
      !scopedRefs.some(
        (d: Row) =>
          d.documentId === version.document_id && d.version === version.version,
      )
    )
      continue;
    await documentAccess(
      ctx,
      version.document_id,
      version.version,
      job.case_id ?? undefined,
    );
    const bytes = await ctx.app.storage.get(version.storage_key);
    requireThat(
      sha256(bytes) === version.content_hash,
      409,
      "COMMITMENT_MISMATCH",
      "An original file has changed.",
    );
    total += bytes.length;
    requireThat(
      total <= 104857600,
      422,
      "STORAGE_QUOTA",
      "Export exceeds lease quota.",
    );
    const ext =
      version.mime === "application/pdf"
        ? "pdf"
        : version.mime === "image/png"
          ? "png"
          : "jpg";
    const name =
      "originals/" + version.document_id + "-v" + version.version + "." + ext;
    files[name] = bytes;
    originals.push({
      documentId: version.document_id,
      version: version.version,
      filename: name,
      sha256: version.content_hash,
      size: bytes.length,
    });
  }
  const manifest = {
    schemaVersion: "1.0.0",
    generatedAt: ctx.now,
    environment: ctx.app.config.mode,
    chainId: lease.chain_id,
    leaseId: lease.id,
    caseId: job.case_id,
    contractAddress: lease.contract_address,
    terms: lease.terms,
    termsSalt: lease.salt,
    termsCommitment: lease.commitment,
    projection: lease.projection,
    lastSyncedAt: lease.synced_at,
    cases,
    events,
    statements: history.statements,
    bundles: bundles.map(({ manifest, salt, commitment }) => ({
      manifest,
      salt,
      commitment,
    })),
    claims: visibleClaims,
    originals,
    verification: {
      fileHash: "SHA-256",
      commitment:
        'keccak256(UTF8("RentBond:private:v1\\n") || saltBytes32 || canonicalJsonUTF8)',
      source: "packages/shared/src/commitments/index.ts",
      amounts: "integer strings; MockUSD has 6 decimals",
      chainRecords:
        "Only canonical events and the recorded confirmation policy support chain status. Saved drafts are not wallet confirmations.",
    },
  };
  const encoded = canonicalJson(manifest);
  requireThat(
    Buffer.byteLength(encoded) < 10 * 1024 * 1024,
    422,
    "EXPORT_TOO_LARGE",
    "Export metadata exceeds its limit.",
  );
  files["manifest.json"] = strToU8(encoded);
  files["VERIFY.txt"] = strToU8(
    "RentBond test materials. MockUSD has no cash value.\nVerify original SHA-256 hashes and salted commitments with the shared implementation.\nWallet confirmations, evidence responses and fund movements are in canonical chain events; local saved versions are not on-chain submissions.\nStatements and capture times are party assertions, not verified facts or legal certification. Withdrawal notes preserve the original and do not revoke chain records.\nUse the original account and contract for recovery; this archive holds no private keys.\n",
  );
  return zipSync(files, { level: 0 });
}
export async function runExportJob(app: App): Promise<boolean> {
  return app.db.transaction(async (sql) => {
    const [job] = await sql.query(
      "SELECT * FROM exports WHERE state IN ('queued','processing') AND next_attempt_at <= $1 ORDER BY created_at,id LIMIT 1 FOR UPDATE",
      [app.now()],
    );
    if (!job) return false;
    const ctx = jobContext(app, sql, job.actor),
      attempts = job.attempts + 1;
    try {
      const bytes = await exportArchive(ctx, job);
      const key = job.lease_id + "/" + randomUUID();
      await app.storage.put(key, bytes, "application/zip");
      await sql.query(
        "UPDATE exports SET state='ready',storage_key=$1,content_hash=$2,size=$3,attempts=$4,completed_at=$5,error_code=NULL WHERE id=$6",
        [key, sha256(bytes), bytes.length, attempts, ctx.now, job.id],
      );
      await audit(
        sql,
        job.actor,
        "export.complete",
        job.id,
        ctx.now,
        ctx.requestId,
      );
    } catch (error) {
      const retryable = !(error instanceof ApiFailure) || error.status === 503;
      await sql.query(
        "UPDATE exports SET state=$1,attempts=$2,next_attempt_at=$3,error_code=$4 WHERE id=$5",
        [
          retryable && attempts < 3 ? "queued" : "failed",
          attempts,
          ctx.now + attempts * 10000,
          error instanceof ApiFailure ? error.code : "STORAGE_UNAVAILABLE",
          job.id,
        ],
      );
    }
    return true;
  });
}
export async function runGasJob(app: App): Promise<boolean> {
  // The single in-flight sponsor transaction prevents nonce reuse after uncertain broadcasts.
  const prepared = await app.db.transaction(async (sql) => {
    const [job] = await sql.query(
      "SELECT * FROM test_gas_requests WHERE state NOT IN ('confirmed','failed') ORDER BY created_at,id LIMIT 1 FOR UPDATE",
    );
    if (!job || Number(job.next_attempt_at) > app.now()) return null;
    if (job.raw_transaction) return job;
    const ctx = jobContext(app, sql, job.wallet);
    try {
      const lease = await leaseAccess(ctx, job.lease_id, ["T", "L", "R", "F"]);
      await gasEligibility(ctx, lease);
      const transfer = await app.chain.prepareGas(
        job.wallet,
        BigInt(job.amount),
      );
      await sql.query(
        "UPDATE test_gas_requests SET state='prepared',raw_transaction=$1,tx_hash=$2,error_code=NULL WHERE id=$3",
        [transfer.raw, transfer.hash, job.id],
      );
      return { ...job, raw_transaction: transfer.raw, tx_hash: transfer.hash };
    } catch (error) {
      const attempts = job.attempts + 1;
      await sql.query(
        "UPDATE test_gas_requests SET state=$1,attempts=$2,next_attempt_at=$3,error_code=$4 WHERE id=$5",
        [
          attempts >= 3 ? "failed" : "queued",
          attempts,
          app.now() + attempts * 10000,
          error instanceof ApiFailure ? error.code : "RPC_ERROR",
          job.id,
        ],
      );
      return null;
    }
  });
  if (!prepared) return false;
  // Commit raw bytes/hash BEFORE broadcasting. Retrying only rebroadcasts this exact transaction.
  await app.db.transaction(async (sql) => {
    const [job] = await sql.query(
      "SELECT * FROM test_gas_requests WHERE id=$1 FOR UPDATE",
      [prepared.id],
    );
    if (
      ["confirmed", "failed"].includes(job.state) ||
      Number(job.next_attempt_at) > app.now()
    )
      return;
    try {
      const receipt = await app.chain.receipt(job.tx_hash);
      if (receipt) {
        await sql.query(
          "UPDATE test_gas_requests SET state=$1,completed_at=$2,gas_used=$3,effective_gas_price=$4,error_code=$5 WHERE id=$6",
          [
            receipt.status === "success" ? "confirmed" : "failed",
            app.now(),
            receipt.gasUsed,
            receipt.effectiveGasPrice,
            receipt.status === "success" ? null : "TRANSFER_REVERTED",
            job.id,
          ],
        );
        return;
      }
      if (job.attempts >= 3) {
        await sql.query(
          "UPDATE test_gas_requests SET error_code='GAS_BROADCAST_UNCERTAIN',next_attempt_at=$1 WHERE id=$2",
          [app.now() + 30000, job.id],
        );
        return;
      }
      // Persist attempt even if broadcast is rejected or its response is lost.
      await sql.query(
        "UPDATE test_gas_requests SET attempts=attempts+1,next_attempt_at=$1 WHERE id=$2",
        [app.now() + 10000, job.id],
      );
      await app.chain.broadcast(job.raw_transaction);
      await sql.query(
        "UPDATE test_gas_requests SET state='broadcast',error_code=NULL WHERE id=$1",
        [job.id],
      );
    } catch {
      await sql.query(
        "UPDATE test_gas_requests SET error_code='GAS_BROADCAST_UNCERTAIN',next_attempt_at=$1 WHERE id=$2",
        [app.now() + 10000, job.id],
      );
    }
  });
  return true;
}
export async function cleanup(
  app: App,
): Promise<{ uploads: number; leases: number }> {
  return app.db.transaction(async (sql) => {
    const now = app.now();
    const expired = await sql.query(
      "SELECT * FROM document_uploads WHERE expires_at <= $1 AND submitted_at IS NULL AND cleaned_at IS NULL",
      [now],
    );
    for (const item of expired) {
      await app.storage.remove(item.storage_key);
      await sql.query("UPDATE document_uploads SET cleaned_at=$1 WHERE id=$2", [
        now,
        item.id,
      ]);
    }
    const leases = await sql.query(
      "SELECT * FROM leases WHERE closed_at <= $1 AND purged_at IS NULL",
      [now - 90 * 86400000],
    );
    let purged = 0;
    for (const lease of leases) {
      const live = await app.chain.lease(lease.contract_address, true);
      if (live.phase !== 11) continue;
      const files = await sql.query(
        "SELECT v.storage_key FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE d.lease_id=$1 UNION SELECT storage_key FROM exports WHERE lease_id=$1 AND storage_key IS NOT NULL",
        [lease.id],
      );
      for (const file of files) await app.storage.remove(file.storage_key);
      await sql.query("UPDATE leases SET purged_at=$1 WHERE id=$2", [
        now,
        lease.id,
      ]);
      await sql.query("UPDATE exports SET state='purged' WHERE lease_id=$1", [
        lease.id,
      ]);
      await audit(sql, null, "retention.purge", lease.id, now, randomUUID());
      purged++;
    }
    await sql.query("DELETE FROM access_grants WHERE expires_at <= $1", [now]);
    await sql.query("DELETE FROM idempotency_keys WHERE expires_at <= $1", [
      now,
    ]);
    await sql.query("DELETE FROM siwe_nonces WHERE expires_at <= $1", [now]);
    await sql.query("DELETE FROM rate_limits WHERE expires_at <= $1", [now]);
    await sql.query("DELETE FROM invites WHERE expires_at <= $1", [now]);
    return { uploads: expired.length, leases: purged };
  });
}

/** Early deletion needs both lease parties' authenticated requests, never a unilateral API delete. */
export async function purgeRequestedLease(app: App, id: string) {
  return app.db.transaction(async (sql) => {
    const [lease] = await sql.query("SELECT * FROM leases WHERE id=$1", [id]);
    requireThat(
      lease && !lease.purged_at,
      409,
      "DATA_PURGED",
      "Lease is unavailable or already purged.",
    );
    const requests = await sql.query(
      "SELECT DISTINCT actor FROM audit_log WHERE action='retention.request' AND resource_id=$1",
      [id],
    );
    requireThat(
      lease.tenant &&
        [lease.landlord, lease.tenant].every((actor) =>
          requests.some((r) => r.actor === actor),
        ),
      409,
      "CONSENT_REQUIRED",
      "Both lease parties must request early deletion.",
    );
    const files = await sql.query(
      "SELECT v.storage_key FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE d.lease_id=$1 UNION SELECT u.storage_key FROM document_uploads u JOIN documents d ON d.id=u.document_id WHERE d.lease_id=$1 UNION SELECT storage_key FROM exports WHERE lease_id=$1 AND storage_key IS NOT NULL",
      [id],
    );
    for (const file of files) await app.storage.remove(file.storage_key);
    await sql.query("UPDATE leases SET purged_at=$1 WHERE id=$2", [
      app.now(),
      id,
    ]);
    await sql.query("UPDATE exports SET state='purged' WHERE lease_id=$1", [
      id,
    ]);
    await audit(
      sql,
      null,
      "retention.early-purge",
      id,
      app.now(),
      randomUUID(),
    );
    return { leaseId: id, purged: true };
  });
}
