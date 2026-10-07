# Consumer track / Mera recovery verification

Date: 2026-10-07. Base: `4a34c3096e8e28184e4ec9f2ba29096694eddc20`.

## Scope

Cache-free production passkey recovery; optional explicit address verification; visible 15-minute signing-session deadline and expiry checks; Mera/SIWE lease and private-document authorization regression; consumer positioning and submission evidence corrections. No contract, ABI, database schema, beneficiary or settlement deadline change.

The existing account-trial module remains a historical diagnostic; production routes use `features/live/wallet.ts` and LiveProvider. C/E can consume the same API, ABI and amount contracts. No migration or dependency version change is required.

## Execution

- Targeted adapter and Mera/SIWE/ACL tests: **9 passed, 0 failed, 0 skipped**.
- TypeScript: passed; the final production build also passed its type validation.
- Initial full Web run: 75 passed, 1 failed because this checkout lacked Worker's `viem` dependency. The missing runtime dependency was an installation issue, not counted as a passing run.
- Initial browser setup: Playwright was absent from the old local installation. `npx --no-install` refused to install a different version; no package update was accepted.
- Initial scaffold check: failed on recently removed `backlog.md` / `changes.md` and four stale links. Updated references to the preserved historical source and PRD RB task rows; all 14 RB requirements remain checked.

- Initial browser run found a missing screenshot-list initialization in the new test. It also exposed an existing Windows teardown hang: a terminated Next process has `exitCode === null` and a non-null `signalCode`; waiting for a second exit event never completes. Fixed both and reran all eight scenarios. The interrupted run is not counted as successful evidence.

### Final results

Environment: Windows, Node 24.14.1, pinned pnpm 12.8.1 install with `--frozen-lockfile`, Playwright 1.62.1, installed Google Chrome 154.0.8037.98 in an isolated headless context. The Playwright browser download was slow and was cancelled; the harness's documented `RENTBOND_CHROMIUM_PATH` override selected Chrome. No personal browser profile was used. No lockfile or dependency versions changed.

| Command (repository root unless stated) | Actual result |
| --- | --- |
| `npm test --prefix apps/web` | 83 passed, 0 failed, 0 skipped; includes Worker, local EVM, Mera recovery and private ACL |
| `node tests/runner.mjs integration` | 9 passed, 0 failed, 0 skipped; [JSON](integration-2026-10-07.json) |
| `node tests/runner.mjs e2e` with Chrome override | 8 passed, 0 failed, 0 skipped; [JSON](e2e-2026-10-07.json) |
| `npm run typecheck --prefix apps/web` | Passed |
| `npm run build --prefix apps/web` | Production compilation, type validation and page generation passed |
| `node scripts/doctor.mjs` | Passed its four environment/scaffold checks only |
| `node scripts/check-scaffold.mjs` | Passed local links, JSON, 34 FR / 16 SC / 52 AT / 5 TS / 14 RB and fixture conservation |
| `node --test scripts/verify-monad-evidence.test.mjs scripts/attest-monad-deployment.test.mjs` | 8 passed, 0 skipped; test fixtures, not a new public-chain attestation |
| `node apps/worker/src/indexer/providers.test.mjs` | 6 passed, 0 skipped |
| `git diff --check` | Passed |

Browser E2E-06 additionally verifies recovery is enabled without a cached address, the session scope/end time appears after login, 16 minutes of simulated clock advancement revokes the server session on focus, private pages disappear, and no transaction is requested by expiry. Visual inspection and overflow assertions passed at 375x900 and 1280x900. Screenshots are reproducible artifacts under ignored `test-results/e2e-local/`: `E2E-06-session-mobile.png`, `E2E-06-recovery-375.png`, `E2E-06-recovery-1280.png`.

The JSON evidence accurately reports the base commit with `workingTreeDirty: true`: these commands tested the changes delivered with this report, before their Git commit. Prior dated reports remain historical. Public hashes inside the new E2E report belong to its temporary local chain, not a public explorer.

## Evidence boundaries

The new recovery test injects WebAuthn PRF outputs, then runs actual Mera derivation, signatures, SIWE, PGlite, private storage and ACL. Its scan engine and chain adapter are fixtures. Browser E2E uses a test EIP-1193 wallet and local Hardhat; it does not use a physical passkey or Monad public testnet. Session expiry is tested using the browser clock, without waiting 15 wall-clock minutes.

No public deployment, physical-device test, new public transaction, independent funds review or public video is claimed. TS05 and AT41/42/51 remain In progress. See [track assessment](../../docs/contest/track-fit.md) and [remaining blockers](../../docs/blocker-log.md).
