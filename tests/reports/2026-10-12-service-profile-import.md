# New test service profile — 2026-10-12

Profile `0x823ff8d2cbefaecd21e0b51b2ed29ba49a57e382f5051f24c9f2f92ecc232ab5`
was prepared with the existing DEMO_SHORT generator, then registered and
accepted by the user's own resolver wallets in Remix. No agent wallet signed
or broadcast those transactions. The generator's four tests passed, including
local EVM registration and rejection before both resolver acceptances. The first
test invocation from repository root failed because Hardhat config lives in
apps/web; the corrected invocation there passed with zero skips.

Independent official Monad Testnet RPC reads at 2026-10-12T06:31:46Z confirmed
chain 10143, exists=true, primaryAccepted=true, fallbackAccepted=true,
closedForNewFunding=false, acceptUntil=1793462400, and exact agreement between
all profile parameters and the original canonical salted manifest. Registration
simulation and both Solidity hash-computation reads had also passed before the
user's transactions.

The existing Azure profile-import CLI then inserted the reviewed test service.
The normal backend checkedProfile guard returned backendServiceEligible=true.
The original manifest/salt was retained under mode-private persistent /data
operator storage and in the user's saved download package, not Git.
The first import script hit a JavaScript parse error from portal newline
conversion before executing any insertion. A corrected document encoding
completed the CLI import and backend eligibility check.

A temporary synthetic test signer authenticated through the canonical
https://rentbond.vercel.app API with exact SIWE origin/domain and chain 10143,
queried /api/resolver/profiles and received HTTP 200, serviceCount=1,
newServiceListed=true. Logout returned HTTP 200. No lease draft, chain
transaction or funds operation was performed by that check.

The profile is explicitly an operator-controlled test demonstration with
valueless MockUSD, shortened deadlines and no independent arbitration claim.
Maximum deposit is 1,000 MockUSD. This resolves the missing backend service
configuration blocker. It does not resolve MetaMask classification review,
certify user-device login, or establish the public deposit/allocation/withdrawal
flow. No complete FR/SC/AT/TS is promoted to Verified.
