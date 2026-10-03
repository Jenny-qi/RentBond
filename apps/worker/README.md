# Durable Worker (E / D)

Node 24 runs `src/main.ts` as an independent process using D's database, migrations and confirmed chain adapter. The generated repository ABI is the only event/call source. Factory discovery records public metadata; a signed-in landlord must still attach a deployment through the API before private lease synchronization starts.

## Start

Install the workspace lockfile, then run:

```sh
npm run backend:abi --prefix apps/web
npm run worker:dev
# One cycle, for operators:
node --env-file-if-exists=apps/web/.env.local apps/worker/src/main.ts --once
npm run worker:health # configuration only; no RPC/database connectivity probe
npm run test:worker
```

Use the API's configuration: SESSION_SECRET, CHAIN_ID, RPC_URL, optional RPC_FALLBACK_URL, NEXT_PUBLIC_FACTORY_ADDRESS (or FACTORY_ADDRESS), and DATABASE_URL. DEPLOYMENT_BLOCK is required and must be the actual factory deployment block. WORKER_BATCH_SIZE defaults to 1000; WORKER_POLL_INTERVAL_MS defaults to 5000. Read-only synchronization is the default.

Separate API/Worker processes require PostgreSQL. Embedded PGlite is supported only for a single process and the disk-backed restart test, never concurrent processes sharing one directory.

For public deadline execution explicitly set WORKER_EXECUTE=true, WORKER_PRIVATE_KEY_FILE to an operator-managed secret file, and WORKER_GAS_ACCOUNT to its expected address. The account must differ from T/L/R/F and the Gas sponsor. Do not commit keys. WORKER_MAX_FEE_WEI bounds gas times maximum fee (default 0.05 test MON; maximum 1). Supported Worker chains are 31337 (local EVM) and 10143 (Monad testnet); other chain IDs are rejected even in local mode. Poll interval must be 1000–300000 ms.

## Public actions

| Task | Fixed ABI function |
| --- | --- |
| START_SETTLEMENT | startScheduledSettlement() |
| CLOSE_CLAIMS | closeClaims() |
| OPEN_CLAIM_CASE | openClaimCase() |
| ESCALATE_TIMEOUT | escalateTimeout(caseId) |
| FINALIZE_PRIMARY | finalizePrimary(caseId) |
| MARK_SERVICE_TIMEOUT | markServiceTimeout(caseId) |
| FINALIZE_TIMEOUT | finalizeTimeout(caseId) |
| EXPIRE_ESCROW | expireEscrow() |

Candidates come from the confirmed snapshot. Deadlines use chain UTC seconds; block heights only anchor canonicality. Before signing and broadcasting, the Worker checks the live phase, exact case, deadline, role policy and simulation. It never accepts terms, decides awards, funds leases or withdraws for a role.

Signed bytes/hash are committed before broadcast. Restart checks the confirmed receipt before retrying identical bytes. Unsigned obsolete work cancels; uncertain signed work enters reconcile and blocks new signer work. A missing receipt requires operator inspection of canonical state and nonce; never delete the task to bypass this safeguard.

Factory/escrow checkpoint mismatch invalidates canonical events and projections, cancels unsigned work and fences signed work. RPC read errors roll back the affected lease transaction. SIGINT/SIGTERM stop between cycles; once-mode exits nonzero on sync errors.

## Evidence and remaining work

See [local runtime report](../../tests/reports/2026-10-03-worker-runtime.md). Real local EVM tests cover replay, reorg, RPC fault, process restart, manual progress service timeout dispatch, primary finalization and hard-end expiry. These do not prove deployed Monad execution, all eight actions on Monad, real PostgreSQL runtime recovery, a second person's reproduction, device restoration or the eight browser E2E scenarios. Notifications and asynchronous exports remain outside this loop.
