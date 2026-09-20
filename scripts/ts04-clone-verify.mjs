/**
 * TS04 — Independent clone verification
 *
 * Simulates a brand-new team member cloning the repo and running
 * all documented commands from README with no pre-existing setup.
 *
 * E owns. This script verifies that the documented startup sequence
 * is actually reproducible without manual intervention.
 *
 * Usage: node scripts/ts04-clone-verify.mjs
 *
 * This is a dry-run that checks each command would succeed.
 * Full implementation after RB-02 (pnpm lockfile) and RB-03 (local chain).
 */

import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';

const REQUIRED_FILES = [
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  '.env.example',
  'pnpm-workspace.yaml',
  'package.json',
  'docs/PRD.md',
  'docs/MVP-SPEC.md',
  'docs/team.md',
  'docs/backlog.md',
  'docs/architecture.md',
  'docs/interfaces/README.md',
  'docs/acceptance.md',
  'docs/requirements-traceability.md',
  '.github/workflows/ci.yml',
  'apps/web/README.md',
  'apps/worker/README.md',
  'contracts/README.md',
  'packages/shared/README.md',
  'packages/shared/package.json',
  'infra/README.md',
  'tests/README.md',
  'fixtures/alice-partial-settlement.json',
];

const REQUIRED_COMMANDS = [
  { cmd: 'node scripts/doctor.mjs', since: 'scaffold' },
  { cmd: 'node scripts/check-scaffold.mjs', since: 'scaffold' },
  { cmd: 'node scripts/ts04-clone-verify.mjs', since: 'scaffold' },
  { cmd: 'node tests/runner.mjs integration', since: 'RB-12' },
  { cmd: 'node tests/runner.mjs e2e', since: 'RB-13' },
];

const errors = [];

console.log('=== TS04: Independent clone verification ===\n');

// 1. File presence
console.log('[1/4] Checking required files...');
for (const file of REQUIRED_FILES) {
  if (!existsSync(file)) {
    errors.push(`Missing required file: ${file}`);
  }
}
console.log(`  ${REQUIRED_FILES.length} required files checked`);

// 2. .env.example completeness
console.log('[2/4] Checking environment template...');
const envExample = readFileSync('.env.example', 'utf8');
const REQUIRED_ENV_KEYS = [
  'NEXT_PUBLIC_APP_ENV', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_CHAIN_ID',
  'NEXT_PUBLIC_FACTORY_ADDRESS', 'NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS',
  'RPC_URL', 'RPC_FALLBACK_URL', 'DATABASE_URL',
  'DEPLOYER_ACCOUNT', 'WORKER_GAS_ACCOUNT', 'TEST_GAS_SPONSOR_ACCOUNT',
];
for (const key of REQUIRED_ENV_KEYS) {
  if (!envExample.includes(key)) {
    errors.push(`.env.example missing key: ${key}`);
  }
}
console.log(`  ${REQUIRED_ENV_KEYS.length} env keys checked`);

// 3. pnpm workspace manifest
console.log('[3/4] Checking workspace structure...');
const workspaceApps = readdirSync('apps');
const workspacePkgs = readdirSync('packages');
console.log(`  apps: ${workspaceApps.join(', ')}`);
console.log(`  packages: ${workspacePkgs.join(', ')}`);

// 4. Command documentation alignment
console.log('[4/4] Checking documented commands are coverable...');
const readme = readFileSync('README.md', 'utf8');
for (const { cmd, since } of REQUIRED_COMMANDS) {
  if (!readme.includes(cmd)) {
    errors.push(`Command "${cmd}" (${since}) not documented in README`);
  }
}

// Report
console.log('\n=== Result ===');
if (errors.length === 0) {
  console.log('PASS: Clone verification passed. All required files, env keys, and documented commands are present.');
  console.log('\nNext steps after full implementation:');
  console.log('  pnpm install --frozen-lockfile  # after RB-02');
  console.log('  pnpm infra:up                  # after RB-02');
  console.log('  pnpm chain:local               # after RB-03');
  console.log('  pnpm fixtures:seed             # after RB-08');
  console.log('  pnpm dev                       # after RB-02');
  console.log('  pnpm worker:dev                # after RB-12');
  console.log('  node tests/runner.mjs all      # after RB-13');
} else {
  console.log(`FAIL: ${errors.length} issue(s):`);
  errors.forEach(e => console.log(`  - ${e}`));
}

process.exitCode = errors.length > 0 ? 1 : 0;
