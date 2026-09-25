import type { AliceLease, Role } from './types';

// Local fixture transitions only. Production permissions and time come from the contract.
export type Action =
  | { type: 'withdraw'; role: Role }
  | { type: 'propose'; role: Role; tenantShare: string; landlordShare: string; validUntil?: number }
  | { type: 'accept'; role: Role; proposalId: number }
  | { type: 'challenge'; role: Role }
  | { type: 'primary'; role: Role; award: string; reason: string; decisions?: AliceLease['decisionVector'] }
  | { type: 'finalize' }
  | { type: 'fallback'; role: Role; award: string; reason: string; decisions?: AliceLease['decisionVector'] }
  | { type: 'timeout' }
  | { type: 'escalate' | 'expire' }
  | { type: 'stage'; stage: AliceLease['demoStage'] };

function requireState(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function amount(value: string) {
  requireState(/^\d+$/.test(value), '金额格式不正确');
  const n = BigInt(value);
  requireState(n % 10000n === 0n, '金额必须以 0.01 MockUSD 为单位');
  return n;
}
export function transition(prev: AliceLease, action: Action, now = Math.floor(Date.now() / 1000)): AliceLease {
  const next = structuredClone(prev);
  const a = next.allocation;
  const u = BigInt(a.unallocated);
  const party = 'role' in action && (action.role === 'TENANT' || action.role === 'LANDLORD');
  const invalidate = () => { next.revision++; next.proposal = undefined; };
  const allocate = (landlord: bigint) => {
    requireState(landlord >= 0n && landlord <= u, '结果超过未分配金额');
    a.landlordCredit = (BigInt(a.landlordCredit) + landlord).toString();
    a.tenantCredit = (BigInt(a.tenantCredit) + u - landlord).toString();
    a.unallocated = '0';
    next.caseOpened = false;
    next.primaryProposed = false;
    next.settlementPhase = 'settled';
    next.statusLabel = '分配完成（模拟）· 等待分别领取';
    invalidate();
  };
  requireState(next.funded, '尚未入金，不能处理押金');
  requireState(!next.chainReadFailed, '状态读取失败，请刷新后再操作');
  requireState(next.demoStage !== 'hard-end' || ['expire', 'withdraw'].includes(action.type), '最迟退出日期已到，只能退出或领取');
  if (action.type === 'withdraw') {
    requireState(party, '仅固定租客或房东可领取');
    const credit = action.role === 'TENANT' ? 'tenantCredit' : 'landlordCredit';
    const withdrawn = action.role === 'TENANT' ? 'tenantWithdrawn' : 'landlordWithdrawn';
    requireState(BigInt(a[credit]) > 0n, '没有可领取余额');
    a[withdrawn] = (BigInt(a[withdrawn]) + BigInt(a[credit])).toString();
    a[credit] = '0';
  } else {
    requireState(u > 0n, '剩余押金已分配，旧操作失效');
    if (action.type === 'stage') {
      requireState(action.stage !== 'fallback' || next.challenged, '须先请求备用处理');
      requireState(action.stage !== 'timeout' || next.challenged, '此演示须先进入备用处理');
      requireState(action.stage !== 'primary-ready' || !next.challenged, '已挑战的主结果不能恢复');
      requireState(action.stage !== 'primary-ready' || next.primaryProposed, '尚无主结果可成熟');
      requireState(action.stage !== 'primary-timeout' || (next.caseOpened && !next.primaryProposed && !next.challenged), '已有主结果或尚未开案');
      const order = { challenge: 0, 'primary-ready': 1, 'primary-timeout': 1, fallback: 1, timeout: 2, 'hard-end': 3 };
      requireState(order[action.stage] >= order[next.demoStage], '演示阶段不能倒退');
      next.demoStage = action.stage;
      invalidate();
    } else if (action.type === 'propose') {
      requireState(party && next.demoStage !== 'timeout', '仅双方可在退出截止前提出和解');
      requireState(amount(action.tenantShare) + amount(action.landlordShare) === u, '份额之和必须等于当前未分配金额');
      const validUntil = action.validUntil ?? now + 3600;
      requireState(Number.isSafeInteger(validUntil) && validUntil > now, '和解提案有效期必须晚于当前时间');
      next.proposalSequence++;
      next.proposal = { ...action, validUntil, id: next.proposalSequence, proposer: action.role, revision: next.revision };
    } else if (action.type === 'accept') {
      const p = next.proposal;
      requireState(party && !!p && p.proposer !== action.role, '必须由提案的另一方确认');
      requireState(p.id === action.proposalId, '提案已替换，请重新查看并确认金额');
      requireState(now < p.validUntil, '和解提案已到期，不接受迟到确认');
      requireState(p.revision === next.revision && next.demoStage !== 'timeout', '提案已失效，请重新提出');
      requireState(amount(p.tenantShare) + amount(p.landlordShare) === u, '提案金额已过期');
      allocate(amount(p.landlordShare));
      next.primaryEffective = false;
    } else if (action.type === 'escalate') {
      requireState(next.caseOpened && !next.primaryProposed && !next.challenged && next.demoStage === 'primary-timeout', '主处理尚未超时或已有结果');
      next.challenged = true;
      next.demoStage = 'fallback';
      next.statusLabel = '主处理超时，进入备用（模拟）· 期限不因迟调用顺延';
      invalidate();
    } else if (action.type === 'expire') {
      requireState(next.demoStage === 'hard-end', '尚未达到最迟退出日期');
      const maturePrimary = next.primaryProposed && !next.challenged;
      const accepted = !next.claimsWindowClosed ? next.claims.filter(c => c.response === 'Accepted').reduce((sum, c) => sum + amount(c.amountBaseUnits), 0n) : 0n;
      allocate(maturePrimary ? amount(next.primaryAward) : accepted);
      next.primaryEffective = maturePrimary;
      next.claimsWindowClosed = true;
    } else if (action.type === 'challenge') {
      requireState(party && next.primaryProposed && !next.challenged && next.demoStage === 'challenge', '当前不能挑战');
      next.challenged = true;
      next.demoStage = 'fallback';
      next.primaryEffective = false;
      next.statusLabel = '备用处理（模拟）· 原主结果已失效';
      invalidate();
    } else if (action.type === 'primary' || action.type === 'fallback') {
      requireState(action.reason.trim().length >= 20, '请填写至少 20 字的逐项理由');
      const award = amount(action.award);
      requireState(award <= u, '结果超过案件金额');
      const claims = next.claims.filter(c => !['Accepted', 'Withdrawn'].includes(c.response));
      const decisions = action.decisions ?? (claims.length === 1 ? [{ id: claims[0].id, award: action.award, reason: action.reason }] : []);
      requireState(next.caseOpened && decisions.length === claims.length && claims.length > 0, '结果须完整覆盖案件所有未分配项目');
      let total = 0n;
      decisions.forEach((d, i) => {
        requireState(d.id === claims[i].id && amount(d.award) <= BigInt(claims[i].amountBaseUnits), '逐项金额越界或项目顺序不匹配');
        requireState(d.reason.trim().length >= 20 && d.reason.trim().length <= 2000, '每项须附 20—2000 字理由');
        total += amount(d.award);
      });
      requireState(total === award, '逐项结果之和与总额不一致');
      next.decisionVector = decisions;
      if (action.type === 'primary') {
        requireState(next.caseOpened && action.role === 'RESOLVER' && !next.primaryProposed && !next.challenged && next.demoStage === 'challenge', '主结果不能重复或逾期提交');
        next.primaryAward = action.award;
        next.primaryProposed = true;
        next.settlementPhase = 'primary-pending';
        invalidate();
      } else {
        requireState(action.role === 'FALLBACK' && next.challenged && next.demoStage === 'fallback', '当前不是有效备用处理阶段');
        allocate(award);
      }
      next.decisionReason = action.reason;
    } else if (action.type === 'finalize') {
      requireState(next.primaryProposed && !next.challenged && next.demoStage === 'primary-ready', '主结果尚未成熟或已被挑战');
      allocate(amount(next.primaryAward));
      next.primaryEffective = true;
    } else if (action.type === 'timeout') {
      requireState(next.challenged && next.demoStage === 'timeout', '尚未达到固定退出日期');
      allocate(0n);
      next.primaryEffective = false;
    }
  }
  const sum = Object.values(a).reduce((s, v) => s + amount(v), 0n);
  requireState(sum === BigInt(next.depositBaseUnits), '金额守恒检查失败');
  next.allocationMode = a.unallocated === '0' && a.tenantCredit === '0' && a.landlordCredit === '0' ? 'withdrawn' : 'claimable';
  next.nextAction = next.allocationMode === 'withdrawn' ? '全部领取完成' : '查看最新可领取余额与待处理金额';
  return next;
}
