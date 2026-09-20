/**
 * Test runner — executes integration and e2e test suites.
 *
 * Produces structured output for CI consumption:
 * PASS / FAIL per test, total counts, evidence paths.
 *
 * E owns; B/C/D provide specific test cases.
 *
 * Usage:
 *   node tests/runner.mjs integration
 *   node tests/runner.mjs e2e
 *   node tests/runner.mjs all
 *
 * Output:
 *   - Console: human-readable progress
 *   - tests/reports/{suite}-{date}.json: machine-readable results
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { integrationTests } from './integration/suite.mjs';
import { e2eTests } from './e2e/suite.mjs';

const suiteName = process.argv[2] ?? 'all';
const suites = {
  integration: integrationTests,
  e2e: e2eTests,
  all: [...integrationTests, ...e2eTests],
};

const tests = suites[suiteName] ?? suites.all;
const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const reportPath = join('tests', 'reports', `${suiteName}-${date}.json`);

mkdirSync('tests/reports', { recursive: true });

console.log(`\n=== RentBond Test Runner ===`);
console.log(`Suite : ${suiteName}`);
console.log(`Tests : ${tests.length}`);
console.log(`Report: ${reportPath}\n`);

const results = [];
let passed = 0;
let failed = 0;
let skipped = 0;

for (const test of tests) {
  const { id, description, requires } = test;

  if (requires.length > 0) {
    console.log(`SKIP ${id} — requires: ${requires.join(', ')}`);
    results.push({ id, description, status: 'skipped', completedAt: new Date().toISOString() });
    skipped++;
    continue;
  }

  console.log(`RUN  ${id}: ${description}`);
  const start = Date.now();

  try {
    const result = await test.run();
    const durationMs = Date.now() - start;

    if (result.passed) {
      console.log(`PASS ${id} (${durationMs}ms)`);
      results.push({ id, description, status: 'passed', completedAt: new Date().toISOString() });
      passed++;
    } else {
      const output = result.output ?? result.evidence;
      console.log(`FAIL ${id} (${durationMs}ms)`);
      console.log(`     → ${output}`);
      results.push({ id, description, status: 'failed', output, completedAt: new Date().toISOString() });
      failed++;
    }
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`FAIL ${id} (${durationMs}ms)`);
    console.log(`     → ${message}`);
    results.push({ id, description, status: 'failed', output: message, completedAt: new Date().toISOString() });
    failed++;
  }
}

const report = {
  suite: suiteName,
  generatedAt: new Date().toISOString(),
  total: tests.length,
  passed,
  failed,
  skipped,
  results,
};

writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`\n=== Results ===`);
console.log(`Passed : ${passed}`);
console.log(`Failed : ${failed}`);
console.log(`Skipped: ${skipped}`);
console.log(`Report : ${reportPath}`);

process.exitCode = failed > 0 ? 1 : 0;
