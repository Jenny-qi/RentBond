import { existsSync } from 'node:fs';
const checks = [
  ['Node.js 24.x', process.versions.node.startsWith('24.')],
  ['workspace manifest', existsSync('pnpm-workspace.yaml')],
  ['environment template', existsSync('.env.example')],
  ['requirements baseline', existsSync('docs/PRD.md')],
];
for (const [label, ok] of checks) console.log(`${ok ? 'OK' : 'FAIL'} ${label}`);
console.log('SCAFFOLD ONLY: RPC, bytecode, migrations, Storage ACL and secrets validation are NOT IMPLEMENTED (RB-02/RB-03/RB-08).');
process.exitCode = checks.every(([, ok]) => ok) ? 0 : 1;
