# Mera transaction signing regression - 2026-10-13

## Observed failure

The recorded tenant flow logged in with a real passkey, but accepting terms
returned `RPC Request failed`. At approximately 11:37 China time, read-only
Monad Testnet checks found zero funded amount and both latest and pending
transaction counts of zero for the demo tenant. Simulation and gas estimation
for `acceptTerms` succeeded. These checks did not submit any transaction.

The production JavaScript asset
`https://rentbond.vercel.app/_next/static/chunks/753-0fbbfff60921832a.js`
was inspected: it simulated with `account: active.address` and passed the
returned request unchanged to `writeContract`, matching the repository bug.

## Cause and fix

viem parses an address-only simulation account as `type: json-rpc`. The returned
request overrides the wallet client's local Mera signer. A controlled transport
reproduced `eth_sendTransaction` / `wallet_sendTransaction` instead of local
signing and `eth_sendRawTransaction`. A public node cannot sign for this account.

`simulateAction` preserves `wallet.account` for Mera, falling back to the address
for an external wallet. LiveProvider uses this tested boundary. Confirmation,
simulation, session guards and receipt checks remain in place. No private key,
passkey, ABI, contract, deployment address or database change is required.

## Validation

- `node --test src/features/live/signing.test.mjs src/features/live/client.test.mjs`
  from apps/web: 10 passed, 0 failed, 0 skipped.
- `npm run typecheck` from apps/web: passed.
- The Mera regression uses a synthetic test signing session with the actual SDK
  and viem, intercepts RPC, recovers the sender from the signed transaction and
  checks chain ID, recipient, calldata and zero native value. No public network
  broadcast is made by this test.
- External-wallet regression confirms the provider still receives its own
  `eth_sendTransaction` request.

## Deployment and acceptance boundary

The public frontend is deployed from `hongmingxi65-oss/RentBond`, not directly
from `Jenny-qi/RentBond`. The current GitHub identity has read access but no push
access to the deployment repository. Its owner must apply the fix and redeploy
before another real recording attempt. The equivalent minimal source fix is
to replace `account: active.address` with `account: active.account ?? active.address`
in the transaction simulation in LiveProvider.

The current demo lease acceptance deadline is 2026-10-13 12:00 China time.
After expiry, prepare a new lease with a sufficient acceptance/funding window.
No successful Mera-signed public transaction, deposit or completed video is
claimed by this local fix. Real passkey signing and confirmed funding on the
updated public deployment remain required acceptance evidence.
