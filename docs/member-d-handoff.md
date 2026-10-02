# Member D Backend Handoff

Scope: SIWE/session, drafts/invitations, schema/migrations, private files and ACL, immutable materials, private claim/response/decision text, exports, bounded test MON sponsor, and E's event/job persistence boundary.

Latest main review: [2026-10-02 merged delivery and corrections](../tests/reports/2026-10-02-member-d-main-review.md), implementation cbe41fc. Both D stages are merged. Web regression is now 69 passing tests; selected PostgreSQL/ClamAV and real HTTP checks passed after correcting scanner LF/UTC setup and unsigned task requeue when its original source becomes canonical again.

Latest delivery: [2026-10-02 stage-two evidence](../tests/reports/2026-10-02-member-d-stage-two.md). Based on main b664c0a, including the previously merged D backend and C's real API pages. The new upload scan protocol affects C; the new database task adapter affects E. No ABI or business-money rule changed.

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

The API is at http://localhost:3000/api/health. Initialization creates an ignored apps/web/.env.local with a random session secret. The fictional seed uses public local-only test keys through actual signed API login; it creates an unexecuted draft and invitation claim, never a fake funded lease. C's current live pages consume the SIWE/API/ABI. Full browser role journeys and physical-device recovery remain separate joint acceptance.

The local database, private originals and quarantine are in apps/web/.rentbond. Only one process may open the embedded database. After the API initializes, the local web server checks scan/export/sponsor jobs every five seconds and runs bounded chain synchronization and retention every minute. Stop it before running migration/seed/cleanup commands. A running local web process needs no separate backend worker. The loopback-only default disables antivirus explicitly in health output; use the deployment setup below for real scanning.

## Optional Shared PostgreSQL

Set RENTBOND_DB_PASSWORD for the shell and run docker compose -f infra/compose.yaml up -d. The image is pinned by digest; the tested version is PostgreSQL 17.11. Set DATABASE_URL in apps/web/.env.local to this database, then run npm run db:migrate. Do not interpolate or commit a real password in a script.

With PostgreSQL, start npm run backend:worker in a second terminal. The worker runs scan/export jobs, sponsor reconciliation, retention, and bounded read-only event synchronization. It does not replace E's RB-12 public deadline-transaction scheduler or notification delivery.

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
| STORAGE_QUARANTINE_BUCKET | Separate private bucket, default rentbond-quarantine; cannot equal the clean bucket |
| FILE_SCAN_MODE | clamav required for testnet or a public origin; disabled-local only on local loopback |
| CLAMAV_HOST / CLAMAV_PORT | Trusted clamd INSTREAM service; default port 3310, never expose to the internet |
| FILE_SCAN_TIMEOUT_SECONDS / FILE_SCAN_MAX_AGE_HOURS | Default 30 seconds per command and 72 hours definition freshness; maxima 45 seconds and 168 hours |
| TEST_GAS_SPONSOR_PRIVATE_KEY | Separate sponsor key; never a lease role's key |
| TEST_GAS_ORGANIZERS | Optional landlord allowlist enabling pre-deployment gas after tenant joins and landlord freezes the draft |
| TEST_GAS_* limits | Defaults: 0.01 MON/transfer, 3/account/day, 8/lease/day, 100/global/day, 1 hour cooldown |
| TRUST_PROXY | false unless a trusted proxy overwrites forwarding headers |

Testnet configuration can use a local PostgreSQL instance. Cloud hosting is not a development prerequisite. The server validates configured IDs; B/E must separately verify current official network information, contract deployment and confirmation policy.

## C Integration

Use same-origin fetch with credentials. Get /api/auth/nonce, construct exactly the returned SIWE message fields plus the wallet address and version 1, sign in the user's Mera/EOA session, then POST /api/auth/verify. A wallet connection is not a login. Session cookies are HttpOnly, SameSite=Strict and Secure on HTTPS. Logout or account changes must clear C's private caches.

Detailed routes and examples are in [API](interfaces/api.md). Amounts are base-unit strings. Lease dates are UTC seconds; API session/link expiration values are epoch milliseconds. All ordinary POST commands require an Idempotency-Key; reuse it only when retrying the same command body. New form submissions use new keys.

Creation: create draft -> invite -> tenant claims with their own SIWE account -> landlord reviews and PATCHes by version -> prepare freezes terms -> wallet createLease -> attach the confirmed factory transaction. The backend never signs createLease, accepts terms or funds for the user.

Uploads: intent -> PUT exact raw bytes into quarantine -> GET statusUrl until clean -> submit -> append inspection/case bundle -> explicitly confirm the returned wallet action. C's Materials view now polls with a bounded wait, retains a pending upload for retry, and stops on account/page changes. Rejected or unavailable scans never permit submit, references, download or export. Use a document ID plus exact version everywhere. New versions never inherit acknowledgement. A file download URL also requires the session that requested it, so it is not a share link.

Private statement/decision endpoints return salted commitments and wallet arguments. Saved text is not chain confirmation. Claim/decision amounts are revalidated against current chain state. The frontend must still show each financial action and get the user's confirmation.

## E Integration

Import server modules from a Node process with the same environment. syncLease(app,id) fetches confirmed contract state and events, commits event rows/checkpoint/projection atomically, and invalidates noncanonical events on checkpoint mismatch. Unique event key is (chain_id,tx_hash,log_index). Replays are idempotent. No HTTP endpoint accepts arbitrary events or snapshots.

runExportJob(app), runGasJob(app) and cleanup(app) are persistent bounded jobs. A failed export retries at most three times. Sponsor raw signed transfers are persisted before sending. After three ambiguous sends, the job keeps its hash and reports GAS_BROADCAST_UNCERTAIN; it polls for a receipt and blocks subsequent nonces. Do not reset this row or create a replacement transfer to the same recipient just because an RPC timed out.

The executable E import is apps/worker/src/persistence/backend.mjs. It exports createTaskStore(app) and syncLease(app,id); full call order, timestamp units, ownership rules and recovery boundaries are in [worker persistence](interfaces/worker-persistence.md). Migration 0003 adds worker_tasks. Reorg invalidation participates in the same transaction as events, cases and checkpoints. E's legacy jobs.json executor has NOT been silently switched to this adapter: E must integrate its signer/deadline loop, reread chain preconditions, and validate end-to-end execution.

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

The [2026-09-27 review](../tests/reports/2026-09-27-member-d-review.md) supersedes the initial completeness assessment. It records fixes for case response/original visibility, RPC failover, final-deadline sponsor access and missing material metadata/withdrawal notes, plus integration with main at d26ddab.

## Selected Deployment And Upload Upgrade

The selected verification environment is self-hosted PostgreSQL, local private storage and ClamAV. It requires no paid cloud product or VPS for development. PostgreSQL 16.15 and ClamAV 1.5.4 were exercised on local Ubuntu/WSL; the existing Docker PostgreSQL 17.11 configuration remains available. ClamAV used about 1 GB RAM in this run; allow memory and disk for signatures, quarantined originals and the clean copy.

On Debian/Ubuntu install postgresql, clamav-daemon and clamav-freshclam. Run freshclam to completion and keep its update service running. Install the supplied loopback-only configuration and persistent service from the repository root:

```sh
sudo install -D -m 0644 infra/storage/clamd.conf /etc/rentbond/clamd.conf
sudo install -D -m 0644 infra/storage/rentbond-clamd.service /etc/systemd/system/rentbond-clamd.service
sudo systemctl daemon-reload
sudo systemctl enable --now rentbond-clamd
```

The service sets TZ=UTC because ClamAV VERSION omits its timezone. Running clamd in another timezone can incorrectly reject a fresh signature database as future-dated, or shift its expiry. For a manual foreground run use sudo env TZ=UTC clamd --config-file=/absolute/path/to/infra/storage/clamd.conf. Git pins both files to LF; CRLF makes clamd reject numeric options on Windows/WSL checkouts. Use a dedicated database owner for the API/worker; never publish its connection string. Do not serve RENTBOND_DATA_DIR via a web server. Set DATABASE_URL, FILE_SCAN_MODE=clamav and CLAMAV_HOST, migrate, then start the web server and backend:worker. For public/testnet use HTTPS and the correct origin/network configuration.

For upgrade, stop old web/worker processes before applying migration 0003. Existing originals become pending and are blocked until rescanned; previously ready ZIPs become failed with SCAN_UPGRADE_REQUIRED and must be regenerated. Legacy bytes are read from their old storage location, while all new PUTs write only to quarantine. Do not switch back to the old application after this migration.

The scan queue claims with a 120-second token lease and at most three attempts. A crash releases no file; stale completion is fenced by the current token. Scanner timeouts, expired signatures and scan limits fail closed. Errors retry after 30 seconds; exhausted scans require operator investigation and a new upload, not a client-side bypass. Unsubmitted uploads expire after 15 minutes; cleanup removes both storage copies. Submitted files follow normal retention and bilateral purge.

From apps/web, run npm run backend:verify-deployment using the deployment configuration. It fails if PostgreSQL, private storage separation, RLS or real ClamAV/EICAR checks fail, and refuses local scan bypass. For the stronger disposable integration test, set RENTBOND_TEST_DATABASE_URL and CLAMAV_HOST and run npm run test:deployment. The test administrator must be allowed to create/drop its randomly named schema and temporary role. It tests real PostgreSQL, actual scanning, API ACL and task concurrency; the chain snapshot in that test is injected and is not public-chain evidence. Run the separate HTTP smoke against the configured Next server and worker as well.

The selected local environment passed these checks. Hosted Supabase remains an optional, separately unverified environment: apply both bucket policies and exercise actual anon/authenticated credentials before choosing it. Public hosting, RPC finality, complete E execution and real-device recovery remain joint release acceptance.
