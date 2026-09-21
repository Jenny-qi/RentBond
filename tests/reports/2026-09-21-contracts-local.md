# Contract local verification — 2026-09-21

Status: provisional local evidence prepared on branch `fix/contracts-state-rules`. The PR head commit is the source of truth once this branch is pushed. Do not use this report as Monad deployment or independent-audit evidence.

## Environment

- Solidity: 0.8.24
- Forge npm package: `@foundry-rs/forge@1.7.1`
- Forge binary: 1.7.1, commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8`
- Profile: optimizer enabled, 1 run, via-IR

## Commands and results

```sh
npm run build:contracts
npm run test:contracts
npm run check:contract-sizes
node scripts/check-scaffold.mjs
```

Final local handoff run: 32 passed, 0 failed, 0 skipped. `forge fmt --check`, the scaffold check, the full contract build and the production-size check also completed successfully.

`DeployCore.s.sol` also completed a non-broadcast local Forge dry run on chainId 31337 and constructed MockUSD, Registry, EscrowDeployer and Factory. This proves script execution only; it is not a persistent local-chain or Monad deployment.

Covered paths include deterministic resolver profiles, R/F acceptance and revocation, exact funding, 700/100/200 allocation, early checkout agreement/disagreement, primary/fallback decisions, challenge invalidation, service timeout, evidence history, settlement revision invalidation, fixed-beneficiary withdrawal, hardEnd and extra direct token transfer.

## Production-contract runtime sizes

The size command excludes tests and Forge script runner contracts. Last observed optimized runtime values:

| Contract | Runtime bytes | EIP-170 margin |
| --- | ---: | ---: |
| DepositEscrow | 20,651 | 3,925 |
| DepositEscrowDeployer | 23,768 | 808 |
| LeaseFactory | 3,653 | 20,923 |
| ResolverRegistry | 4,673 | 19,903 |
| MockUSD | 1,540 | 23,036 |

## Not established by this report

- no Monad RPC/chain/account compatibility result;
- no deployed address, transaction, block or ABI digest;
- no independent reviewer result;
- no complete deadline matrix, fuzz/invariant campaign or malicious-token suite;
- no web, API, Worker, passkey or end-to-end result.
