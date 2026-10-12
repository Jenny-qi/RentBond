# Live staging follow-up — 2026-10-06

Baseline: main `4a34c3096e8e28184e4ec9f2ba29096694eddc20`. The previous staging patch was recovered and applied with `git apply --check` succeeding. This follow-up preserves the existing Next.js/API, Worker, contracts, ABI, migrations, branding and dependency lockfile.

## Changes

- Recover the existing isolated `infra/staging/` deployment package: web/API, PostgreSQL, real ClamAV, migration, two Workers and optional Caddy HTTPS.
- Add offline operator-file preflight. Reject passwords that can break the Compose database URL, shared secrets, missing network/deployment settings and unsupported HTTPS ports. Success and failure do not echo credential values.
- Add three preflight tests to the staging workflow alongside the prior six tests.
- Clarify that staging can be deployed and updated before final version freeze; final submission still requires actual acceptance.
- Split the CI-reference repair and the deployment package into separate commits/patches, allowing the team to apply the smaller CI repair first.

## Checks executed

| Command | Result |
| --- | --- |
| `node --test infra/staging/staging.test.mjs infra/staging/preflight.test.mjs` | 9 passed, 0 failed, 0 skipped |
| `node infra/staging/check-compose.mjs /workspace/scratch/76e423e0a5cc/docker-compose` | Both read-only staging and explicit-executor overlay validated using Compose v2.39.4; no daemon |
| `npm run typecheck --prefix apps/web` | Passed |
| `npm run build --prefix apps/web` | Passed; production pages/API compiled |
| `npm run test --prefix apps/web` | 79 passed, 0 failed, 0 skipped, including local EVM/API/Worker regression |
| `node --test scripts/verify-monad-evidence.test.mjs scripts/attest-monad-deployment.test.mjs` | 8 passed, 0 skipped |
| `node apps/worker/src/indexer/providers.test.mjs` | 6 passed, 0 skipped |

Dependencies were installed using the repository-pinned pnpm 12.8.1 and frozen lockfile. Installation added allow-build entries to the workspace file; only that install-generated change was reverted to baseline. The lockfile and manifests remain unchanged. Node in this environment is 24.19.0; deployment image remains pinned to the existing 24.14.0 requirement. The standalone Compose binary's checksum was verified against the matching official v2.39.4 checksum.

## Attempted live verification and delivery limits

The existing read-only verifier was rerun against the official Monad RPC. It received chain identity/code for MockUSD, then aborted on an RPC timeout. The run exited 1. This is incomplete verification, not a fresh chain attestation; historical evidence files were not modified.

GitHub's create-branch endpoint returned 403, `Resource not accessible by integration`; the remote repository was not changed. There is no Docker Engine here, so complete image builds/container startup were not executed. No host/domain or operator-owned server has been provided. The available Sites runtime does not support the raw TCP services used by this architecture; no replacement frontend/backend was created to fit it.

Remaining: an operator-controlled Linux Docker host and stable HTTPS hostname, exercised images and dependency checks, accepted DEMO_SHORT service record, actual role-wallet creation/funding/claims/resolution/withdrawal receipts, real-device recovery and independent review. No chain transaction was signed or broadcast in this work. The package is not a public Live product URL or a completed AT/TS acceptance.
