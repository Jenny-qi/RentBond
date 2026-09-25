'use client';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useLease } from '@/features/leases/LeaseProvider';
import { useTx } from '@/features/tx/TxProvider';
import { useAccount } from '@/features/account/AccountProvider';
import { formatMockUsd } from '@/lib/money';
export default function CasePage() {
  const { lease, challengePrimary, act } = useLease();
  const { requestTx, phase } = useTx();
  const { session } = useAccount();
  const closed = lease.funded && lease.allocation.unallocated === '0';
  const party = session?.role === 'TENANT' || session?.role === 'LANDLORD';
  const disabled = !session?.networkOk || lease.chainReadFailed || ['awaiting-signature', 'submitted', 'confirming'].includes(phase);
  const title = closed ? '剩余押金已分配' : !lease.caseOpened ? '尚未开启案件' : lease.challenged ? '备用处理与固定退出' : lease.primaryProposed ? '主结果尚未生效' : '等待主处理人提出结果';
  return <Shell title="争议处理">
    <p className="kicker">P10 · CLAIMS · 虚构案例 claims-1</p>
    <h1 className="headline">{title}</h1>
    <p className="lede">结果提出、结果生效、资金领取分别确认。主结果被挑战后不能再次生效。</p>
    <section className="glass glass-pad">
      <span className="pill">{title}</span>
      <p>待分配 {formatMockUsd(lease.allocation.unallocated)}</p>
      {lease.primaryProposed && <p>主结果拟支持房东 {formatMockUsd(lease.primaryAward)}；提出时不转钱。</p>}
      <p>{lease.decisionReason}</p>
      <p className="help">主处理截止 {lease.deadlines.primaryDeadlineUtc} · 备用截止 {lease.deadlines.fallbackDeadlineUtc}</p>
      <p className="help">固定退出 {lease.deadlines.timeoutAtUtc} · 最终退出 {lease.deadlines.hardEndAtUtc}</p>
      <div className="actions">
        <button className="btn" disabled={disabled || !party || !lease.primaryProposed || closed || lease.challenged || lease.demoStage !== 'challenge'} onClick={() => requestTx({ title: '请求备用处理', amountLabel: '不立即改变余额', purpose: '挑战后原主结果失效，进入固定备用期限。', stepLabel: 'challengePrimary（模拟）', onConfirm: challengePrimary })}>请求备用处理</button>
        <button className="btn" disabled={disabled || closed || lease.demoStage !== 'primary-timeout'} onClick={() => requestTx({ title: '主处理超时，升级备用', amountLabel: '现有可领取余额不变', purpose: '备用起点固定为原主处理截止，不从本次调用重新计时。', stepLabel: 'escalateTimeout（模拟）', onConfirm: () => act({ type: 'escalate' }) })}>升级备用处理</button>
        <button className="btn" disabled={disabled || closed || lease.demoStage !== 'hard-end'} onClick={() => requestTx({ title: '按最迟日期结清押金', amountLabel: '先落实有效金额权利，剩余归租客', purpose: '保留已经认可及成熟未挑战的结果；已挑战结果不复活。分配后仍需领取。', stepLabel: 'expireEscrow（模拟）', onConfirm: () => act({ type: 'expire' }) })}>执行最终退出</button>
        <button className="btn btn-primary" disabled={!session || closed || lease.challenged || lease.demoStage !== 'primary-ready'} onClick={() => requestTx({ title: '落实已成熟主结果', amountLabel: `支持房东 ${formatMockUsd(lease.primaryAward)}，其余归租客`, purpose: '无挑战且挑战窗口结束，分配后仍需各自领取。', stepLabel: 'finalizePrimary（模拟）', onConfirm: () => act({ type: 'finalize' }) })}>落实主结果</button>
        <button className="btn" disabled={!session || closed || lease.demoStage !== 'timeout'} onClick={() => requestTx({ title: '按固定期限退出', amountLabel: `${formatMockUsd(lease.allocation.unallocated)} → 租客可领取`, purpose: '主备服务耗尽后，无有效支持的争议款按入金前接受的政策归租客；不反转原有扣款。', stepLabel: 'finalizeTimeout（模拟）', onConfirm: () => act({ type: 'timeout' }) })}>执行超时退出</button>
        <Link className="btn" href="/resolver">查看处理人工作台</Link>
        <Link className="btn" href={`/leases/${lease.id}/settlement`}>查看领取余额</Link>
      </div>
    </section>
    <details className="glass glass-pad" style={{ marginTop: 16 }}>
      <summary>演示附录 · 加载到期场景</summary>
      <p className="help">以下只推进浏览器中的虚构案例，不能修改链上时间。备用场景假定补充材料期已结束；退出场景假定备用期及通知期均已结束。刷新页面重置案例。</p>
      <div className="actions">
        <button className="btn" disabled={disabled || closed || !lease.primaryProposed || lease.challenged || lease.demoStage !== 'challenge'} onClick={() => act({ type: 'stage', stage: 'primary-ready' })}>模拟挑战窗口结束</button>
        <button className="btn" disabled={disabled || closed || !lease.challenged || lease.demoStage !== 'fallback'} onClick={() => act({ type: 'stage', stage: 'timeout' })}>模拟备用超时及退出日到达</button>
        <button className="btn" disabled={disabled || !lease.caseOpened || closed || lease.primaryProposed || lease.challenged || lease.demoStage !== 'challenge'} onClick={() => act({ type: 'stage', stage: 'primary-timeout' })}>模拟主处理超时</button>
        <button className="btn" disabled={disabled || !lease.funded || closed || lease.demoStage === 'hard-end'} onClick={() => act({ type: 'stage', stage: 'hard-end' })}>模拟 hardEndAt 到达</button>
      </div>
    </details>
  </Shell>;
}
