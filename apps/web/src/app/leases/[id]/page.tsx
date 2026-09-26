'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { AmountSplit } from '@/components/AmountSplit';
import { DeadlineStrip } from '@/components/DeadlineStrip';
import { EvidenceTagChip } from '@/components/EvidenceTag';
import { useLease } from '@/features/leases/LeaseProvider';
import { useAccount } from '@/features/account/AccountProvider';
import { formatMockUsd } from '@/lib/money';

export default function LeaseWorkbenchPage() {
  const { lease } = useLease();
  const { session } = useAccount();
  const credit = session?.role === 'LANDLORD' ? lease.allocation.landlordCredit : lease.allocation.tenantCredit;

  return (
    <Shell>
      <p className="kicker">P07 工作台 · {lease.statusLabel}</p>
      <div className="row">
        <h1 className="headline">押金进度与下一步</h1>
        <p className="lede">这笔钱在哪里：{formatMockUsd(lease.allocation.unallocated)} 仍锁定。谁需要做什么：{lease.nextAction}。截止何时见时间线。</p>
      </div>
      <AmountSplit deposit={lease.depositBaseUnits} allocation={lease.allocation} mode={lease.allocationMode} />
      {!lease.funded && <p className="help">上方为约定押金，实际已入金 0 MockUSD；尚无可分配或可领取资金。</p>}
      <p className="help">同步于 {lease.lastSyncedAt}。链上读取失败时将保留上次成功状态并禁用确认按钮。</p>
      <DeadlineStrip deadlines={lease.deadlines} />

      <section className="glass glass-pad" style={{ marginTop: 16 }}>
        <p className="kicker">入住 / 维修 / 退租资料</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {lease.evidence.map((ev) => (
            <li key={ev.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <b>{ev.title}</b>
                <p className="help">拍摄 {ev.capturedAtLabel} · 提交 {ev.submittedAtLabel} · v{ev.version} · {ev.stage}</p>
              </div>
              <EvidenceTagChip tag={ev.tag} />
            </li>
          ))}
        </ul>
        <p className="help">哈希只能检查提交后是否被改，不能证明照片真实。EXIF 不是事实证明。</p>
      </section>

      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="btn btn-primary" href={`/leases/${lease.id}/claims`}>逐项回应扣款</Link>
        <Link className="btn" href={`/leases/${lease.id}/settlement`}>领取 {formatMockUsd(credit)}</Link>
        <Link className="btn" href={`/leases/${lease.id}/checkout`}>交接</Link>
        <Link className="btn" href={`/leases/${lease.id}/fund`}>入金进度</Link>
      </div>
    </Shell>
  );
}
