/**
 * Export job processing — CSV lease accounting generation from on-chain events.
 *
 * PDF generation is deferred until a PDF library is added to the workspace.
 *
 * E owns; D defines the export format contract.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const EXPORT_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
} as const;
export type ExportStatus = (typeof EXPORT_STATUS)[keyof typeof EXPORT_STATUS];

export interface ExportJob {
  id: string;
  leaseAddress: string;
  format: 'pdf' | 'csv';
  status: ExportStatus;
  createdAt: number;
  completedAt?: number;
  error?: string;
  resultPath?: string;  // path to generated file when done
}

interface ExportStore {
  jobs: Record<string, ExportJob>;
}

// ---------------------------------------------------------------------------
// Export store (JSON file, same pattern as job-store)
// ---------------------------------------------------------------------------

async function loadExportStore(path: string): Promise<ExportStore> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as ExportStore;
  } catch {
    return { jobs: {} };
  }
}

async function saveExportStore(path: string, store: ExportStore): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path + '.tmp', JSON.stringify(store, null, 2), 'utf-8');
  await rename(path + '.tmp', path);
}

// ---------------------------------------------------------------------------
// Export job queue
// ---------------------------------------------------------------------------

export async function enqueueExportJob(
  storePath: string,
  job: ExportJob
): Promise<void> {
  const store = await loadExportStore(storePath);
  store.jobs[job.id] = job;
  await saveExportStore(storePath, store);
  console.log(`[EXPORTS] Enqueued export job: ${job.id} (${job.format})`);
}

export async function processExportJob(
  storePath: string,
  jobId: string,
  escrowReadFn: (addr: string) => Promise<Record<string, unknown>>
): Promise<void> {
  const store = await loadExportStore(storePath);
  const job = store.jobs[jobId];
  if (!job) throw new Error(`Export job not found: ${jobId}`);

  job.status = EXPORT_STATUS.PROCESSING;
  await saveExportStore(storePath, store);

  try {
    let resultPath: string;

    if (job.format === 'csv') {
      resultPath = await buildLeaseCsv(job.leaseAddress, escrowReadFn);
    } else {
      throw new Error('PDF export not yet implemented — add a PDF library to workspace');
    }

    job.status = EXPORT_STATUS.DONE;
    job.completedAt = Date.now();
    job.resultPath = resultPath;
    job.error = undefined;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    job.status = EXPORT_STATUS.FAILED;
    job.error = msg;
  }

  await saveExportStore(storePath, store);
  console.log(`[EXPORTS] Export job ${jobId}: ${job.status}`);
}

// ---------------------------------------------------------------------------
// CSV generation (pure Node — no external dependencies)
// ---------------------------------------------------------------------------

/**
 * Generate a CSV accounting history for a lease from on-chain events.
 *
 * Columns: event, amount, beneficiary, txHash, blockNumber, timestamp
 *
 * @param escrowAddress  DepositEscrow contract address
 * @param escrowReadFn  Async function that reads escrow on-chain data
 */
export async function buildLeaseCsv(
  escrowAddress: string,
  escrowReadFn: (addr: string) => Promise<Record<string, unknown>>
): Promise<string> {
  // Read on-chain accounting state
  const acct = await escrowReadFn(escrowAddress) as {
    fundedAmount?: bigint;
    unallocated?: bigint;
    tenantCredit?: bigint;
    landlordCredit?: bigint;
    tenantWithdrawn?: bigint;
    landlordWithdrawn?: bigint;
  };

  const rows: string[] = [
    'event,amount,beneficiary,field,txHash,blockNumber',
  ];

  const funded = BigInt(acct.fundedAmount ?? 0);
  const unallocated = BigInt(acct.unallocated ?? 0);
  const tenantCredit = BigInt(acct.tenantCredit ?? 0);
  const landlordCredit = BigInt(acct.landlordCredit ?? 0);
  const tenantWithdrawn = BigInt(acct.tenantWithdrawn ?? 0);
  const landlordWithdrawn = BigInt(acct.landlordWithdrawn ?? 0);

  // Current state snapshot
  const fmt = (n: bigint) => (Number(n) / 1_000_000).toFixed(6); // 6 decimals

  if (funded > 0n) rows.push(`Funded,${fmt(funded)},tenant,fundedAmount,,`);
  if (unallocated > 0n) rows.push(`,${fmt(unallocated)},,unallocated,,`);
  if (tenantCredit > 0n) rows.push(`,${fmt(tenantCredit)},tenant,tenantCredit,,`);
  if (landlordCredit > 0n) rows.push(`,${fmt(landlordCredit)},landlord,landlordCredit,,`);
  if (tenantWithdrawn > 0n) rows.push(`Withdrawn,${fmt(tenantWithdrawn)},tenant,tenantWithdrawn,,`);
  if (landlordWithdrawn > 0n) rows.push(`Withdrawn,${fmt(landlordWithdrawn)},landlord,landlordWithdrawn,,`);

  // Conservation check row
  const total = unallocated + tenantCredit + landlordCredit + tenantWithdrawn + landlordWithdrawn;
  const conserved = funded === total ? 'OK' : 'VIOLATED';
  rows.push(`Conservation,${fmt(funded)},${fmt(total)},${conserved},,`);

  return rows.join('\n');
}

/**
 * Build a PDF summary for a lease.
 * Requires adding a PDF library (pdfkit / jspdf / pdf-lib) to the workspace.
 */
export async function buildLeasePdf(
  _leaseAddress: string,
  _escrowReadFn: (addr: string) => Promise<Record<string, unknown>>
): Promise<Buffer> {
  throw new Error(
    'PDF export requires adding a PDF library to the workspace. ' +
    'Add pdfkit or jspdf to apps/worker/package.json, then implement this function.'
  );
}
