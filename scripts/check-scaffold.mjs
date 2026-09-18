import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, extname } from 'node:path';

const root = process.cwd();
const errors = [];
const files = [];
const ignored = new Set(['.git', 'node_modules', '.next', 'dist', 'out', 'cache']);
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile()) files.push(path);
  }
}
walk(root);
function requireFile(path) {
  if (!existsSync(resolve(root, path))) errors.push(`Missing ${path}`);
}
for (const file of ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', '.env.example', 'pnpm-workspace.yaml',
  'docs/PRD.md', 'docs/MVP-SPEC.md', 'docs/team.md', 'docs/backlog.md', 'docs/changes.md',
  'docs/requirements-traceability.md', 'docs/acceptance.md', '.github/workflows/scaffold.yml',
  'apps/web/README.md', 'apps/worker/README.md', 'contracts/README.md', 'packages/shared/README.md',
  'infra/README.md', 'tests/README.md']) requireFile(file);

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (extname(file) === '.json') {
    try { JSON.parse(text); } catch (e) { errors.push(`${relative(root,file)}: ${e.message}`); }
  }
  if (extname(file) !== '.md') continue;
  for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const link = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(link)) continue;
    const local = decodeURIComponent(link.split('#')[0]);
    if (local && !existsSync(resolve(dirname(file), local))) errors.push(`${relative(root,file)}: broken link ${link}`);
  }
}
function checkIDs(file, prefix, count) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (let n = 1; n <= count; n++) {
    const id = prefix + String(n).padStart(2, '0');
    const lines = text.split(/\r?\n/).filter(l => l.startsWith(`| ${id} |`));
    if (lines.length !== 1) errors.push(`${file}: expected one row for ${id}, got ${lines.length}`);
  }
}
checkIDs('docs/requirements-traceability.md', 'FR-', 34);
checkIDs('docs/requirements-traceability.md', 'SC-', 16);
checkIDs('docs/acceptance.md', 'AT', 52);
checkIDs('docs/acceptance.md', 'TS', 5);
checkIDs('docs/backlog.md', 'RB-', 14);
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const [name, command] of Object.entries(pkg.scripts)) {
  const script = /^node ([^ ]+)/.exec(command)?.[1];
  if (script) requireFile(script);
}
const fixture = JSON.parse(readFileSync('fixtures/alice-partial-settlement.json', 'utf8'));
const deposit = BigInt(fixture.depositBaseUnits);
const allocation = Object.values(fixture.afterClaimWindowClosed).reduce((a,b) => a + BigInt(b), 0n);
if (allocation !== deposit) errors.push('Fixture initial allocation does not conserve deposit');
for (const [name, shares] of Object.entries(fixture.expectedFinalAllocation)) {
  if (BigInt(shares.tenant) + BigInt(shares.landlord) !== deposit) errors.push(`Fixture ${name} does not conserve deposit`);
}
if (errors.length) {
  errors.forEach(e => console.error(`FAIL ${e}`));
  process.exitCode = 1;
} else {
  console.log(`PASS scaffold: ${files.length} files, local Markdown links, JSON, directory entries, 34 FR / 16 SC / 52 AT / 5 TS / 14 RB rows and fixture accounting.`);
  console.log('Business tests, external URLs and deployed environments were NOT verified.');
}
