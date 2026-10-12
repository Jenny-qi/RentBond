# Durable Worker

Node 24 runs `src/main.ts` as an independent process using D's database, migrations and confirmed chain adapter. The generated repository ABI is the only event/call source.

## Start

```sh
npm run backend:abi --prefix apps/web
npm run worker:dev
# One cycle:
node --env-file-if-exists=apps/web/.env.local apps/worker/src/main.ts --once
npm run worker:health
npm run test:worker
```

Configuration uses the same `.env.local` as the API: SESSION_SECRET, CHAIN_ID, RPC_URL, NEXT_PUBLIC_FACTORY_ADDRESS (or FACTORY_ADDRESS), DATABASE_URL. DEPLOYMENT_BLOCK is required. WORKER_BATCH_SIZE defaults to 1000; WORKER_POLL_INTERVAL_MS defaults to 5000. Supported chains: 31337 (local EVM) and 10143 (Monad testnet).

For on-chain execution set WORKER_EXECUTE=true, WORKER_PRIVATE_KEY_FILE and WORKER_GAS_ACCOUNT. Do not commit keys.

## Public actions

| Task | ABI function |
| --- | --- |
| START_SETTLEMENT | startScheduledSettlement() |
| CLOSE_CLAIMS | closeClaims() |
| OPEN_CLAIM_CASE | openClaimCase() |
| ESCALATE_TIMEOUT | escalateTimeout(caseId) |
| FINALIZE_PRIMARY | finalizePrimary(caseId) |
| MARK_SERVICE_TIMEOUT | markServiceTimeout(caseId) |
| FINALIZE_TIMEOUT | finalizeTimeout(caseId) |
| EXPIRE_ESCROW | expireEscrow() |

Deadlines use chain UTC seconds; block heights only anchor canonicality. The Worker never accepts terms, decides awards, funds leases or withdraws for a role.

## Verification

Integration tests IT-01–IT-09 cover event idempotency, reorg rollback, durable restart, RPC fault, gas quota, session expiry and UTC-deadline/block-height separation. See [docs/acceptance.md](../../docs/acceptance.md) for current status.

Real Monad execution, all eight actions on testnet, real PostgreSQL recovery, second-person reproduction and physical-device restoration remain pending acceptance.
