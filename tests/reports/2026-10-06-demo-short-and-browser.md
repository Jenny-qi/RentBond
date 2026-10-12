# DEMO_SHORT preparation and local browser verification — 2026-10-06

Baseline main: `4a34c3096e8e28184e4ec9f2ba29096694eddc20`, fetched again on this date with no new upstream commit. Work remains on isolated branch `fix/live-staging-20261006`. No teammate file was deleted, renamed, reset or restored over their changes. App code, contracts, ABI, migrations, branding, dependency manifests and lockfile remain identical to this baseline.

## New preparation

`infra/staging/demo-short.mjs` creates private, unreviewed service terms and unsigned create/R/F acceptance parameters. It reuses the shared salted commitment implementation and generated Registry ABI. Timing matches `CreateDemoShortProfile.s.sol`; hard-end offset is 3,600 seconds after lease end, while checkout retry remains 86,400 seconds. The script accepts only chain 10143, distinct nonzero R/F, valid money, actual addresses/terms and future timestamps. It performs no network calls, key handling or signing.

The output directory must be new and under an ignored `private/` directory. Directory mode is 0700; files are exclusive-created with mode 0600. Existing outputs cannot be overwritten. Private terms/salt are absent from the unsigned public parameters and console summary. The import draft is explicitly `reviewed:false` and requires actual review; this preparation is not an accepted chain deployment. The staging workflow now has a separate dependency-installed local-EVM preparation job.

## Checks executed

| Check | Result |
| --- | --- |
| `cd apps/web && node --test ../../infra/staging/demo-short.test.mjs` | 4 passed, 0 failed, 0 skipped |
| Actual local Registry hash/calldata + production `checkedProfile` | Matches Solidity hashes; generated create/accept calldata succeeds; unavailable until both R/F accept; immutable private profile rejects modification |
| `RENTBOND_CHROMIUM_PATH=/absolute/path/chrome-headless-shell node tests/runner.mjs e2e` | 8 passed, 0 failed, 0 skipped |

The default Playwright Chromium 151 download repeatedly returned a truncated/non-ZIP payload. The official Chrome for Testing 145.0.7632.6 headless archive was used with the harness's existing executable override; its downloaded MD5 matched the official HTTP metadata and all ZIP CRCs passed. Runtime Node is 24.19.0; project Playwright is 1.62.1. No browser test source/dependency was changed to obtain a pass.

The E2E run completed at `2026-10-06T07:05:58.251Z`. Its recorded source commit is `d8d2b93030e1557c3d38f4b2673aad2df0ecbf68`, with a dirty worktree due to the isolated infrastructure additions. Production app/contract source was unchanged. See [machine-readable report](e2e-2026-10-06.json). Screenshots and detailed local receipts are included in the delivery archive under `evidence/local-browser/`.

## Browser results

| Scenario | Result |
| --- | --- |
| E2E-01 | Invite/create/accept/approve/fund, early checkout, 700 tenant / 100 landlord / 200 disputed, early withdrawals |
| E2E-02 | Primary decision for disputed 200; final 850 tenant / 150 landlord; both withdrawals confirmed |
| E2E-03 | Primary/fallback timeout; fixed 900 tenant / 100 landlord; withdrawals confirmed |
| E2E-04 | Cancel confirmation; no signature, nonce, funding or phase change |
| E2E-05 | Reject signature; no submitted transaction/funding |
| E2E-06 | Same-address external test-wallet reauthentication; stranger denied |
| E2E-07 | Duplicate withdrawal rejected; zero-credit `withdrawFor` pays nothing twice |
| E2E-08 | Shut down UI/API/database; independent original test account and third-party gas still progress and pay fixed beneficiaries |

The browser harness uses actual Next.js pages, the production HTTP API and compiled contracts on an isolated local EVM. It uses ephemeral EIP-1193 test wallets, PGlite and a scanner substitute. These are local contract/API/browser receipts, not Monad explorer transactions, actual Mera device recovery or deployed PostgreSQL/ClamAV evidence. The existing browser timing is accelerated for local verification; it is not the newly generated DEMO_SHORT profile. No public RPC/wallet transaction was signed or broadcast. No AT/TS is promoted to Verified.

## Still needed for the requested online product

The CI/staging changes cannot yet be pushed with the connected GitHub integration (create-branch 403 and no shell push credentials). No operator-controlled Linux Docker server/domain or usable hosting project is attached here; no public URL has been created. Docker Engine is absent, so the full production container stack remains unexecuted. Preparation can proceed before final version freeze, but actual host deployment, accepted DEMO_SHORT profile and real Monad funding/deduction/settlement/withdrawal receipts remain open. The available Sites runtime lacks the raw TCP dependencies required by this implementation; no separate replacement frontend was published.

Once a host/hosting project is connected, execute the documented staging deployment and real service checks, then use actual role wallets for the public chain scenario. The technical deployment work remains ours to do; the missing inputs are account access/target environment and role-owner signatures.
