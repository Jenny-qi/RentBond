import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from '../../apps/web/node_modules/typescript/lib/typescript.js';

const address = '0x1234567890123456789012345678901234567890';

test('Worker deadlines are UTC seconds, with event block kept separately', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rentbond-scheduler-'));
  try {
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    for (const name of ['index', 'scheduler']) {
      const source = readFileSync(new URL(`../../apps/worker/src/jobs/${name}.ts`, import.meta.url), 'utf8');
      const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
      writeFileSync(join(dir, `${name}.js`), output);
    }
    const { decideJobTrigger, createJob } = await import(`file://${join(dir, 'scheduler.js')}`);
    const block = 65_000_000n;
    const observedAt = 1_800_000_000;
    const deadline = 1_800_000_600n;
    const close = decideJobTrigger({ name: 'ClaimsOpened', args: { claimDeadline: deadline } }, address, block, observedAt);
    assert.equal(close.triggerBlock, block);
    assert.equal(close.dueAt, deadline);
    assert.equal(createJob(close).dueAt, deadline);
    assert.equal(createJob(close).leaseAddress, address);

    const escalation = decideJobTrigger({ name: 'CaseEscalated', args: { caseId: 2n, fallbackDeadline: deadline } }, address, block, observedAt);
    assert.equal(escalation.type, 'MARK_SERVICE_TIMEOUT');
    assert.equal(createJob(escalation).caseId, 2n);
    assert.notEqual(createJob(escalation).id, createJob({ ...escalation, caseId: 3n }).id);
    assert.equal(decideJobTrigger({ name: 'DecisionFinalized', args: {} }, address, block, observedAt), null);
    assert.equal(decideJobTrigger({ name: 'EscrowExpired', args: {} }, address, block, observedAt), null);
    assert.throws(() => decideJobTrigger({ name: 'ClaimsOpened', args: { claimDeadline: deadline } }, '0x', block, observedAt));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
