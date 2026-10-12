# Live product staging candidate

This package prepares the existing Next.js/API and two independent Workers for a single Linux Docker host. Staging can start before the team freezes its final version and can be updated at the same HTTPS origin. It does not provision a host, purchase a domain, deploy contracts, sign for T/L/R/F, or certify a public release. The final submission version still requires the existing acceptance gates.

## Services

| Service | Purpose | Host exposure |
| --- | --- | --- |
| database | PostgreSQL, durable migrations and tasks; separate non-superuser application owner | None |
| scanner | Real ClamAV, private INSTREAM protocol, fresh definitions, UTC | None |
| migrate | One-shot migrations before application processes | None |
| web | Production Next.js and authenticated HTTP API | Loopback port 3000 |
| api-worker | Scan/export/Gas/retention queues and read-only lease synchronization | None |
| chain-worker | Factory discovery and durable deadline scheduler; read-only by default | None |
| https | Optional Caddy HTTPS reverse proxy | Ports 80/443, explicit `public` profile |

The API and both Workers share PostgreSQL and `/data`, not concurrent PGlite files. Private originals and quarantine never mount into the proxy. The application DB role owns its tables and bypasses owner RLS; browser clients have no DB connection and API ACL checks remain required. This is not evidence of public ACL acceptance.

## Before running

Use a Docker Engine host with Docker Compose v2, outbound access for package/image downloads, RPC and ClamAV definitions. For public HTTPS, provide a domain whose DNS points to the host and ports 80/443 reachable by the certificate issuer. Allow sufficient resources for simultaneous Next.js build, PostgreSQL and ClamAV; measure on the chosen host. No hosting account or domain is configured by this PR.

1. Fix the source commit. Obtain B/E's verified deployment record: actual Monad Testnet chain ID, Factory/Registry addresses, Factory deployment block, generated ABI digest, reviewed confirmation policy and separately accepted R/F service profile. The old funded lease and `demo-short.example.json` are not an accepted DEMO_SHORT deployment.
2. Copy `infra/staging/.env.staging.example` to `infra/staging/.env.staging`; make it readable only by the operator (`chmod 600`). Generate independent random hex admin/app passwords and session secret using the command in the example. Keep a backup outside Git. Never print the resolved Compose environment or include credentials in build arguments.
3. Set the actual HTTPS origin and matching hostname. The browser RPC must be credential-free HTTPS; server RPCs may use private credentials. Copy addresses and block from verified evidence rather than guessing. Do not populate placeholders and call them on-chain evidence.

## Build and start private staging

Run from the repository root:

```sh
node infra/staging/preflight.mjs infra/staging/.env.staging
sh infra/staging/compose.sh config --quiet
sh infra/staging/compose.sh build web scanner
sh infra/staging/compose.sh up -d web api-worker chain-worker
sh infra/staging/compose.sh ps
sh infra/staging/compose.sh run --rm --no-deps web verify-services
node infra/staging/smoke.mjs http://127.0.0.1:3000
```

Compose waits for PostgreSQL, a successful migration and scanner health. Initial definition download may take minutes; update failure blocks the scanner and uploads. The API also rejects stale definitions. `verify-services` runs the existing real database/RLS/storage/scanner probes, including EICAR and temporary private objects; it is not a chain or wallet test. The HTTP smoke rejects missing RPC or scanner bypass even if an endpoint returns 200.

Preflight reads only the operator env file and performs no network requests. It requires independently generated 64-character hex database passwords/session secret, matching HTTPS DNS hostname on standard port 443, nonzero addresses, and explicit deployment block/confirmation settings. It never prints credentials. Passing does not attest the configured addresses or create an accepted service profile.

`NEXT_PUBLIC_*` values and confirmation policy are recorded during the build, and checked at every process start against runtime values. An origin, RPC, address or policy change requires rebuilding; server secrets are runtime-only. Rejecting stale build configuration avoids a browser signing against one network/address while the API uses another. Official references: [Next.js 15 self-hosting](https://nextjs.org/docs/15/app/guides/self-hosting), [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/).

The database init script runs only when the named database volume is empty. Editing passwords in the environment will not change an existing database role; plan an explicit operator rotation. Do not use `down -v` for upgrades or troubleshooting: that destroys retained database/files/definitions.

## Import the reviewed service and test HTTPS

### Read-only check of the selected Monad environment (2026-10-09)

After dependencies and `backend:abi` are installed, check the operator env and the preserved public profile draft:

```sh
node infra/staging/chain-preflight.mjs infra/staging/.env.staging private/demo-short-run/unsigned-transactions.json
```

This sends read-only RPC requests. It checks every configured RPC chain ID, one confirmation-adjusted block/hash, code at Factory/Registry/Deployer, the Factory's Registry pointer, code at the recorded Factory deployment block, the exact DEMO_SHORT profile, R/F acceptance, closure/expiry and six-decimal test token. It does not sign, broadcast, import private terms or change any record. RPC errors and operator credentials are never printed. Exit 0 means these limited checks passed; exit 2 means the chain was readable but a service blocker remains; exit 1 means a check failed. Omitting the profile file deliberately returns a service blocker. Historical long-duration services cannot pass as DEMO_SHORT.

The recorded deployment block check establishes code presence, not that the Factory was first deployed at that block. Source/ABI attestation, reviewed private manifest import, browser CORS, actual HTTPS, database/scanner/Workers and complete funds/device acceptance remain separate. `liveProductReady` always remains false in this probe. Freeze and verify source, ABI and deployment receipts before using the selected addresses.

### Prepare a separate DEMO_SHORT draft offline

Install the repository dependencies first. Copy `demo-short.input.example.json` to an ignored operator `private/` directory and supply the verified Registry/MockUSD addresses, actual distinct R/F addresses, future `maxLeaseEnd`/`acceptUntil` Unix timestamps as decimal strings, and the service terms for R/F to review. Null fields are intentional; this template cannot be deployed or mistaken for chain evidence. `maxDeposit` is in 6-decimal MockUSD base units (the example is 1,000 MockUSD).

```sh
mkdir -p private
chmod 700 private
cp infra/staging/demo-short.input.example.json private/demo-short-input.json
chmod 600 private/demo-short-input.json
# Fill in the actual values, then use a new output directory:
node infra/staging/demo-short.mjs private/demo-short-input.json private/demo-short-run
```

The generator performs no network requests or signing. It uses the shared private commitment implementation and canonical Registry ABI to write three owner-readable files into a newly created private directory; an existing directory is refused. `service.draft.json` contains the private terms/salt and `reviewed:false`; `unsigned-transactions.json` contains public create/accept calldata; `deployment.env` supplies the existing `CreateDemoShortProfile.s.sol` script's parameters. Keep the private draft/salt out of Git, screenshots and public attachments. Each new run uses a random salt, so its commitment/profile ID changes; preserve one reviewed bundle instead of regenerating it between transactions.

The timing matches the existing DEMO_SHORT Solidity script exactly: 5/10/10/5/10/5/5/15/5 minutes. The hard-end offset is 60 minutes after lease end; the checkout retry remains 24 hours. Do not advertise every exceptional path as a one-hour demonstration.

An actual reviewer must approve the private terms and change only `reviewed` to `true` before import. Compare the selected Registry/token/roles and hashes against the actual chain, verify creator authorization and expiry immediately before execution, and have the appropriate operator submit **one** creation method (the existing Forge script or the unsigned create transaction). R and F each accept the same profile ID using their own wallets. The backend will not offer the service until both accept, its scope is live and the private parameters exactly match. After creating/accepting, import the reviewed private document using the existing command below and retain real receipts separately. No file generated here is a deployment receipt or an accepted service.

Run the offline and local-EVM preparation checks from the Web workspace after the existing ABI build:

```sh
npm run backend:abi --prefix apps/web
cd apps/web
node --test ../../infra/staging/demo-short.test.mjs
```

These tests exercise the actual Registry and production `checkedProfile` against isolated local accounts. They do not establish an accepted Monad deployment.

Import B's reviewed service manifest with its actual on-chain profile ID/commitment. Make the file readable to container UID 1000 without making private records public:

```sh
sh infra/staging/compose.sh run --rm --no-deps \
  -v /absolute/operator/path/reviewed-service.json:/reviewed-service.json:ro \
  web profile-import /reviewed-service.json
```

The existing CLI reads the chain commitment before importing. An empty/unaccepted service list prevents creating a lease; no seed fabricates funded data. After private health passes and the staging hostname is configured:

```sh
sh infra/staging/compose.sh --profile public up -d https
node infra/staging/smoke.mjs https://YOUR_ACTUAL_HOST
```

This explicitly exposes staging, not a final accepted release. Caddy mounts only its config and certificate state. Keep `TRUST_PROXY=false` until forwarding/rate-limit behavior is independently verified on the chosen host. Check both HTTP redirect and HTTPS from an external device. Wallet/passkey domain binding must use this stable origin.

## Optional dedicated public deadline execution

The base bundle performs no Worker-signed deadline transactions. Manual public progression can be tested through the UI by the appropriate user. To enable scheduled public progression later, provide a funded, dedicated operator account distinct from T/L/R/F and the Gas sponsor; verify roles and network separately. Put its key outside the checkout, readable only by the operator/container UID 1000. Do not commit it. Explicitly run:

```sh
docker compose --env-file infra/staging/.env.staging \
  -f infra/staging/compose.yaml -f infra/staging/compose.execute.yaml \
  up -d chain-worker
```

Set `WORKER_GAS_ACCOUNT` and `RENTBOND_WORKER_KEY_PATH` for this overlay. Only the chain-worker receives the key file. This does not let it accept terms, decide awards, fund or withdraw for any role. The existing executor bounds fees and persists signed bytes before broadcast. Do not delete ambiguous tasks or change the signer to evade reconciliation.

## Upgrade and final acceptance

Back up PostgreSQL and private files first. Stop web and both Workers, rebuild from the new fixed source/config, remove only the exited `migrate` container, then start the application services so migrations rerun. Existing contracts are not upgraded by redeploying the website. Avoid rolling the application back across incompatible migrations.

Before final submission: record source commit, resolved image digests, ABI digest, manifest, migration versions and actual URL; freeze the currently floating Caddy/Debian base and scanner package versions to the exercised images. Prove real wallet login/creation/accept/approve/fund, checkout, 100/200 claims and responses, 700/100/200 split, resolution to 850/150 and withdrawals, plus a separate 900/100 timeout case. Retain receipts and balance assertions. Validate independent Workers and restart recovery, private-file ACL/real scanner, actual device restoration and independent review per `docs/acceptance.md`. HTTP health or green CI cannot substitute for these records.

## Current blockers and verification boundary (2026-10-06)

| Item | Current state / closing evidence |
| --- | --- |
| Host/domain | Not selected or provisioned; need operator-controlled host, DNS and working external HTTPS |
| DEMO_SHORT | Actual accepted deployment/profile and full settlement/withdrawal receipts not available in current repository |
| Container runtime | Compose configurations validated without a daemon; complete image builds/container startup not executed here |
| Public dependencies | PostgreSQL/scanner/Workers/ACL/recovery still need real checks on the chosen host |
| Final version | Await explicit team freeze; this package is a staging candidate |

Local results are recorded in [preparation report](../../tests/reports/2026-10-05-live-staging-prep.md). No AT/TS is marked Verified. Current team blockers are tracked in [blocker-log](../../docs/blocker-log.md); main restored it with a new 2026-10-07 entry. Historical reports below describe their original source versions.

The follow-up verification, split patches and current delivery limits are recorded in the [2026-10-06 follow-up](../../tests/reports/2026-10-06-live-staging-followup.md).

The DEMO_SHORT preparation and eight local browser results are recorded in the [2026-10-06 browser follow-up](../../tests/reports/2026-10-06-demo-short-and-browser.md); these do not constitute public Monad or hosting acceptance.
