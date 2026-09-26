import test from 'node:test';
import assert from 'node:assert/strict';
import { transition } from './model.ts';
import { createAliceLease } from './types.ts';
const reason = '虚构逐项理由：对照入住与退租照片，支持部分金额，其余归租客。';
test('withdraw 700 then allocate 150 then withdraw again preserves 850/150', () => {
  let s = transition(createAliceLease(), { type: 'withdraw', role: 'TENANT' });
  s = transition(s, { type: 'stage', stage: 'primary-ready' });
  s = transition(s, { type: 'finalize' });
  s = transition(s, { type: 'withdraw', role: 'TENANT' });
  s = transition(s, { type: 'withdraw', role: 'LANDLORD' });
  assert.equal(s.allocation.tenantWithdrawn, '850000000');
  assert.equal(s.allocation.landlordWithdrawn, '150000000');
  assert.equal(s.allocationMode, 'withdrawn');
  assert.throws(() => transition(s, { type: 'withdraw', role: 'TENANT' }));
});
test('different party accepts exact submitted shares and invalidates case', () => {
  const s = transition(createAliceLease(), { type: 'propose', role: 'TENANT', tenantShare: '125500000', landlordShare: '74500000' });
  assert.throws(() => transition(s, { type: 'accept', role: 'TENANT' }));
  assert.throws(() => transition(s, { type: 'accept', role: 'RESOLVER' }));
  const settled = transition(s, { type: 'accept', role: 'LANDLORD', proposalId: s.proposal.id });
  assert.equal(settled.allocation.tenantCredit, '825500000');
  assert.equal(settled.allocation.landlordCredit, '174500000');
  assert.equal(settled.primaryProposed, false);
  assert.throws(() => transition(settled, { type: 'finalize' }));
});
test('stage change invalidates proposal and challenged primary stays invalid', () => {
  let s = transition(createAliceLease(), { type: 'propose', role: 'LANDLORD', tenantShare: '200000000', landlordShare: '0' });
  s = transition(s, { type: 'challenge', role: 'TENANT' });
  assert.equal(s.proposal, undefined);
  assert.throws(() => transition(s, { type: 'accept', role: 'TENANT' }));
  assert.throws(() => transition(s, { type: 'finalize' }));
  assert.throws(() => transition(s, { type: 'stage', stage: 'primary-ready' }));
});
test('fallback is restricted, validates award, then allocates', () => {
  const s = transition(createAliceLease(), { type: 'challenge', role: 'LANDLORD' });
  assert.throws(() => transition(s, { type: 'fallback', role: 'RESOLVER', award: '50000000', reason }));
  assert.throws(() => transition(s, { type: 'fallback', role: 'FALLBACK', award: '200010000', reason }));
  assert.equal(transition(s, { type: 'fallback', role: 'FALLBACK', award: '50000000', reason }).allocation.tenantCredit, '850000000');
});
test('fixed timeout preserves accepted 100 and returns 200 to tenant', () => {
  let s = transition(createAliceLease(), { type: 'challenge', role: 'TENANT' });
  assert.throws(() => transition(s, { type: 'timeout' }));
  s = transition(s, { type: 'stage', stage: 'timeout' });
  assert.throws(() => transition(s, { type: 'fallback', role: 'FALLBACK', award: '0', reason }));
  s = transition(s, { type: 'timeout' });
  assert.equal(s.allocation.tenantCredit, '900000000');
  assert.equal(s.allocation.landlordCredit, '100000000');
});
test('reject invalid amounts, resolver settlement and premature finalization', () => {
  const s = createAliceLease();
  assert.throws(() => transition(s, { type: 'finalize' }));
  for (const role of ['RESOLVER', 'FALLBACK']) assert.throws(() => transition(s, { type: 'propose', role, tenantShare: '200000000', landlordShare: '0' }));
  for (const tenantShare of ['-1', '1', '200000001', '300000000']) assert.throws(() => transition(s, { type: 'propose', role: 'TENANT', tenantShare, landlordShare: '0' }));
});
