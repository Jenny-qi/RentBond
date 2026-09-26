# Monad Testnet manual checkpoint — 2026-09-24

Status: **partial hand-run funding evidence, not a verified release manifest**. This file documents a manual Remix/MetaMask exercise, not the output of the repository deployment script. Do not use it as an application configuration or as proof that the complete 700/100/200 flow passed on testnet. MockUSD is a valueless 6-decimal test token.

Network: Monad Testnet, chain ID 10143.

## Core addresses observed during the exercise

| Contract | Address |
| --- | --- |
| MockUSD | `0x36f5486ADcFC3Cd1076F2aFaFC720E24EdFf23B1` |
| ResolverRegistry | `0x61f13f0c0DAaC2802EeD3Cd4DD9FD67c93d0ce30` |
| DepositEscrowDeployer | `0x7E717703E2bf6cF0b7562DA8cdEb718e65A4f13f` |
| LeaseFactory | `0x6ed49Bf8EE5E9ba2cbE2977fe100342Fe2999a7E` |
| Example DepositEscrow | `0x80753a6Dd914177fE8AD8cE28B325Fe1B677C479` |

## Example funded lease

- Profile ID: `0x9d11cc21a087da5a3c031200ccd38abd11bc032de76f6b7eb472ea95df6a5467`
- Lease ID: `0x1c8007824fec6be4b1d0ed65b9fe17cc9c3fdd2271a85972487f767de4cef3b6`
- Terms hash: `0x0006587a2c9ea840274a851bebc012b87b015e664d5b12e5374e50c48a59c101`
- Lease creation tx: `0x70f948a33e3af390cf53458b192ab6276ae5cac4a60414121bee8c40fcb8cafe`
- Funding tx: `0xf7e1cfef92efa9ba94fcffc94a7d66e5dde6c53ba19eedadce2ff1e1590286fa`
- After funding, Remix read `phase() = 2` (Active) and MockUSD `balanceOf(escrow) = 1000000000` base units (1,000 MockUSD). These values were recorded from the user's screenshots; independent RPC/receipt verification is pending.

## Before converting to a release manifest

B/E should independently read the chain ID, transaction receipts and status, deployed bytecode, Factory's Registry/Deployer/Token references, Registry profile R/F acceptance and scope, escrow terms/accounting, exact deployment block and tx for each core contract. Pin the exact source commit, compiler settings, ABI digests, timing/timeout policy and migration version. The example lease is funded but no testnet claim, allocation, withdrawal or full cross-layer acceptance is established by this record.

No seed phrases, private keys, or wallet credentials belong in this file.
