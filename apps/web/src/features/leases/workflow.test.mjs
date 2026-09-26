import test from 'node:test';
import assert from 'node:assert/strict';
import { createAliceLease, createUnfundedLease } from './types.ts';
import { workflowTransition as w } from './workflow.ts';
import { transition as t } from './model.ts';
const reason = '虚构逐项理由：对照入住与退租照片，支持部分金额，其余归租客。';
const claims = createAliceLease().claims;
function funded() {
  let s = createUnfundedLease();
  for (const type of ['accept-terms', 'approve', 'fund']) s = w(s, { type, role: 'TENANT' });
  return w(s, { type: 'advance', to: 'claims' });
}
function submitted() { return w(funded(), { type: 'submit-claims', role: 'LANDLORD', claims }); }
test('acceptance, exact approval and funding are distinct; revoke and cancellation prevent funding', () => {
  let s = createUnfundedLease();
  assert.throws(() => w(s, { type: 'fund', role: 'TENANT' }));
  assert.throws(() => w(s, { type: 'accept-terms', role: 'LANDLORD' }));
  s = w(s, { type: 'accept-terms', role: 'TENANT' });
  s = w(s, { type: 'approve', role: 'TENANT' });
  assert.equal(s.funded, false); assert.equal(s.allocation.unallocated, '0');
  s = w(s, { type: 'revoke', role: 'TENANT' });
  assert.throws(() => w(s, { type: 'fund', role: 'TENANT' }));
  s = w(s, { type: 'cancel', role: 'LANDLORD' });
  assert.throws(() => w(s, { type: 'approve', role: 'TENANT' }));
  assert.throws(() => w(funded(), { type: 'fund', role: 'TENANT' }));
});
test('accept before deadline never releases D-C; closing produces exact 700/100/200 once', () => {
  let s = submitted();
  assert.throws(() => w(s, { type: 'close-claims' }));
  s = w(s, { type: 'respond', role: 'TENANT', id: 0, accept: true });
  s = w(s, { type: 'respond', role: 'TENANT', id: 1, accept: false, note: '入住已有划痕' });
  assert.equal(s.allocation.unallocated, '1000000000');
  assert.equal(s.allocation.landlordCredit, '0');
  s = w(s, { type: 'advance', to: 'claim-deadline' });
  assert.throws(() => w(s, { type: 'submit-claims', role: 'LANDLORD', claims }));
  s = w(s, { type: 'close-claims' });
  assert.deepEqual(s.allocation, createAliceLease().allocation);
  assert.throws(() => w(s, { type: 'close-claims' }));
  s = w(s, { type: 'advance', to: 'response-deadline' });
  assert.throws(() => w(s, { type: 'respond', role: 'TENANT', id: 1, accept: true }));
  s = w(s, { type: 'open-case' });
  assert.throws(() => w(s, { type: 'waive', role: 'LANDLORD', id: 1 }));
  s = t(s, { type: 'primary', role: 'RESOLVER', award: '50000000', reason });
  s = t(s, { type: 'stage', stage: 'primary-ready' });
  s = t(s, { type: 'finalize' });
  s = t(s, { type: 'withdraw', role: 'TENANT' });
  s = t(s, { type: 'withdraw', role: 'LANDLORD' });
  assert.equal(s.allocation.tenantWithdrawn, '850000000');
  assert.equal(s.allocation.landlordWithdrawn, '150000000');
});
test('claims validate count, positive cent amounts, total, reason, role and one-time submission', () => {
  const s = funded();
  for (const invalid of [[], Array(11).fill(claims[0]), [{ ...claims[0], amountBaseUnits: '0' }], [{ ...claims[0], amountBaseUnits: '1' }], [{ ...claims[0], amountBaseUnits: '1000010000' }], [{ ...claims[0], reason: '短' }]]) {
    assert.throws(() => w(s, { type: 'submit-claims', role: 'LANDLORD', claims: invalid }));
  }
  assert.throws(() => w(s, { type: 'submit-claims', role: 'TENANT', claims }));
  assert.throws(() => w(submitted(), { type: 'submit-claims', role: 'LANDLORD', claims }));
});
test('no claims, all accepted, all waived, and late acceptance allocate correctly', () => {
  let s = w(funded(), { type: 'advance', to: 'claim-deadline' });
  s = w(s, { type: 'close-claims' });
  assert.equal(s.allocation.tenantCredit, '1000000000');
  for (const waive of [false, true]) {
    s = submitted();
    for (const c of claims) s = w(s, waive ? { type: 'waive', role: 'LANDLORD', id: c.id } : { type: 'respond', role: 'TENANT', id: c.id, accept: true });
    s = w(s, { type: 'advance', to: 'claim-deadline' }); s = w(s, { type: 'close-claims' });
    assert.equal(s.allocation.landlordCredit, waive ? '0' : '300000000');
    assert.equal(s.allocation.unallocated, '0');
  }
  s = w(submitted(), { type: 'advance', to: 'claim-deadline' }); s = w(s, { type: 'close-claims' });
  s = w(s, { type: 'respond', role: 'TENANT', id: 0, accept: true });
  s = w(s, { type: 'waive', role: 'LANDLORD', id: 1 });
  assert.equal(s.allocation.tenantCredit, '900000000');
  assert.equal(s.allocation.landlordCredit, '100000000');
});
test('old settlement ID cannot accept replacement at same revision', () => {
  let s = t(createAliceLease(), { type: 'propose', role: 'TENANT', tenantShare: '200000000', landlordShare: '0' });
  const id = s.proposal.id;
  s = t(s, { type: 'propose', role: 'TENANT', tenantShare: '0', landlordShare: '200000000' });
  assert.throws(() => t(s, { type: 'accept', role: 'LANDLORD', proposalId: id }));
  assert.equal(t(s, { type: 'accept', role: 'LANDLORD', proposalId: s.proposal.id }).allocation.landlordCredit, '300000000');
});
test('multi-item decisions reject omitted, duplicate, reordered and individually excessive awards', () => {
  let s = w(submitted(), { type: 'advance', to: 'claim-deadline' });
  s = w(s, { type: 'close-claims' }); s = w(s, { type: 'advance', to: 'response-deadline' }); s = w(s, { type: 'open-case' });
  const decisions = [{ id: 0, award: '50000000', reason }, { id: 1, award: '100000000', reason }];
  for (const bad of [decisions.slice(0, 1), [decisions[0], decisions[0]], [...decisions].reverse(), [{ ...decisions[0], award: '150000000' }, { ...decisions[1], award: '0' }]]) {
    assert.throws(() => t(s, { type: 'primary', role: 'RESOLVER', award: '150000000', reason, decisions: bad }));
  }
  s = t(s, { type: 'primary', role: 'RESOLVER', award: '150000000', reason, decisions });
  assert.equal(s.allocation.unallocated, '300000000');
  assert.equal(s.primaryAward, '150000000');
});
test('read failure leaves last snapshot unchanged and blocks funding and claims', () => {
  const s = { ...submitted(), chainReadFailed: true };
  const before = structuredClone(s);
  assert.throws(() => w(s, { type: 'respond', role: 'TENANT', id: 0, accept: true }));
  assert.deepEqual(s, before);
});
test('cancelling agreement does not strand an unused allowance', () => {
  let s = createUnfundedLease();
  for (const type of ['accept-terms', 'approve', 'cancel']) s = w(s, { type, role: 'TENANT' });
  assert.equal(s.approvedNotFunded, true);
  s = w(s, { type: 'revoke', role: 'TENANT' });
  assert.equal(s.approvedNotFunded, false);
  assert.equal(s.cancelled, true);
  assert.throws(() => w(s, { type: 'fund', role: 'TENANT' }));
});
test('settlement expiry uses strict deadline and exact proposal ID', () => {
  const s = t(createAliceLease(), { type: 'propose', role: 'TENANT', tenantShare: '200000000', landlordShare: '0', validUntil: 110 }, 100);
  assert.equal(t(s, { type: 'accept', role: 'LANDLORD', proposalId: s.proposal.id }, 109).allocation.unallocated, '0');
  assert.throws(() => t(s, { type: 'accept', role: 'LANDLORD', proposalId: s.proposal.id }, 110));
});
test('primary inactivity escalates without allocating or shifting the fixed deadline', () => {
  let s = { ...createAliceLease(), primaryProposed: false };
  const deadline = s.deadlines.fallbackDeadlineUtc;
  assert.throws(() => t(s, { type: 'escalate' }));
  s = t(s, { type: 'stage', stage: 'primary-timeout' });
  s = t(s, { type: 'escalate' });
  assert.equal(s.deadlines.fallbackDeadlineUtc, deadline);
  assert.deepEqual(s.allocation, createAliceLease().allocation);
  assert.throws(() => t(s, { type: 'primary', role: 'RESOLVER', award: '50000000', reason }));
});
test('hard end preserves accepted and mature primary rights, never revives challenged result', () => {
  let s = t(createAliceLease(), { type: 'stage', stage: 'hard-end' });
  s = t(s, { type: 'expire' });
  assert.equal(s.allocation.landlordCredit, '150000000');
  assert.equal(s.allocation.tenantCredit, '850000000');
  assert.throws(() => t(s, { type: 'expire' }));
  s = t(createAliceLease(), { type: 'challenge', role: 'TENANT' });
  s = t(s, { type: 'stage', stage: 'hard-end' });
  assert.throws(() => t(s, { type: 'propose', role: 'TENANT', tenantShare: '200000000', landlordShare: '0' }));
  s = t(s, { type: 'expire' });
  assert.equal(s.allocation.landlordCredit, '100000000');
  assert.equal(s.allocation.tenantCredit, '900000000');
  s = w(submitted(), { type: 'respond', role: 'TENANT', id: 0, accept: true });
  s = t(s, { type: 'stage', stage: 'hard-end' });
  s = t(s, { type: 'expire' });
  assert.equal(s.allocation.landlordCredit, '100000000');
  assert.equal(s.allocation.tenantCredit, '900000000');
});
