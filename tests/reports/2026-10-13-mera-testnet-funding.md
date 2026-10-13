# Mera public testnet funding verification - 2026-10-13

## Environment and scope

- Product: https://rentbond.vercel.app/ ; chain: Monad Testnet, ID 10143.
- Participant-only lease page: https://rentbond.vercel.app/leases/3308e820-c577-4041-9797-c7f837b732d0 . This is not an invitation or a shared judge account.
- Mera tenant: `0x2E7547C21254b0F4457fef91Ceec847c43cD29dF`.
- Escrow: `0x352d1eb19ebb706ea4fe008358f395666a68987e`.
- MockUSD: `0x36f5486adcfc3cd1076f2afafc720e24edff23b1`, six decimals.
- Evidence reviewed: user-operated recording, account/funding screenshots, public RPC transaction inputs, receipts, events and accounting reads. The user operated the existing passkey account; the verification queries did not sign transactions.

## Confirmed transactions

All three transactions have receipt status `0x1` and the tenant above as sender.

| Operation | Transaction | Block | Nonce | Decoded input |
| --- | --- | --- | --- | --- |
| Accept terms | [0x397f9b109baaa3527bce1b9c97b06f860ba6fa5e8f82a2aabb29bf10abaee855](https://testnet.monadexplorer.com/tx/0x397f9b109baaa3527bce1b9c97b06f860ba6fa5e8f82a2aabb29bf10abaee855) | 70599052 | 0 | `acceptTerms(0xe0483f57cdba12beecf7abea4b4891d97ccbb2920e5b4f5ad6449f4d6aa50e3c)` |
| Approve | [0x481402ab781bc08e68ca5a17981f679b0f46be3b6b2c408adab33e426ca31a51](https://testnet.monadexplorer.com/tx/0x481402ab781bc08e68ca5a17981f679b0f46be3b6b2c408adab33e426ca31a51) | 70599177 | 1 | `approve(escrow, 1000000000)` |
| Fund | [0x0a495f9f622d84c7e1c1f24698419f040f51d6ff6463463576e085a32a18b3a8](https://testnet.monadexplorer.com/tx/0x0a495f9f622d84c7e1c1f24698419f040f51d6ff6463463576e085a32a18b3a8) | 70599330 | 2 | `fund(1000000000)` |

During the approximately 13:40 China time read-only verification, `getAccounting`
returned fundedAmount and unallocated of `1000000000` base units (1,000 MockUSD);
both credits and both withdrawn amounts were zero. This is a dated funding
snapshot, not a claim about later settlement state. The fund receipt also includes
the corresponding token transfer from the tenant to this escrow.

The transaction page can show an Approval event of zero in the fund receipt:
this records consumption of the allowance, not a failed 1,000 MockUSD deposit.
The site's GAS_DISABLED message refers to the optional gas-supply endpoint;
the tenant paid these transactions with test MON already held in the account.

## Fix and automated checks

Commit `90e2593` preserves the local signer in the simulated request. The
production JavaScript was independently inspected after deployment and uses
`wallet.account ?? wallet.address`. Earlier failure and reproduction are in the
[signing regression report](2026-10-13-mera-signing-fix.md); its pending deployment
and funding notes describe the earlier observation, superseded by this report.

At code baseline `f656e747da91c5ddc733c006c165c75524eb7cce`, all seven GitHub check
jobs succeeded: environment, type check, scaffold integrity, contracts,
integration, browser E2E, and the separate scaffold workflow.

- [CI run](https://github.com/Jenny-qi/RentBond/actions/runs/38344423260): 92 Web/backend tests, 41 contract tests, IT-01 through IT-09 and E2E-01 through E2E-08 passed. The Web/backend and contract totals each report zero failures and zero skipped; all listed integration/E2E cases have PASS records.
- [Scaffold run](https://github.com/Jenny-qi/RentBond/actions/runs/38344423487): passed after the required 107 FR/SC/AT/TS index rows were restored with immutable historical evidence links.
- Mera-specific regression tests verify actual SDK transaction serialization and sender recovery using a synthetic signing session and intercepted RPC. They are not a real-passkey device test or a public transaction broadcast.

## Remaining evidence

The reviewed source video is approximately 75.95 seconds and covers accepting
terms and token approval. It starts after login and ends before the deposit
operation/result. The funding screenshot and chain receipts confirm funding,
but do not supply the missing video footage. A login and confirmed-result segment
can be combined with the existing real signed-operation footage, with clear
editing and a final duration of at most two minutes. No public video URL has
been verified or submitted in this work.

Cross-device same-address recovery, actual primary/fallback awards and a full
Mera settlement/withdrawal journey remain outside this verification. Do not
promote the whole TS05 or broader acceptance suite to Verified on this evidence.
No passkey material, browser profile, session cookie or private lease document
is included in this report.
