/**
 * Test runner — executes integration and e2e test suites.
 *
 * Produces structured output for CI consumption:
 * PASS / FAIL per test, total counts, evidence paths.
 *
 * E owns; B/C/D provide specific test cases.
 *
 * Usage:
 *   node tests/runner.ts integration
 *   node tests/runner.ts e2e
 *   node tests/runner.ts all
 */

import { integrationTests } from './integration/suite.js';
import { e2eTests } from './e2e/suite.js';

type Suite = 'integration' | 'e2e' | 'all';

const suiteName = process.argv[2] as Suite;
const suites: Record<string, typeof integrationTests | typeof e2eTests> = {
  integration: integrationTests,
  e2e: e2eTests,
  all: [...integrationTests, ...e2eTests],
};

const tests = suites[suiteName] ?? suites.all;
console.log(`Running ${tests.length} test(s) in suite: ${suiteName ?? 'all'}`);

let passed = 0;
let failed = 0;

for (const test of tests) {
  const { requires } = test;
  if (requires.length > 0) {
    console.log(`SKIP ${test.id} — requires: ${requires.join(', ')}`);
    continue;
  }
  try {
    const result = await test.run();
    if (result.passed) {
      console.log(`PASS ${test.id}: ${test.description}`);
      passed++;
    } else {
      console.log(`FAIL ${test.id}: ${test.description}`);
      console.log(`  → ${result.output ?? result.evidence}`);
      failed++;
    }
  } catch (err) {
    console.log(`FAIL ${test.id}: ${test.description}`);
    console.log(`  → ${err}`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed, ${tests.length - passed - failed} skipped`);
process.exitCode = failed > 0 ? 1 : 0;
