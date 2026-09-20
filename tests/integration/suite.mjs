/**
 * Integration test suite — SIWE replay, cross-lease ACL, version immutability,
 * event idempotency/rollback, RPC fault, Worker stop/start.
 *
 * E owns; D provides permission test cases.
 * These are NOT runnable yet — run after RB-08 / RB-12 complete.
 *
 * @typedef {{ id: string, description: string, requires: string[], run: () => Promise<{passed: boolean, output: string}> }} IntegrationTest
 */

/** @type {IntegrationTest[]} */
export const integrationTests = [
  {
    id: 'IT-01',
    description: 'SIWE nonce replay is rejected',
    requires: ['RB-08'],
    async run() {
      return { passed: false, output: 'Not implemented — RB-08 required' };
    },
  },
  {
    id: 'IT-02',
    description: "Cross-lease ACL: tenant cannot access another lease's documents",
    requires: ['RB-08'],
    async run() {
      return { passed: false, output: 'Not implemented — RB-08 required' };
    },
  },
  {
    id: 'IT-03',
    description: 'Event idempotency: same chain event processed once only',
    requires: ['RB-12'],
    async run() {
      return { passed: false, output: 'Not implemented — RB-12 required' };
    },
  },
  {
    id: 'IT-04',
    description: 'Event rollback: re-org invalidates projection and replays correctly',
    requires: ['RB-12'],
    async run() {
      return { passed: false, output: 'Not implemented — RB-12 required' };
    },
  },
  {
    id: 'IT-05',
    description: 'Worker stop/start does not double-allocate funds',
    requires: ['RB-12'],
    async run() {
      return { passed: false, output: 'Not implemented — RB-12 required' };
    },
  },
  {
    id: 'IT-06',
    description: 'RPC fault: read failure does not corrupt balance to zero',
    requires: ['RB-12'],
    async run() {
      return { passed: false, output: 'Not implemented — RB-12 required' };
    },
  },
  {
    id: 'IT-07',
    description: 'Test gas refills respect quota and do not exceed limits',
    requires: ['RB-08'],
    async run() {
      return { passed: false, output: 'Not implemented — RB-08 required' };
    },
  },
  {
    id: 'IT-08',
    description: 'SIWE session expires and forces re-auth after 24h',
    requires: ['RB-08'],
    async run() {
      return { passed: false, output: 'Not implemented — RB-08 required' };
    },
  },
];
