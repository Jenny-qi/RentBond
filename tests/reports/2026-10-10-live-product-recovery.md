# 2026-10-10 Live product recovery preparation

Source baseline: `d325de069d26b2fff950425f3339aa22c6e84047` (remote main rechecked unchanged at delivery). Local branch: `codex/live-product-recovery-20261010`. Remote branch creation returned GitHub 403 `Resource not accessible by integration`; no branch, PR, merge, production configuration or public deployment was written.

## Observations and changes

The existing `https://rentbond-nine.vercel.app/api/health` and `/api/auth/session` returned HTTP 503 with `Backend is not configured or unavailable.` This is the outer initialization failure response, not proof of a particular missing variable. Project logs and environment settings are not accessible in this session. A Vercel integration was discovered but its account connection is not confirmed.

1. Removed four Markdown links to an absent brand report. Kept the team's surrounding history and explicitly marked the original report missing. Did not manufacture brand checks, restore archived documents or remove teammates' code.
2. Recovered the 2026-10-09 HTTPS/DEMO_SHORT package. Its full old patch failed against changed document headers and the team's already-existing integration report. Applied only compatible additions, leaving those existing files intact; added this current record separately.
3. Added fixed, redacted backend startup stage/category logs correlated with the unchanged public 503 request ID. Configuration/database/migration/service initialization are distinguished. Failed initialization is still cleared for retry; database cleanup cannot mask the original stage. No raw errors, passwords, URLs, keys, paths or request bodies are logged by the new boundary.
4. Added an offline check for Vercel plus external PostgreSQL/object storage/scanner/Workers, and a recovery runbook. The single-host Compose candidate remains a separate route. Added an actual production-build HTTP regression and included hosted/HTTP checks in the staging workflow.

Application changes are limited to `apps/web/src/server/runtime.ts`, `apps/web/src/app/api/[...path]/route.ts`, and the new diagnostic module/tests. No contract, ABI, database migration, funds, account, UI, package manifest, workspace configuration or lockfile change. Dependency installation appended pnpm build approvals to the workspace file; this installer-created diff was removed before delivery.

## Executed checks

Runtime: Node 24.19.0 (different patch from repository recommendation 24.14.0), pnpm 12.8.1 from explicit `npx`. Lockfile unchanged.

| Command / scope | Result |
| --- | --- |
| `npx --yes pnpm@12.8.1 install --frozen-lockfile --allow-build=esbuild --allow-build=core-js` | Passed; first attempt with installed pnpm 11 rejected the flags / ignored scripts, corrected to pinned version |
| `npm run test --prefix apps/web` | 85 passed / 0 failed / 0 skipped, including 2 new diagnostic/privacy/runtime retry tests |
| `npm run typecheck --prefix apps/web` | Passed |
| `npm run build --prefix apps/web` | Passed |
| `node tests/runner.mjs integration` | 9 passed / 0 failed / 0 skipped; current report preserved as integration-2026-10-10.json |
| `node --test infra/staging/staging.test.mjs infra/staging/preflight.test.mjs` | 9 passed / 0 failed / 0 skipped |
| `node --test infra/staging/check-hosted.test.mjs` | 2 passed / 0 failed / 0 skipped; synthetic environment only |
| `node --test infra/staging/chain-preflight.test.mjs` | 5 passed / 0 failed / 0 skipped; injected RPC fixtures, not Monad evidence |
| `node --test ../../infra/staging/demo-short.test.mjs` from apps/web | 4 passed / 0 failed / 0 skipped; real isolated local EVM and backend commitment checks |
| `node --test infra/staging/startup-http.test.mjs` after production build | 1 passed / 0 failed / 0 skipped; actual Next HTTP 503, no-store and correlated configuration log |
| `node scripts/check-scaffold.mjs` | Passed, including local Markdown links and unchanged FR/SC/AT/TS/RB coverage |
| `git diff --check` | Passed |

One initial DEMO_SHORT invocation from repository root failed because Hardhat configuration lives under apps/web; rerun from the documented working directory passed all four tests. The root invocation is not a successful test. A Next process in a separate command was not reachable from the next command's loopback namespace; the final HTTP test starts and fetches from its own process namespace and passed. These environment attempts do not constitute hosted verification.

## Not run / remaining

- Docker/Compose CLI is not available in this runtime. Recovered Compose files were not revalidated with Compose this turn, containers were not built or started. Historical package reports retain their original dates and boundaries.
- Browser E2E was not rerun this turn; existing main CI evidence is historical, not added to the executed totals above.
- No real Vercel environment file is available; `check-hosted` passed only synthetic tests, not the actual deployment.
- Public service connectivity, database migrations, bucket policies, real ClamAV/EICAR, two deployed Workers/restart recovery, real passkey devices and stable domain remain unverified here.
- DEMO_SHORT on Monad, R/F wallet acceptance and complete 850/150 / 900/100 withdrawals remain unverified. No signing or broadcasting occurred.
- Public 503 is still unresolved; new logs become available only after an authorized project owner applies/deploys the changes. Remote CI is not repaired by local tests alone.

AT/TS remain In progress; no requirement is promoted to Verified. Next required access is a Vercel account with access to the existing project, its current deployment/logs and the external service hosting details. Connection alone does not grant GitHub write permission or supply infrastructure automatically.
