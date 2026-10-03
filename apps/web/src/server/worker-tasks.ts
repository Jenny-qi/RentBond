import { randomUUID } from "node:crypto";
import {
  encodeFunctionData,
  keccak256,
  parseTransaction,
  type Hex,
} from "viem";
import { z } from "zod";
import type { App } from "./context.ts";
import type { Sql, Row } from "./db.ts";
import { escrowAbi } from "./chain.ts";
import { hash, uuid } from "./schemas.ts";
import { requireThat } from "./errors.ts";
import { workerActions, actionDeadline, type WorkerKind } from "./worker-actions.ts";

const uint = z.string().regex(/^(0|[1-9][0-9]{0,19})$/);
const inputSchema = z
  .object({
    leaseId: uuid,
    kind: z.enum(Object.keys(workerActions) as [WorkerKind, ...WorkerKind[]]),
    caseId: uint.optional(),
    dueAt: uint.refine((v) => BigInt(v) > 0n && BigInt(v) < 100000000000n),
    sourceBlock: uint,
    sourceHash: hash,
  })
  .strict();

/** Called in the same transaction as event/checkpoint rollback. Signed work needs reconciliation. */
export async function invalidateWorkerTasks(
  sql: Sql,
  leaseId: string,
  now: number,
) {
  await sql.query(
    "UPDATE worker_tasks SET state=CASE WHEN raw_transaction IS NULL THEN 'cancelled' ELSE 'reconcile' END,error_code='CHAIN_REORG',lock_token=NULL,locked_until=NULL,updated_at=$1 WHERE lease_id=$2 AND state NOT IN ('cancelled','reconcile')",
    [now, leaseId],
  );
}

/** Server-only adapter; no HTTP endpoint accepts jobs or signed transactions. */
export function createTaskStore(
  app: Pick<App, "db" | "config" | "now" | "chain">,
) {
  const confirmedReceipt = async (job: Row) => {
    const receipt = await app.chain.receipt(job.tx_hash);
    if (!receipt) return null;
    requireThat(
      receipt.transactionHash === job.tx_hash &&
        /^0x[0-9a-f]{64}$/.test(receipt.blockHash) &&
        ["success", "reverted"].includes(receipt.status),
      503,
      "RECEIPT_MISMATCH",
      "RPC receipt does not belong to this transaction.",
    );
    return receipt;
  };
  const owned = async (
    sql: Sql,
    id: string,
    token: string,
    states: string[],
  ) => {
    const [row] = await sql.query(
      "SELECT t.*,l.contract_address FROM worker_tasks t JOIN leases l ON l.id=t.lease_id WHERE t.id=$1 FOR UPDATE",
      [uuid.parse(id)],
    );
    requireThat(
      row &&
        row.lock_token === token &&
        Number(row.locked_until) > app.now() &&
        states.includes(row.state),
      409,
      "TASK_LOCK_LOST",
      "Task ownership expired or changed.",
    );
    return row;
  };
  return {
    async enqueue(value: unknown) {
      const input = inputSchema.parse(value);
      return app.db.transaction(async (sql) => {
        const [lease] = await sql.query("SELECT * FROM leases WHERE id=$1", [
          input.leaseId,
        ]);
        const [checkpoint] = lease
          ? await sql.query(
              "SELECT * FROM chain_checkpoints WHERE chain_id=$1 AND contract_address=$2",
              [app.config.chainId, lease.contract_address],
            )
          : [];
        requireThat(
          lease &&
            !lease.purged_at &&
            checkpoint &&
            String(checkpoint.block_number) === input.sourceBlock &&
            checkpoint.block_hash === input.sourceHash &&
            String(lease.sync_block) === input.sourceBlock &&
            lease.sync_block_hash === input.sourceHash,
          409,
          "TASK_SOURCE_STALE",
          "Synchronize the confirmed lease before scheduling.",
        );
        const snapshot = lease.projection,
          active = snapshot.activeCase;
        const deadline = actionDeadline(snapshot, input.kind);
        requireThat(
          input.dueAt === String(deadline) &&
            (!workerActions[input.kind].case
              ? input.caseId === undefined
              : active.exists && input.caseId === String(active.caseId)),
          422,
          "TASK_DEADLINE_MISMATCH",
          "Use the contract UTC deadline and exact case.",
        );
        const [existing] = await sql.query(
          "SELECT * FROM worker_tasks WHERE lease_id=$1 AND kind=$2 AND case_id IS NOT DISTINCT FROM $3::numeric AND state<>'cancelled' ORDER BY created_at LIMIT 1",
          [input.leaseId, input.kind, input.caseId ?? null],
        );
        if (existing) {
          requireThat(
            String(existing.due_at) === input.dueAt,
            409,
            "TASK_CONFLICT",
            "Reconcile existing work before changing its deadline.",
          );
          return existing;
        }
        const key = [
          input.leaseId,
          input.kind,
          input.caseId ?? "lease",
          input.dueAt,
          input.sourceHash,
        ].join(":");
        const [row] = await sql.query(
          "INSERT INTO worker_tasks(id,lease_id,kind,case_id,due_at,source_block,source_hash,dedupe_key,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) ON CONFLICT(dedupe_key) DO UPDATE SET state='queued',attempts=0,next_attempt_at=0,lock_token=NULL,locked_until=NULL,error_code=NULL,updated_at=EXCLUDED.updated_at WHERE worker_tasks.state='cancelled' AND worker_tasks.raw_transaction IS NULL RETURNING *",
          [
            randomUUID(),
            input.leaseId,
            input.kind,
            input.caseId ?? null,
            input.dueAt,
            input.sourceBlock,
            input.sourceHash,
            key,
            JSON.stringify(input),
            app.now(),
          ],
        );
        requireThat(
          row,
          409,
          "TASK_CONFLICT",
          "Reconcile existing signed work before rescheduling.",
        );
        return row;
      });
    },
    async claim(confirmedChainTime: string) {
      const time = uint
        .refine((v) => BigInt(v) < 100000000000n)
        .parse(confirmedChainTime);
      return app.db.transaction(async (sql) => {
        await sql.query(
          "UPDATE worker_tasks SET state=CASE WHEN raw_transaction IS NULL THEN 'failed' ELSE 'reconcile' END,error_code='ATTEMPTS_EXHAUSTED',lock_token=NULL,locked_until=NULL,updated_at=$1 WHERE attempts>=max_attempts AND state IN ('queued','running','prepared','broadcast') AND (locked_until IS NULL OR locked_until<=$1)",
          [app.now()],
        );
        // Serialize signed work for this shared worker signer until receipt or explicit reconciliation.
        const [uncertain] = await sql.query(
          "SELECT id FROM worker_tasks WHERE state='reconcile' LIMIT 1",
        );
        if (uncertain) return null;
        const [signed] = await sql.query(
          "SELECT * FROM worker_tasks WHERE state IN ('prepared','broadcast') ORDER BY created_at,id LIMIT 1",
        );
        if (
          signed &&
          (Number(signed.locked_until) > app.now() ||
            Number(signed.next_attempt_at) > app.now())
        )
          return null;
        const [job] = signed
          ? [signed]
          : await sql.query(
              "SELECT * FROM worker_tasks WHERE due_at<=$1 AND attempts<max_attempts AND next_attempt_at<=$2 AND (state='queued' OR (state='running' AND locked_until<=$2)) ORDER BY due_at,id LIMIT 1 FOR UPDATE",
              [time, app.now()],
            );
        if (!job) return null;
        // A running signer also blocks another claim, avoiding concurrent nonce preparation.
        const [running] = await sql.query(
          "SELECT id FROM worker_tasks WHERE state='running' AND locked_until>$1 LIMIT 1",
          [app.now()],
        );
        if (running) return null;
        const [claimed] = await sql.query(
          "UPDATE worker_tasks SET state=CASE WHEN raw_transaction IS NULL THEN 'running' ELSE state END,attempts=attempts+1,lock_token=$1,locked_until=$2,updated_at=$3 WHERE id=$4 RETURNING *",
          [randomUUID(), app.now() + 120000, app.now(), job.id],
        );
        return claimed;
      });
    },
    async prepare(id: string, token: string, raw: Hex) {
      requireThat(
        /^0x([0-9a-fA-F]{2}){1,16384}$/.test(raw),
        422,
        "INVALID_TRANSACTION",
        "Invalid signed bytes.",
      );
      return app.db.transaction(async (sql) => {
        const job = await owned(sql, id, token, ["running"]);
        const tx = parseTransaction(raw);
        const data = encodeFunctionData({
          abi: escrowAbi,
          functionName: workerActions[job.kind as WorkerKind].fn,
          args: job.case_id === null ? [] : [BigInt(job.case_id)],
        });
        requireThat(
          Number(tx.chainId) === app.config.chainId &&
            tx.to?.toLowerCase() === job.contract_address &&
            (tx.value ?? 0n) === 0n &&
            tx.data === data &&
            !!tx.r &&
            !!tx.s,
          422,
          "INVALID_TRANSACTION",
          "Transaction must match the scheduled public action.",
        );
        const txHash = keccak256(raw);
        const [row] = await sql.query(
          "UPDATE worker_tasks SET state='prepared',raw_transaction=$1,tx_hash=$2,updated_at=$3 WHERE id=$4 RETURNING *",
          [raw, txHash, app.now(), id],
        );
        return row;
      });
    },
    async broadcast(id: string, token: string) {
      return app.db.transaction(async (sql) => {
        await owned(sql, id, token, ["prepared", "broadcast"]);
        const [row] = await sql.query(
          "UPDATE worker_tasks SET state='broadcast',lock_token=NULL,locked_until=NULL,next_attempt_at=$1,updated_at=$2 WHERE id=$3 RETURNING *",
          [app.now() + 10000, app.now(), id],
        );
        return row;
      });
    },
    async complete(id: string, token: string) {
      return app.db.transaction(async (sql) => {
        const job = await owned(sql, id, token, ["prepared", "broadcast"]);
        const parsed = await confirmedReceipt(job);
        if (!parsed) return false;
        await sql.query(
          "UPDATE worker_tasks SET state=$1,receipt=$2,lock_token=NULL,locked_until=NULL,updated_at=$3,error_code=$4 WHERE id=$5",
          [
            parsed.status === "success" ? "confirmed" : "failed",
            JSON.stringify(parsed),
            app.now(),
            parsed.status === "success" ? null : "TX_REVERTED",
            id,
          ],
        );
        return true;
      });
    },
    async reconcile(id: string) {
      return app.db.transaction(async (sql) => {
        const [job] = await sql.query(
          "SELECT * FROM worker_tasks WHERE id=$1 FOR UPDATE",
          [uuid.parse(id)],
        );
        requireThat(
          job?.state === "reconcile",
          409,
          "TASK_CONFLICT",
          "Task is not awaiting reconciliation.",
        );
        const receipt = await confirmedReceipt(job);
        if (!receipt) return false;
        await sql.query(
          "UPDATE worker_tasks SET state=$1,receipt=$2,error_code=$3,updated_at=$4 WHERE id=$5",
          [
            receipt.status === "success" ? "confirmed" : "failed",
            JSON.stringify(receipt),
            receipt.status === "success" ? null : "TX_REVERTED",
            app.now(),
            id,
          ],
        );
        return true;
      });
    },
    async retry(id: string, token: string, code: string) {
      requireThat(
        /^[A-Z][A-Z0-9_]{0,63}$/.test(code),
        422,
        "INVALID_INPUT",
        "Use a non-sensitive error code.",
      );
      return app.db.transaction(async (sql) => {
        const job = await owned(sql, id, token, [
          "running",
          "prepared",
          "broadcast",
        ]);
        const state = job.raw_transaction
          ? "reconcile"
          : job.attempts >= job.max_attempts
            ? "failed"
            : "queued";
        await sql.query(
          "UPDATE worker_tasks SET state=$1,error_code=$2,lock_token=NULL,locked_until=NULL,next_attempt_at=$3,updated_at=$4 WHERE id=$5",
          [state, code, app.now() + 10000, app.now(), id],
        );
      });
    },
    async cancel(id: string, token: string) {
      return app.db.transaction(async (sql) => {
        await owned(sql, id, token, ["running"]);
        await sql.query("UPDATE worker_tasks SET state='cancelled',error_code='OBSOLETE_STATE',lock_token=NULL,locked_until=NULL,updated_at=$1 WHERE id=$2 AND raw_transaction IS NULL", [app.now(), id]);
      });
    },
    async get(id: string): Promise<Row | null> {
      return (
        (
          await app.db.query("SELECT * FROM worker_tasks WHERE id=$1", [
            uuid.parse(id),
          ])
        )[0] ?? null
      );
    },
  };
}
