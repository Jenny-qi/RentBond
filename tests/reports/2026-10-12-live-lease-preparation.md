# Canonical API lease preparation — 2026-10-12

Two disposable synthetic signers authenticated through the canonical Vercel
origin using nonce-provided SIWE domain/URI and chain 10143. No user wallet key
was obtained. The newly accepted service profile was selected from the API.

Verified live results: deposit above the service's 1,000 MockUSD cap rejected
with 422; fictional draft created with 201 and bound to the correct service;
tenant private access before joining rejected with 403; preparation before
joining rejected with 422; targeted invitation created and claimed; join result
explicitly says termsAccepted=false; stale draft version rejected with 409;
tenant cannot invoke landlord preparation (403); landlord preparation returned
createLease arguments and requiresWalletConfirmation=true.

The official Monad Testnet RPC simulated these exact returned createLease
arguments against the existing Factory successfully. No transaction was
signed or broadcast, no escrow was created, and no test tokens moved. Both
temporary sessions logged out with HTTP 200.

Only a fictional private draft was retained under the temporary test accounts:
c8b00d2b-27b8-4446-90e6-4577b6da6936. It does not belong to the user's accounts.
No real lease record was edited or purged.

Browser observation confirmed the canonical homepage and /leases route render;
the latter presents authentication when not signed in. User-owned browser
login, actual createLease confirmation, deposit funding and settlement remain
unverified. The MetaMask classification issue is not bypassed or resolved by
synthetic API tests. No complete FR/SC/AT/TS is promoted to Verified.
