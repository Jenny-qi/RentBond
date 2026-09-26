'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useAccount } from '@/features/account/AccountProvider';
import { useLease } from '@/features/leases/LeaseProvider';
import { formatMockUsd } from '@/lib/money';

export default function LeasesPage() {
  const { session } = useAccount();
  const { lease } = useLease();

  return (
    <Shell title="我的租约">
      <p className="kicker">P03 租约列表</p>
      <h1 className="headline" style={{ maxWidth: '12ch' }}>待处理动作</h1>
      {!session ? (
        <div className="glass glass-pad">
          <p>没有已验证会话。空状态：先进入账户，再查看与你地址相关的私有租约。</p>
          <Link className="btn btn-primary" href="/login">使用通行密钥继续</Link>
        </div>
      ) : (
        <article className="glass glass-pad">
          <div className="row">
            <div>
              <b>{lease.title}</b>
              <p className="muted small">{lease.statusLabel}</p>
            </div>
            <span className="pill">仅当前身份可见</span>
          </div>
          <p>租客可领 {formatMockUsd(lease.allocation.tenantCredit)} · 房东可领 {formatMockUsd(lease.allocation.landlordCredit)} · 未分配 {formatMockUsd(lease.allocation.unallocated)}</p>
          <p className="help">下一步（{lease.nextActor}）：{lease.nextAction}</p>
          <div className="actions">
            <Link className="btn btn-primary" href={`/leases/${lease.id}`}>打开工作台</Link>
            <Link className="btn" href={`/leases/${lease.id}/claims`}>扣款清单</Link>
            <Link className="btn" href="/leases/new">创建新草稿</Link>
          </div>
        </article>
      )}
    </Shell>
  );
}
