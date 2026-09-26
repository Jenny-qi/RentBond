# Member D Backend Handoff

Scope: SIWE/session, drafts/invitations, schema/migrations, private files and ACL, immutable materials, private claim/response/decision text, exports, bounded test MON sponsor, and E's event/job persistence boundary.

## Start Locally Without Cloud Services

From the repository root with Node 24.14.x:

```sh
npm ci --prefix packages/shared
npm ci --prefix apps/web
npm run backend:init
npm run db:migrate
npm run fixtures:seed
npm run dev --prefix apps/web
```

The API is at http://localhost:3000/api/health. Initialization creates an ignored apps/web/.env.local with a random session secret. The fictional seed uses public local-only test keys through actual signed API login; it creates an unexecuted draft and invitation claim, never a fake funded lease. Existing C pages still use explicitly marked fixtures until C connects these APIs.

The local database and private objects are in apps/web/.rentbond. Only one process may open the embedded database. After the API initializes, the local web server checks export/sponsor jobs every five seconds and runs bounded chain synchronization and retention every minute. Stop it before running migration/seed/cleanup commands. A running local web process needs no separate backend worker.

## Optional Shared PostgreSQL

Set RENTBOND_DB_PASSWORD for the shell and run docker compose -f infra/compose.yaml up -d. The image is pinned by digest; the tested version is PostgreSQL 17.11. Set DATABASE_URL in apps/web/.env.local to this database, then run npm run db:migrate. Do not interpolate or commit a real password in a script.

With PostgreSQL, start npm run backend:worker in a second terminal. The worker runs export jobs, sponsor reconciliation, retention, and bounded read-only event synchronization. It does not replace E's RB-12 public deadline-transaction scheduler or notification delivery.

## Environment

| Configuration | Meaning |
| --- | --- |
| NEXT_PUBLIC_APP_ENV | local or testnet only |
| NEXT_PUBLIC_APP_URL | Exact SIWE and CSRF origin; HTTPS outside local loopback |
| CHAIN_ID / NEXT_PUBLIC_CHAIN_ID | Must agree; testnet mode accepts Monad testnet 10143 only |
| SESSION_SECRET | At least 32 characters; protects cached private responses; rotate with session revocation |
| DATABASE_URL | Optional in local mode; PostgreSQL required for shared testnet processes |
| RENTBOND_DATA_DIR | Private durable directory for embedded DB and local originals |
| RPC_URL / RPC_FALLBACK_URL | Both validated using eth_chainId; a mismatched endpoint disables operations |
| NEXT_PUBLIC_FACTORY_ADDRESS | Only this Factory can supply deployment events |
| NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS | Reviewed test-service registry |
| CHAIN_CONFIRMATIONS | Explicit block-count policy; default 1 is local convenience, not a claim of Monad finality |
| STORAGE_URL / STORAGE_SERVICE_KEY | Optional Supabase project URL and server-only service key |
| STORAGE_BUCKET | rentbond-private by default; apply infra/storage/supabase.sql first |
| TEST_GAS_SPONSOR_PRIVATE_KEY | Separate sponsor key; never a lease role's key |
| TEST_GAS_ORGANIZERS | Optional landlord allowlist enabling pre-deployment gas after tenant joins and landlord freezes the draft |
| TEST_GAS_* limits | Defaults: 0.01 MON/transfer, 3/account/day, 8/lease/day, 100/global/day, 1 hour cooldown |
| TRUST_PROXY | false unless a trusted proxy overwrites forwarding headers |

Testnet configuration can use a local PostgreSQL instance. Cloud hosting is not a development prerequisite. The server validates configured IDs; B/E must separately verify current official network information, contract deployment and confirmation policy.

## C Integration

Use same-origin fetch with credentials. Get /api/auth/nonce, construct exactly the returned SIWE message fields plus the wallet address and version 1, sign in the user's Mera/EOA session, then POST /api/auth/verify. A wallet connection is not a login. Session cookies are HttpOnly, SameSite=Strict and Secure on HTTPS. Logout or account changes must clear C's private caches.

Detailed routes and examples are in [API](interfaces/api.md). Amounts are base-unit strings. Lease dates are UTC seconds; API session/link expiration values are epoch milliseconds. All ordinary POST commands require an Idempotency-Key; reuse it only when retrying the same command body. New form submissions use new keys.

Creation: create draft -> invite -> tenant claims with their own SIWE account -> landlord reviews and PATCHes by version -> prepare freezes terms -> wallet createLease -> attach the confirmed factory transaction. The backend never signs createLease, accepts terms or funds for the user.

Uploads: intent -> PUT exact raw bytes -> submit -> append inspection/case bundle -> explicitly confirm the returned wallet action. Use a document ID plus exact version everywhere. New versions never inherit acknowledgement. A file download URL also requires the session that requested it, so it is not a share link.

Private statement/decision endpoints return salted commitments and wallet arguments. Saved text is not chain confirmation. Claim/decision amounts are revalidated against current chain state. The frontend must still show each financial action and get the user's confirmation.

## E Integration

Import server modules from a Node process with the same environment. syncLease(app,id) fetches confirmed contract state and events, commits event rows/checkpoint/projection atomically, and invalidates noncanonical events on checkpoint mismatch. Unique event key is (chain_id,tx_hash,log_index). Replays are idempotent. No HTTP endpoint accepts arbitrary events or snapshots.

runExportJob(app), runGasJob(app) and cleanup(app) are persistent bounded jobs. A failed export retries at most three times. Sponsor raw signed transfers are persisted before sending. After three ambiguous sends, the job keeps its hash and reports GAS_BROADCAST_UNCERTAIN; it polls for a receipt and blocks subsequent nonces. Do not reset this row or create a replacement transfer to the same recipient just because an RPC timed out.

To register a test service, store a JSON file with profileId, reviewed:true, manifest:{schemaVersion,text,parameters}, and salt. parameters must match all getProfile parameters except profileId and serviceTermsHash (integer values as strings). Its commitment must be the already-authorized on-chain serviceTermsHash:

```sh
# Run from apps/web:
node src/server/cli.mjs profile-import path/to/reviewed-test-service.json
node src/server/cli.mjs sync LEASE_UUID
node src/server/cli.mjs worker --once
node src/server/cli.mjs cleanup
node src/server/cli.mjs purge-requested LEASE_UUID
```

purge-requested requires both T and L to have submitted authenticated cleanup requests. It deletes originals/export objects and preserves immutable digests and audit references. Normal cleanup waits 90 days after confirmed Closed and rechecks the chain. Neither path removes blockchain records.

## Verification

```sh
npm run test:backend
npm run test --prefix apps/web
npm run typecheck --prefix apps/web
npm run build --prefix apps/web
node scripts/check-scaffold.mjs
```

The test command recompiles repository contracts with pinned solc 0.8.24 and generates ABI artifacts. The local EVM test starts and closes its own Hardhat RPC server on a random loopback port. Test account keys are ephemeral. That test is real local execution, not a public Monad deployment.

For the PostgreSQL two-connection test, set RENTBOND_TEST_DATABASE_URL to a disposable database and run node --test src/server/tests/postgres.integration.mjs from apps/web. It creates/drops only a randomly named test schema. Backend test names map to TS03, AT27/28/33/43/44, with partial evidence for TS05/AT41/42/51.

With the local Next server running, set RENTBOND_TEST_BASE_URL=http://localhost:3000 and run node src/server/tests/http.integration.mjs from apps/web. This explicit smoke command creates fictional lease/file records and exercises real HTTP, session cookies and the automatic local export queue.

See [evidence](../tests/reports/2026-09-26-member-d.md) for the executed results and limits.
