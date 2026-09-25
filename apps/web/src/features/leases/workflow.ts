import type { AliceLease, ClaimDraftItem, Role } from './types';

// This is an in-memory fixture, never an authority for real chain state or ACL.
export type WorkflowAction =
  | { type: 'accept-terms' | 'approve' | 'revoke' | 'fund' | 'cancel'; role: Role }
  | { type: 'submit-claims'; role: Role; claims: ClaimDraftItem[] }
  | { type: 'respond'; role: Role; id: number; accept: boolean; note?: string }
  | { type: 'waive'; role: Role; id: number }
  | { type: 'close-claims' | 'open-case' }
  | { type: 'advance'; to: 'claims' | 'claim-deadline' | 'response-deadline' };

function check(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function workflowTransition(previous: AliceLease, action: WorkflowAction): AliceLease {
  const s = structuredClone(previous);
  const a = s.allocation;
  const party = 'role' in action && ['TENANT', 'LANDLORD'].includes(action.role);
  check(!s.cancelled || action.type === 'revoke', '约定已取消，不能继续操作');
  check(!s.chainReadFailed, '状态读取失败，请刷新后重新确认');
  check(s.demoStage !== 'hard-end', '最迟退出日期已到，只能退出或领取');
  if (['accept-terms', 'approve', 'revoke', 'fund', 'cancel'].includes(action.type)) {
    check(!s.funded && s.workflow === 'unfunded', '只能操作尚未入金的约定');
    check('role' in action && (action.type === 'cancel' ? party : action.role === 'TENANT'), '当前身份无权操作');
    if (action.type === 'accept-terms') {
      check(!s.tenantAccepted, '已经确认过条款');
      s.tenantAccepted = true;
    } else if (action.type === 'approve') {
      check(s.tenantAccepted && !s.approvedNotFunded, '请先确认条款，不能重复授权');
      s.approvedNotFunded = true;
    } else if (action.type === 'revoke') {
      check(s.approvedNotFunded, '没有待撤销的授权');
      s.approvedNotFunded = false;
    } else if (action.type === 'cancel') {
      s.cancelled = true;
    } else if (action.type === 'fund') {
      check(s.tenantAccepted && s.approvedNotFunded, '请先确认条款并精确授权');
      s.funded = true;
      s.approvedNotFunded = false;
      a.unallocated = s.depositBaseUnits;
      s.workflow = 'active';
    }
    s.statusLabel = s.cancelled ? '约定已取消（模拟）' : s.funded ? '租期内（模拟）' : s.approvedNotFunded ? '已授权，未存入（模拟）' : s.tenantAccepted ? '条款已确认，未存入（模拟）' : '等待条款确认（模拟）';
  } else {
    check(s.funded && BigInt(a.unallocated) > 0n, '尚未入金或已分配完成');
    if (action.type === 'advance') {
      const from = { claims: 'active', 'claim-deadline': 'claims', 'response-deadline': 'claim-deadline' };
      check(s.workflow === from[action.to], '只能按顺序加载下一演示时点');
      if (action.to === 'response-deadline') check(s.claimsWindowClosed, '请先执行申索窗口关闭');
      s.workflow = action.to;
      s.statusLabel = { claims: '申索窗口开放（模拟）', 'claim-deadline': '申索已截止，等待分配（模拟）', 'response-deadline': '回应已截止，等待开案（模拟）' }[action.to];
    } else if (action.type === 'submit-claims') {
      check(action.role === 'LANDLORD' && s.workflow === 'claims' && !s.claimsSubmitted, '仅房东可在申索窗口一次提交清单');
      check(action.claims.length >= 1 && action.claims.length <= 10, '清单须有 1—10 项');
      let total = 0n;
      s.claims = action.claims.map((c, id) => {
        check(/^\d+$/.test(c.amountBaseUnits), '金额格式不正确');
        const value = BigInt(c.amountBaseUnits);
        check(value > 0n && value % 10000n === 0n, '申索金额须为正数且以 0.01 MockUSD 为单位');
        check(['cleaning', 'damage', 'desk_damage', 'unpaid', 'other'].includes(c.category), '请选择有效扣款类别');
        check(c.reason.trim().length >= 20 && c.reason.trim().length <= 2000, '每项理由须为 20—2000 字');
        check(!!c.clauseRef.trim() && !!c.evidenceNote.trim(), '须填写条款引用及证据或无证据说明');
        total += value;
        return { ...c, id, response: 'Pending', disputeNote: undefined };
      });
      check(total <= BigInt(s.depositBaseUnits), '申索总額不能超过押金');
      s.claimsSubmitted = true;
    } else if (action.type === 'respond' || action.type === 'waive') {
      check(s.claimsSubmitted && !s.caseOpened && ['claims', 'claim-deadline'].includes(s.workflow), '回应已截止或案件已开启');
      const c = s.claims.find(item => item.id === action.id);
      check(!!c && c.response !== 'Withdrawn' && !(s.claimsWindowClosed && c.response === 'Accepted'), '该项目已撤回或已分配');
      if (action.type === 'respond') {
        check(action.role === 'TENANT' && c.response !== 'Accepted', '仅租客可回应，认可不可撤销');
        check(action.accept || !!action.note?.trim(), '请填写异议理由');
        c.response = action.accept ? 'Accepted' : 'Disputed';
        c.disputeNote = action.accept ? undefined : action.note;
      } else {
        check(action.role === 'LANDLORD', '仅房东可撤回');
        c.response = 'Withdrawn';
      }
      if (s.claimsWindowClosed && (c.response === 'Accepted' || c.response === 'Withdrawn')) {
        const recipient = c.response === 'Accepted' ? 'landlordCredit' : 'tenantCredit';
        a[recipient] = (BigInt(a[recipient]) + BigInt(c.amountBaseUnits)).toString();
        a.unallocated = (BigInt(a.unallocated) - BigInt(c.amountBaseUnits)).toString();
      }
    } else if (action.type === 'close-claims') {
      check(s.workflow === 'claim-deadline' && !s.claimsWindowClosed, '申索尚未截止或已经关闭');
      let locked = 0n, landlord = 0n;
      for (const c of s.claims) {
        if (c.response === 'Accepted') landlord += BigInt(c.amountBaseUnits);
        else if (c.response !== 'Withdrawn') locked += BigInt(c.amountBaseUnits);
      }
      a.tenantCredit = (BigInt(s.depositBaseUnits) - locked - landlord).toString();
      a.landlordCredit = landlord.toString();
      a.unallocated = locked.toString();
      s.claimsWindowClosed = true;
      s.statusLabel = '申索窗口已关闭（模拟）· 无争议部分可领取';
    } else if (action.type === 'open-case') {
      check(s.workflow === 'response-deadline' && s.claimsWindowClosed && !s.caseOpened, '尚不能开案');
      s.workflow = 'case';
      s.caseOpened = true;
      s.statusLabel = 'CLAIMS 案件（模拟）· 等待逐项处理';
    }
  }
  s.revision++;
  s.proposal = undefined;
  const sum = Object.values(a).reduce((sum, value) => sum + BigInt(value), 0n);
  check(Object.values(a).every(value => BigInt(value) >= 0n) && sum === (s.funded ? BigInt(s.depositBaseUnits) : 0n), '金额守恒检查失败');
  s.allocationMode = s.claimsWindowClosed ? 'claimable' : 'projected';
  s.nextAction = s.funded ? '查看当前阶段、期限及可领取余额' : '确认条款，再授权并存入';
  s.deadlines.countdownHint = `${s.statusLabel}。日期为固定虚构参考，需显式加载演示阶段，不是实际链上截止判断`;
  return s;
}
