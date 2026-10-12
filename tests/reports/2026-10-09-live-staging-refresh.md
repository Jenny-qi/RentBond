# Live staging refresh on current main

Date: 2026-10-09 (Asia/Shanghai). Source base: `e4a96d9565fd2f9783750a76ce441be1cb8405f4`. Commands tested the isolated `codex/live-staging-20261009` working tree before commit.

## Changes

Restored the saved HTTPS and DEMO_SHORT preparation patches on current main; skipped the superseded CI repair. Added read-only chain preflight and five regression scenarios, extended its staging CI coverage, and corrected the outdated blocker-log reference. It checks configured RPC chain IDs, one confirmation-adjusted block/hash, Factory/Registry/Deployer code and pointers, code at the recorded Factory block, exact DEMO_SHORT profile parameters, R/F acceptance, closure/expiry and six-decimal token. It creates no wallet and sends no transactions. The token call uses the checked-in generated MockUSD ABI.

Existing application/Worker code, contracts, ABI, migrations, dependency manifests/lockfile and dated evidence remain unchanged. No files deleted or renamed. Installer-added `allowBuilds` was removed to preserve the team's workspace manifest.

## Actual final results

Linux, Node **24.19.0** (environment-provided; image/CI still target repository **24.14.0**), pnpm **12.8.1**, pinned solc **0.8.24**, Compose CLI **2.39.4**. No Docker daemon or hosting account available.

| Command | Result |
| --- | --- |
| `npx --yes pnpm@12.8.1 install --frozen-lockfile --allow-build=esbuild --allow-build=core-js` | Passed; final dependency/lockfile/workspace manifest unchanged |
| `npm run backend:abi --prefix apps/web` | Passed; tracked generated ABI unchanged |
| `node --test infra/staging/staging.test.mjs infra/staging/preflight.test.mjs infra/staging/chain-preflight.test.mjs` | **14 passed**, 0 failed/skipped |
| From `apps/web`: `node --test ../../infra/staging/demo-short.test.mjs` | **4 passed**, 0 failed/skipped; local EVM |
| `npm test --prefix apps/web` | **83 passed**, 0 failed/skipped |
| `node tests/runner.mjs integration` | **9 passed**, 0 failed/skipped; [JSON](integration-2026-10-09.json) |
| `npm run typecheck --prefix apps/web` | Passed |
| `NEXT_TELEMETRY_DISABLED=1 npm run build --prefix apps/web` | Passed production build |
| `node infra/staging/check-compose.mjs /absolute/path/to/docker-compose` | Both base/executor configurations passed; containers not started |
| `node scripts/check-scaffold.mjs` / `git diff --check` | Passed |
| Read-only official Monad RPC probe against historical Factory/Registry/block | **Failed: RPC timeout**, no new chain acceptance |

Initial failed runs are not counted: DEMO_SHORT was first invoked outside the Web workspace and lacked Hardhat config; another run and IT-03 started before fresh compilation completed and lacked `compiled-contracts.json`. After compilation and using the documented directory, all four preparation and nine integration scenarios passed. The new reorg fixture initially changed its block too early; it was corrected and all 14 configuration scenarios passed. No application/contract code was changed to bypass these failures.

## Limits and next action

Eight browser E2E scenarios were **not rerun this refresh**; the dated saved results remain historical. No public profile/deployment, role signature, real-device test, public database/scanner/Worker/container runtime or HTTPS link is certified. Preflight always reports `liveProductReady:false`. Code presence at the recorded block is not proof of exact deployment block or source identity; the confirmation count is an operator policy, not network-finality evidence. Private manifest import, browser CORS and full funds flow remain separate acceptance steps.

GitHub branch creation retried: **403 Resource not accessible by integration**. The branch is local; this package has no remote PR/merge/CI run.

Next: connect an operator-controlled Docker host and stable HTTPS hostname, configure verified addresses/block and independent secrets, build/start services, import a reviewed accepted DEMO_SHORT service, and collect real UI/Monad creation→funding→checkout→claims→allocation→resolution→withdrawal receipts. See [staging instructions](../../infra/staging/README.md). No AT/TS/FR/SC status promoted to Verified.
