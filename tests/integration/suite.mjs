/**
 * Integration test suite — SIWE replay, cross-lease ACL, version immutability,
 * event idempotency/rollback, RPC fault, Worker stop/start.
 *
 * E owns; D provides permission test cases.
 * IT-03/04/05/06 run the real local EVM and durable Worker recovery fixtures.
 *
 * @typedef {{ id: string, description: string, requires: string[], run: () => Promise<{passed: boolean, output: string}> }} IntegrationTest
 */

/** @type {IntegrationTest[]} */
import { memberDTest, workerSchedulerTest } from './member-d.mjs';
export const integrationTests = [
  {
    id: 'IT-01',
    description: 'SIWE nonce replay is rejected',
    requires: [],
    async run() {
      return memberDTest('auth.test.mjs', 'SIWE: real EOA');
    },
  },
  {
    id: 'IT-02',
    description: "Cross-lease ACL: tenant cannot access another lease's documents",
    requires: [],
    async run() {
      return memberDTest('materials.test.mjs', 'cross-lease documents');
    },
  },
  {
    id: 'IT-03',
    description: 'Event idempotency: same chain event processed once only',
    requires: [],
    async run() {
      return memberDTest('worker-runtime.test.mjs', 'IT-03 ');
    },
  },
  {
    id: 'IT-04',
    description: 'Event rollback: re-org invalidates projection and replays correctly',
    requires: [],
    async run() {
      return memberDTest('worker-runtime.test.mjs', 'IT-04 ');
    },
  },
  {
    id: 'IT-05',
    description: 'Worker stop/start does not double-allocate funds',
    requires: [],
    async run() {
      return memberDTest('worker-runtime.test.mjs', 'IT-05 ');
    },
  },
  {
    id: 'IT-06',
    description: 'RPC fault: read failure does not corrupt balance to zero',
    requires: [],
    async run() {
      return memberDTest('worker-runtime.test.mjs', 'IT-06 ');
    },
  },
  {
    id: 'IT-07',
    description: 'Test gas refills respect quota and do not exceed limits',
    requires: [],
    async run() {
      return memberDTest('cases-gas.test.mjs', 'AT43:');
    },
  },
  {
    id: 'IT-08',
    description: 'SIWE session expires and forces re-auth after 24h',
    requires: [],
    async run() {
      return memberDTest('auth.test.mjs', 'idle and absolute');
    },
  },
  {
    id: 'IT-09',
    description: 'Worker uses confirmed event block and UTC deadline separately',
    requires: [],
    async run() {
      return workerSchedulerTest();
    },
  },
];
