'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useAccount } from '@/features/account/AccountProvider';
import { useLease } from '@/features/leases/LeaseProvider';
import { useTx } from '@/features/tx/TxProvider';
import { parseShareAmount, formatMockUsd } from '@/lib/money';

export default function ResolverPage() {
  const { session } = useAccount();
  const { lease, act } = useLease();
  const { requestTx } = useTx();
  const [reason, setReason] = useState('入住照片已显示该划痕，支持部分清洁以外的损坏主张不超过 50 MockUSD。');
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<number, { award: string; reason: string }>>({});
  const unresolved = lease.claims.filter(c => !['Accepted', 'Withdrawn'].includes(c.response));
  const entry = (id: number) => entries[id] ?? { award: '0', reason: '' };

  if (!session || !lease.caseOpened || !['RESOLVER', 'FALLBACK'].includes(session.role) || (session.role === 'FALLBACK' ? !lease.challenged : lease.challenged)) {
    return (
      <Shell title="处理人工作台">
        <p className="kicker">P11</p>
        <div className="glass glass-pad">
          <p>当前身份不是本案处理人，不能看到未授权租约材料。</p>
          <Link className="btn" href="/login">切换到演示处理人</Link>
        </div>
      </Shell>
    );
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const decisions = unresolved.map(c => {
      const item = entry(c.id);
      const parsed = parseShareAmount(item.award, c.amountBaseUnits);
      return { id: c.id, award: parsed.ok ? parsed.baseUnits : '', reason: item.reason };
    });
    if (decisions.some(d => !d.award || d.reason.trim().length < 20 || d.reason.trim().length > 2000)) {
      setError('请逐项填写不超过申索额的金额及 20—2000 字理由。'); return;
    }
    const total = decisions.reduce((sum, d) => sum + BigInt(d.award), 0n).toString();
    if (!decisions.length) {
      setError('当前没有可处理项目或金额无效');
      return;
    }
    if (reason.trim().length < 20) {
      setError('须附逐项理由（至少 20 字）。');
      return;
    }
    requestTx({
      title: '提交处理结果',
      amountLabel: `给房东 ${formatMockUsd(total)}，其余自动归租客`,
      purpose: session.role === 'FALLBACK' ? '备用最终结果确认后分配金额，仍需双方分别领取。' : '基于案件快照。提出时不转钱。',
      stepLabel: session.role === 'FALLBACK' ? 'resolveFallback（模拟）' : 'proposeDecision（模拟）',
      onConfirm: () => session.role === 'FALLBACK'
        ? act({ type: 'fallback', role: 'FALLBACK', award: total, reason, decisions })
        : act({ type: 'primary', role: 'RESOLVER', award: total, reason, decisions }),
    });
  };

  return (
    <Shell title="处理人工作台">
      <p className="kicker">P11 · 仅分配给我的案件</p>
      <h1 className="headline" style={{ maxWidth: '12ch' }}>逐项审阅</h1>
      <p className="lede">看不到其他租约。备用处理人在未升级前不能读取本案材料（由 D 的 ACL 执行）。</p>
      <article className="glass glass-pad">
        <b>{lease.title}</b>
        <p>未分配 {formatMockUsd(lease.allocation.unallocated)} · 共 {unresolved.length} 项待处理</p>
        <form onSubmit={onSubmit}>
          {unresolved.map(c => <fieldset key={c.id}><legend>{c.categoryLabel} · 上限 {formatMockUsd(c.amountBaseUnits)}</legend>
            <p>{c.reason}</p><p>{c.disputeNote}</p>
            <label className="field"><span>本项给房东的金额（MockUSD）</span><input inputMode="decimal" value={entry(c.id).award} onChange={e => setEntries(prev => ({ ...prev, [c.id]: { ...entry(c.id), award: e.target.value } }))} /></label>
            <label className="field"><span>本项理由与资料引用（20—2000 字）</span><textarea minLength={20} maxLength={2000} value={entry(c.id).reason} onChange={e => setEntries(prev => ({ ...prev, [c.id]: { ...entry(c.id), reason: e.target.value } }))} /></label>
          </fieldset>)}
          <label className="field">
            <span>逐项理由</span>
            <textarea rows={5} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={lease.allocation.unallocated === '0' || (session.role === 'RESOLVER' ? lease.primaryProposed || lease.challenged : lease.demoStage !== 'fallback')}>
            {session.role === 'FALLBACK' ? '提交备用最终结果（模拟）' : '提交一次主结果'}
          </button>
        </form>
      </article>
    </Shell>
  );
}
