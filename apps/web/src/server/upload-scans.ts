import { randomUUID } from "node:crypto";
import type { App, Context } from "./context.ts";
import type { Row } from "./db.ts";
import { sha256 } from "./crypto.ts";
import { detectMime } from "./storage.ts";
import { ApiFailure, requireThat } from "./errors.ts";
import { audit } from "./auth.ts";
import { scopeAccess } from "./acl.ts";

export function requireCleanScan(app: App, row: Row): void {
  if (row.scan_state === "rejected")
    throw new ApiFailure(
      422,
      "FILE_REJECTED",
      "File was rejected by security checks.",
    );
  if (row.scan_state === "error")
    throw new ApiFailure(
      503,
      "SCAN_UNAVAILABLE",
      "File scanning is unavailable. Retry later.",
      true,
    );
  requireThat(
    row.scan_state === "clean" &&
      row.scan_digest === row.expected_hash &&
      (app.config.scanMode === "disabled-local" ||
        row.scan_engine?.startsWith("ClamAV ")),
    409,
    "SCAN_PENDING",
    "File is awaiting a completed security scan.",
  );
}

export async function scanStatus(
  ctx: Context,
  documentId: string,
  uploadId: string,
) {
  const [row] = await ctx.sql.query(
    "SELECT u.*,d.author,d.lease_id,d.case_id FROM document_uploads u JOIN documents d ON d.id=u.document_id WHERE u.id=$1 AND d.id=$2",
    [uploadId, documentId],
  );
  requireThat(
    row && row.author === ctx.session.wallet,
    403,
    "FORBIDDEN",
    "Upload belongs to another account.",
  );
  const [lease] = await ctx.sql.query(
    "SELECT purged_at FROM leases WHERE id=$1",
    [row.lease_id],
  );
  requireThat(
    lease && !lease.purged_at,
    410,
    "DATA_PURGED",
    "Private materials have been deleted.",
  );
  await scopeAccess(ctx, row.lease_id, row.case_id ?? undefined);
  requireThat(
    !row.cleaned_at && (row.submitted_at || Number(row.expires_at) > ctx.now),
    410,
    "UPLOAD_EXPIRED",
    "Upload expired.",
  );
  return {
    documentId,
    uploadId,
    version: row.version,
    scanStatus: row.scan_state,
    uploaded: !!row.uploaded_at,
    submitted: !!row.submitted_at,
    errorCode: row.scan_error,
    expiresAt: Number(row.expires_at),
    retryable: row.scan_state === "error" && row.scan_attempts < 3,
  };
}

export async function runScanJob(app: App): Promise<boolean> {
  const token = randomUUID();
  const job = await app.db.transaction(async (sql) => {
    await sql.query(
      "UPDATE document_uploads SET scan_state='error',scan_error='SCAN_ATTEMPTS_EXHAUSTED',scan_token=NULL,scan_lock_until=NULL WHERE scan_state='scanning' AND scan_lock_until<=$1 AND scan_attempts>=3",
      [app.now()],
    );
    const [row] = await sql.query(
      "SELECT u.*,d.lease_id,d.author FROM document_uploads u JOIN documents d ON d.id=u.document_id JOIN leases l ON l.id=d.lease_id WHERE u.uploaded_at IS NOT NULL AND u.cleaned_at IS NULL AND l.purged_at IS NULL AND (u.submitted_at IS NOT NULL OR u.expires_at>$1) AND ((u.scan_state IN ('pending','error') AND u.scan_attempts<3 AND u.scan_next_at<=$1) OR (u.scan_state='scanning' AND u.scan_lock_until<=$1) OR (u.scan_state='clean' AND u.scan_engine='disabled-local' AND $2)) ORDER BY u.expires_at,u.id LIMIT 1 FOR UPDATE",
      [app.now(), app.config.scanMode !== "disabled-local"],
    );
    if (!row) return null;
    await sql.query(
      "UPDATE document_uploads SET scan_state='scanning',scan_token=$1,scan_lock_until=$2,scan_attempts=scan_attempts+1 WHERE id=$3",
      [token, app.now() + 120000, row.id],
    );
    return row;
  });
  if (!job) return false;
  let state = "error",
    engine: string | null = null,
    bytes: Uint8Array | undefined,
    errorCode = "SCAN_UNAVAILABLE";
  try {
    bytes = await (
      job.scan_source === "legacy" ? app.storage : app.quarantine
    ).get(job.storage_key);
    if (
      bytes.length !== job.expected_size ||
      sha256(bytes) !== job.expected_hash ||
      detectMime(bytes) !== job.mime
    ) {
      state = "rejected";
      errorCode = "FILE_MISMATCH";
    } else {
      const result = await app.scanner.scan(bytes);
      engine = result.engine;
      state = result.clean ? "clean" : "rejected";
      errorCode = result.clean ? "" : "FILE_REJECTED";
    }
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 422) {
      state = "rejected";
      errorCode = "FILE_MISMATCH";
    }
  }
  await app.db.transaction(async (sql) => {
    const [current] = await sql.query(
      "SELECT u.*,l.purged_at FROM document_uploads u JOIN documents d ON d.id=u.document_id JOIN leases l ON l.id=d.lease_id WHERE u.id=$1 FOR UPDATE",
      [job.id],
    );
    if (
      !current ||
      current.scan_token !== token ||
      current.purged_at ||
      current.cleaned_at
    )
      return;
    try {
      if (state === "clean" && bytes && job.scan_source !== "legacy") {
        try {
          await app.storage.put(job.storage_key, bytes, job.mime);
        } catch (error) {
          const previous = await app.storage
            .get(job.storage_key)
            .catch(() => null);
          if (!previous || sha256(previous) !== job.expected_hash) throw error;
        }
      }
      if (state === "rejected" && bytes && job.scan_source === "legacy") {
        // Legacy originals are unavailable while rescanning; retain a private isolated copy.
        try {
          await app.quarantine.put(job.storage_key, bytes, job.mime);
        } catch {
          /* Never make a rejected original readable when quarantine is unavailable. */
        }
        await app.storage.remove(job.storage_key);
      }
    } catch {
      state = "error";
      errorCode = "STORAGE_UNAVAILABLE";
    }
    await sql.query(
      "UPDATE document_uploads SET scan_state=$1,scan_engine=$2,scan_digest=$3,scanned_at=$4,scan_error=$5,scan_next_at=$6,scan_lock_until=NULL,scan_token=NULL WHERE id=$7",
      [
        state,
        engine,
        state === "clean" ? job.expected_hash : null,
        app.now(),
        errorCode || null,
        app.now() + 30000,
        job.id,
      ],
    );
    await audit(
      sql,
      job.author,
      "upload.scan." + state,
      job.document_id,
      app.now(),
      randomUUID(),
    );
  });
  return true;
}
