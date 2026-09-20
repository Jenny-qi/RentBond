/**
 * E2E test suite — full happy path, 700/100/200 split, timeouts,
 * cancel/refuse, account recovery.
 *
 * E and C own; screenshots used for UI, transaction hashes for funds.
 * These are NOT runnable yet — run after RB-12 / RB-13.
 *
 * Target: mobile width (375px) and keyboard navigation.
 *
 * @typedef {{ id: string, description: string, requires: string[], run: () => Promise<{passed: boolean, evidence: string}> }} E2ETest
 */

/** @type {E2ETest[]} */
export const e2eTests = [
  {
    id: 'E2E-01',
    description: 'Full flow: invite → fund → checkout → claims → 700/100/200 split → withdraw',
    requires: ['RB-12'],
    async run() {
      return { passed: false, evidence: 'Not implemented — RB-12 required' };
    },
  },
  {
    id: 'E2E-02',
    description: 'Partial dispute resolved: 200 → 50/150 final allocation',
    requires: ['RB-12', 'RB-07'],
    async run() {
      return { passed: false, evidence: 'Not implemented — RB-07 required' };
    },
  },
  {
    id: 'E2E-03',
    description: 'Service timeout: 900/100 exit policy',
    requires: ['RB-12', 'RB-06'],
    async run() {
      return { passed: false, evidence: 'Not implemented — RB-06 required' };
    },
  },
  {
    id: 'E2E-04',
    description: 'Cancel before fund: no state change, no transactions',
    requires: ['RB-09'],
    async run() {
      return { passed: false, evidence: 'Not implemented — RB-09 required' };
    },
  },
  {
    id: 'E2E-05',
    description: 'Refuse to sign fund: transaction not submitted',
    requires: ['RB-09'],
    async run() {
      return { passed: false, evidence: 'Not implemented — RB-09 required' };
    },
  },
  {
    id: 'E2E-06',
    description: 'Recover account with same address after session loss',
    requires: ['RB-08'],
    async run() {
      return { passed: false, evidence: 'Not implemented — RB-08 required' };
    },
  },
  {
    id: 'E2E-07',
    description: 'Duplicate withdraw call: second call fails silently (no double payment)',
    requires: ['RB-12'],
    async run() {
      return { passed: false, evidence: 'Not implemented — RB-12 required' };
    },
  },
  {
    id: 'E2E-08',
    description: 'AT51: Full stop of all services, recover from chain state with third-party gas',
    requires: ['RB-13'],
    async run() {
      return { passed: false, evidence: 'Not implemented — RB-13 required' };
    },
  },
];
