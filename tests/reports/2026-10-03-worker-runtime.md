# Worker local runtime verification — 2026-10-03

Base: main cef20d45595dac356e98de5eef6ce79226e4bb1c. Code initially committed as da01497 and rebased by merging the updated main, preserving D's returning-source task fix. This is author-run evidence, not independent acceptance.

Environment: Node 24.19.0, pinned solc 0.8.24, Hardhat local EVM configured as chain 10143, generated ephemeral test keys, PGlite memory fixtures plus one disk-backed process-restart fixture. No deployed Monad transactions or real funds were sent.

## Reproduce

```sh
npm run backend:abi --prefix apps/web
npm run test:worker
npm test --prefix apps/web
npm run typecheck --prefix apps/web
node tests/runner.mjs integration
node tests/runner.mjs e2e
```

Initial runtime suite: 5/5 passed. Added separate service timeout/finalization regression: 1/1 passed. Integration: IT-01–IT-09, 9 passed, 0 failed, 0 skipped. Final Web regression: 75/75 passed, including the new timeout test and D returning-source regression. Typecheck passed. E2E: 0 passed, 8 skipped, exit 2 (incomplete); the gate remains enabled.

Runtime tests verify actual factory/escrow ABI decoding and attachment, repeated event replay, EVM checkpoint fork rollback/refunding, a child Node process recovering signed bytes broadcast before a simulated crash without increasing signer nonce, RPC read failure and wrong fallback chain preserving balances, UTC deadline boundaries, a human advancing while Worker is offline, graceful stop, and separate close/open-case/escalate/service-timeout/final-timeout dispatch. The final timeout regression returns 900 unclaimed plus 100 disputed to T; it is not the 900/100 accepted-claim demo.

## Limits

No independent reviewer, deployed Worker/PostgreSQL end-to-end recovery, deployed Monad full allocation and withdrawals, real device restoration or browser E2E acceptance. FINALIZE_PRIMARY and EXPIRE_ESCROW are allowlisted but not yet exercised by the new runtime fixtures. Missing receipts intentionally block signed work in reconcile; an operator must inspect nonce/canonical state. No party/resolver action or withdrawal is automatically signed.
