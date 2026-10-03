// Real Chromium UI + API + local EVM execution, with a test-only EIP-1193 signer.
// These automated results do not certify Monad, real devices or WebAuthn recovery.
import { browserTest } from './browser.mjs';

export const e2eTests = [
  ['E2E-01', 'Browser invite → accept/approve/fund → early checkout → 700/100/200 → withdrawals'],
  ['E2E-02', 'Browser primary decision: disputed 200 → landlord 50 / tenant 150; withdraw 850/150'],
  ['E2E-03', 'Browser primary/fallback timeouts → fixed 900/100 allocation and withdrawals'],
  ['E2E-04', 'Cancel deposit confirmation: no signature, nonce, funding or phase change'],
  ['E2E-05', 'Reject wallet signature: no submitted transaction or funding'],
  ['E2E-06', 'External test wallet same-address reauthentication after session loss; stranger denied'],
  ['E2E-07', 'Duplicate withdrawal rejected; zero-credit withdrawFor pays nothing twice'],
  ['E2E-08', 'Stop UI/API/DB and use independent original test account + third-party gas/withdrawFor'],
].map(([id, description]) => ({ id, description, requires: [], run: () => browserTest(id) }));
