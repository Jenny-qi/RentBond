# D To E: Durable Tasks And Reorgs

Delivered 2026-10-02 against main b664c0a. Import createTaskStore and syncLease from apps/worker/src/persistence/backend.mjs using Node 24.14.x. The adapter shares D's PostgreSQL connection/configuration and migration 0003. Embedded PGlite supports a single process only. No HTTP endpoint accepts a task, event, arbitrary snapshot or transaction bytes.

E's existing JSON executor is still separate. This document and the executable integration tests are the integration contract; they do not claim that E's production loop has adopted it.

## Data Contract

enqueue accepts exactly leaseId (database UUID), kind, optional caseId, dueAt, sourceBlock and sourceHash. Kinds are CLOSE_CLAIMS, MARK_SERVICE_TIMEOUT and FINALIZE_TIMEOUT, mapping to the fixed ABI's closeClaims(), markServiceTimeout(caseId) and finalizeTimeout(caseId). These are public deadline actions, never a party/resolver action or withdrawal.

dueAt is a decimal UTC-second string and must equal the appropriate deadline in the stored confirmed snapshot. sourceBlock is a decimal block-number string, sourceHash a bytes32 hash, and both must match the current checkpoint AND projection. Use the checkpoint returned by synchronization, not the original triggering event height if synchronization has moved beyond it. caseId must match the snapshot's exact active case. Milliseconds and a block height used as a deadline are rejected. Database next_attempt_at, locked_until and audit times are epoch milliseconds.

## Required Call Order

1. Construct D's App using readConfig/openDatabase/createChain/createStorage/createScanner and the same environment as the API; do not share a PGlite directory between processes. Run migrations before startup.
2. await syncLease(app, leaseId). Events, case canonicality, projection, checkpoint and task invalidation commit together; failed RPC reads roll everything back.
3. await store.enqueue(input). Replays return the existing task. Conflicting deadlines fail; existing signed/reconcile tasks are never replaced.
4. Read a confirmed block timestamp from the validated RPC; await store.claim(timestamp.toString()). It returns null or a task with lock_token and a 120-second lease. Multiple database connections cannot own the same task, and active signing work blocks another nonce preparation.
5. Recheck live contract phase, exact case and deadline; simulate the public call. E owns this preflight, signer policy, gas funding and finality. Do not use the wall clock or substitute another action after claiming.
6. Prepare and sign using the dedicated Worker account. await store.prepare(id, token, raw) MUST finish before sending. It verifies chain ID, target, zero value and exact ABI calldata, and saves signed bytes and their derived hash.
7. Broadcast those exact persisted bytes. await store.broadcast(id, token) records the attempt and releases the claim for later receipt polling. On restart, a claimed prepared/broadcast task carries the same raw_transaction and tx_hash: check its receipt first, then only rebroadcast the identical transaction when still appropriate.
8. await store.complete(id, token) fetches the confirmed receipt through D's chain adapter; false means still pending. Only a confirmed success becomes confirmed; revert becomes failed. A lost token cannot complete work.

If an unsigned attempt fails, store.retry(id, token, "RPC_UNAVAILABLE") applies a 10-second delay and a three-attempt ceiling. If a signed attempt is uncertain, retry moves it to reconcile. Three expired signed claims also enter reconcile. That state blocks new signer work rather than risking another nonce.

## Rollback And Recovery

On checkpoint mismatch, syncLease cancels all unsigned tasks for the lease and marks signed tasks (including previously confirmed ones) reconcile, preserving their raw bytes/hash/receipt and clearing old locks. E must reread the canonical state before enqueuing replacements. Calling syncLease repeatedly on a stable checkpoint does not invalidate good tasks.

store.reconcile(id) only resolves a reconcile task when the chain adapter finds its confirmed receipt; it never rebroadcasts. A missing receipt keeps the task blocked. If a reorg removed the source or a transaction remains absent, E/operator must inspect canonical state and signer nonce before any manual repair; do not delete the row or prepare another payment. Automatic cancellation/replacement of already signed work is intentionally unsupported.

Jobs carry no role keys or arbitrary payload command. Database access is server-only, protected by RLS/revoked client grants. Log IDs, states and sanitized error codes; do not log raw transactions, credentials or private materials.

## Evidence

- apps/web/src/server/tests/worker-tasks.test.mjs imports the E-facing adapter and tests deduplication, UTC boundaries, concurrent ownership, stale locks, durable signed bytes, receipt handling and transactional reorg invalidation.
- apps/web/src/server/tests/deployment.integration.mjs repeats enqueue/claim races over two real PostgreSQL connections and recovers an expired claim through a newly opened third connection.
- These verify the D persistence boundary. E still owns actual deadline dispatch, a dedicated signer, full Worker restart/manual-advance scenarios, and public-chain acceptance.
