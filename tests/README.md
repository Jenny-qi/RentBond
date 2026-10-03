# Cross-module tests

E owns the runner and browser harness; B reviews funds, C reviews page behavior, D reviews API/session boundaries. Local automated evidence is separate from public testnet and real-device acceptance.

## Run from a new checkout

Use Node 24 and the pinned dependencies in the workspace lockfile:

```sh
pnpm install --frozen-lockfile
pnpm --filter @rentbond/web run backend:abi
pnpm --filter @rentbond/web exec playwright install --with-deps chromium
node tests/runner.mjs integration
node tests/runner.mjs e2e
node tests/runner.mjs all
```

The E2E command starts its own loopback-only Next UI, an HTTP bridge to the production `handleApi`, temporary PGlite/private storage and Hardhat local EVM. No pre-existing server, public RPC, `.env` file, real wallet or public testnet funds are used. It generates ephemeral test signers; keys never enter browser pages, reports or Git. The browser receives a test-only EIP-1193 provider through Playwright, while SIWE signatures, API authorization, calldata, contracts, receipts and balances execute normally.

A fictional document uses the explicitly injected scanner test double. This harness does not verify ClamAV or the normal deployed `getApp` boot/background loop. Worker runtime/restart behavior is tested separately by IT-03–06 and the Worker regression suite.

Optional `RENTBOND_CHROMIUM_PATH` selects an installed official Chromium/headless-shell executable when the usual browser download is unavailable. CI installs the pinned Playwright browser normally.

## Integration coverage

IT-01–IT-09 are executable: SIWE replay, cross-lease ACL, event idempotency, reorg rollback, durable Worker restart, RPC failure, gas quota, session expiry, and UTC-deadline/block-height separation. See [Worker runtime report](reports/2026-10-03-worker-runtime.md).

## Browser coverage

| ID | Actual automated local scenario |
| --- | --- |
| E2E-01 | Page-created draft, invitation, tenant joining, separate accept/approve/fund confirmations, early checkout, two deductions, accept/dispute, 700/100/200, then 700/100 withdrawals |
| E2E-02 | Primary reasons and 50/150 award on disputed 200; no immediate allocation; fixed challenge deadline; final 850/150 and both withdrawals |
| E2E-03 | Primary timeout, fallback timeout, exit notice, fixed 900/100 allocation and both withdrawals |
| E2E-04 | Cancel deposit confirmation; unchanged wallet transaction count, funding and lease phase |
| E2E-05 | Wallet rejects signing; cancellation feedback; no broadcast, nonce increase or funding |
| E2E-06 | Revoke session and open a fresh browser context; same original external test wallet regains tenant access; unrelated wallet is denied |
| E2E-07 | Tenant withdraws once; UI removes action; repeat own withdrawal simulation is rejected; zero-credit third-party withdrawFor pays nothing twice |
| E2E-08 | Stop UI/API/database, leave only local RPC; independent original test-key restoration, third-party gas transfer, public expiry and withdrawFor to the original tenant only |

E2E-06 does **not** verify Mera/WebAuthn PRF or cross-device recovery. E2E-08 is a local shutdown slice, not full real-device AT51 certification. Real devices, Monad public testnet, independent reproduction/funds review and deployed PostgreSQL remain separate acceptance requirements. No AT is promoted to Verified by these automated results alone.

## Reports and failure behavior

`tests/reports/{suite}-{date}.json` records per-ID results. Passing E2E entries retain source commit/dirty-tree metadata, actual durations, public transaction receipts, accounting and screenshot paths. Screenshots and detailed harness results are generated under ignored `test-results/e2e-local/`; CI uploads them even on failure. No screenshot is a substitute for receipt/balance assertions.

Unknown/empty selections fail. Missing results or harness errors fail. Any skipped requirement exits 2; any failed test exits 1. A selected slice such as `--only=E2E-06` is explicitly a slice and cannot be reported as all eight passing. [Acceptance](../docs/acceptance.md) still requires the applicable deployment/device evidence and second-person review.
