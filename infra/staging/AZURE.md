# Azure student deployment

This variant uses an external PostgreSQL database and shared private Docker
storage on the VM. It does not send files to the Supabase free storage buckets,
whose 50 MiB object limit cannot accommodate the existing export requirement.
The VM disk is a single point of failure; do not store irreplaceable real evidence
until private backup and restore have been configured and verified.

Build the existing staging Dockerfile with the public values in
`.env.azure.example`. Build `Scanner.Dockerfile` as `rentbond-scanner:local`.
Prepare a mode-0600 `.env.azure` without committing secrets, and set
`DATABASE_URL` to the existing PostgreSQL TLS connection. Preserve an existing
`SESSION_SECRET` when it is available; otherwise create a new server-only secret
with explicit approval. A new secret invalidates existing session cookies.
Vercel Production Secrets cannot be read back from the environment-variable
list. The managed Supabase resource's official quickstart separately provides
its own connection credentials; do not reset the database password to obtain
them. Confirm their transfer to the VM before writing a secret-bearing file.
Set the verified `DEPLOYMENT_BLOCK` and the
Azure API DNS hostname. Do not set `STORAGE_URL`, `STORAGE_SERVICE_KEY`, or
`BACKEND_URL` on the VM. The staging runtime's application origin stays the
canonical Vercel origin; `RENTBOND_API_HOST` separately controls the API TLS host.

For the Supabase shared pooler, download the CA from the project's Database
Settings → SSL configuration → Download certificate link into
`certs/supabase-ca.crt`. The Compose file mounts it read-only in each application
container. Add `sslmode=verify-full&sslrootcert=/etc/rentbond/supabase-ca.crt`
to the database URL. The system trust store alone does not trust the Supabase
pooler certificate; retain hostname and certificate validation.

```sh
docker compose --env-file .env.azure -f compose.azure.yaml config --quiet
docker compose --env-file .env.azure -f compose.azure.yaml up -d
docker compose --env-file .env.azure -f compose.azure.yaml ps
curl --fail http://127.0.0.1:3000/api/health
```

Verify database, storage, quarantine, scanner, RPC, and Worker operation before
enabling the `public` profile. Keep ClamAV 3310 and application 3000 off public
interfaces. Approve public HTTP/HTTPS access before changing Azure network rules.
Enable the Caddy profile after DNS resolves to the VM, then verify HTTPS and
cookies through the frontend.

On Vercel, set server-only `BACKEND_URL` to the API HTTPS origin and redeploy.
`next.config.ts` routes `/api/*` through an external `beforeFiles` rewrite;
without this variable, the existing local API handlers remain active. Do not
set `BACKEND_URL` to the frontend origin or include credentials. The browser
keeps using the canonical frontend origin for session cookies and passkeys.

Passing infrastructure health checks does not establish chain acceptance.
The patched Worker splits `WORKER_BATCH_SIZE=1000` into at most 100-block RPC
queries, with at most four queries in flight. Older images still need batch
size 100. `WORKER_POLL_INTERVAL_MS=1000` accelerates initial catch-up without
skipping deployment history. Inspect the persisted checkpoint and its distance
from the current head; a running Worker is not proof that it has caught up.
`WORKER_EXECUTE=false` remains the default until the complete transaction flow
and execution policy have been reviewed. Student credit is finite; this VM is
not a permanently free service.

For an isolated Worker update, build `WorkerOverlay.Dockerfile` using a minimal
context containing only that Dockerfile, `apps/worker/src/rpc.mjs`, and
`apps/worker/src/log-ranges.mjs`. Set `RENTBOND_WORKER_IMAGE` to the resulting
versioned image and recreate only `chain-worker`. Preserve the previous image
and batch setting for rollback. This overlay inherits the exact existing app
runtime and does not change Web, API Worker, migrations, signing policy or keys.

## Observed deployment, 2026-10-11

The VM's `chain-worker` was updated to `rentbond-worker:range100-v1` using the
overlay, with batch size 1000 and execution disabled. Two post-update reads
confirmed checkpoint advancement from 65,124,408 to 65,134,408. The second
confirmed head was 70,116,522: 4,982,114 blocks remained, so catch-up was not
complete. No deployment history or persisted checkpoint was skipped.

The canonical frontend's `/api/health` returned true for database, storage,
quarantine, scanner and RPC after the update. Web and scanner were healthy;
API Worker and chain Worker were running. This verifies infrastructure and
ongoing indexing, not authenticated lease, evidence, export or funds flows.
The complete local Worker suite passed 13 tests, including log-range failure,
restart, reorganization and RPC-fault cases; those tests used disposable local
EVM fixtures rather than live Monad funds.

For this VM, the previous environment was retained at
`/opt/rentbond/repo/infra/staging/.env.azure.before-range100-v1` with mode 0600.
To roll back this isolated update, restore that file to `.env.azure`, then run
`docker compose --env-file .env.azure -f compose.azure.yaml up -d --no-deps chain-worker`
from `/opt/rentbond/repo/infra/staging`. The previous application image remains
available. Do not print or commit either environment file.

MetaMask's site warning still requires provider review. Wallet-dependent live
acceptance and private storage backup/restore remain unverified; this update
does not establish production readiness.

## Private storage recovery drill

Run `sh infra/staging/private-storage-drill.sh` on this VM as its operator.
The script discovers the existing Web `/data` mount, writes a mode-private
archive under `/opt/rentbond/private-storage-drills`, restores into a new
separate directory, and compares every file's size and SHA-256. It refuses an
empty-volume pass and never extracts over live data. An added/changed file
during the drill makes comparison fail rather than claiming consistency.

The archive, restored copy and private inventory remain on the VM. This is a
same-host file recovery drill, not off-host protection, a scheduled backup or
PostgreSQL recovery. Production readiness still requires a selected private
off-host destination and an independently tested database/storage recovery
procedure. Do not upload private archives to Git or expose them via Caddy.
