'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { TESTNET_BANNER, formatMockUsd } from '@/lib/money';
import { shortenAddress } from '@/lib/network';
import { useAccount } from '@/features/account/AccountProvider';
import { useLease } from '@/features/leases/LeaseProvider';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TxStatusBar } from '@/components/TxStatus';
import { DemoScenarios } from '@/components/DemoScenarios';
export function Shell({ children, title }: { children: ReactNode; title?: string }) {
  const { session, signOut, switchRole } = useAccount();
  const { lease } = useLease();
  const path = usePathname();
  const params = useParams();
  const invalidRoute = (params.id && params.id !== lease.id) || (params.caseId && params.caseId !== 'claims-1') || (params.token && params.token !== 'alice-invite');
  const base = `/leases/${lease.id}`;
  const links = [
    { href: '/', label: '总览', icon: '◫' }, { href: '/leases', label: '我的租约', icon: '▤' },
    { href: base, label: '租约工作台', icon: '◈' }, { href: `${base}/claims`, label: '扣款与回应', icon: '≡' },
    { href: `${base}/cases/claims-1`, label: '争议处理', icon: '◇' }, { href: `${base}/settlement`, label: '结算与领取', icon: '↗' },
    { href: '/resolver', label: '处理人工作台', icon: '⊞' }, { href: '/login', label: '账户与恢复', icon: '◎' },
  ];
  return <div className="sky"><div className="stage">
    <div className="banner"><span><i className="network-dot" />{TESTNET_BANNER}</span><span className="mock-pill">虚构演示 · 非链上验收</span></div>
    <header className="topbar"><div className="identity"><p className="kicker">YOUR DEPOSIT, IN PERSPECTIVE</p><b>{title ?? '租约工作台'}</b></div><div className="actions account-actions">
      {session && <span className="account-label">{session.role === 'TENANT' ? '租客' : session.role === 'LANDLORD' ? '房东' : session.role === 'FALLBACK' ? '备用 F' : '处理人'} · {shortenAddress(session.address)}</span>}
      {session ? <button className="btn btn-ghost" onClick={signOut}>退出账户 ↗</button> : <Link className="btn btn-primary" href="/login">使用通行密钥继续 ↗</Link>}
    </div></header>
    <div className="split">
      <aside className="app-sidebar">
        <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">↗</span>RentBond<span className="brand-period">.</span></Link>
        <p className="brand-caption">A little more peace of mind.</p>
        <p className="nav-label">工作空间 / WORKSPACE</p>
        <nav className="side-nav" aria-label="主要页面">{links.map(l => <Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined}><span aria-hidden="true">{l.icon}</span>{l.label}</Link>)}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="kicker">当前押金 · MOCKUSD</span><strong>{formatMockUsd(lease.allocation.unallocated)}</strong><span className="help">待分配 · {lease.allocation.unallocated === '0' ? '分配已完成' : '按约定流程处理'}</span><Link href={`${base}/claims`} className="small">查看明细 ↗</Link></div>
          {session && <label className="field role-switch"><span>切换演示身份</span><select aria-label="切换演示身份" value={session.role} onChange={e => switchRole(e.target.value as typeof session.role)}><option value="TENANT">租客 Tenant</option><option value="LANDLORD">房东 Landlord</option><option value="RESOLVER">处理人 Resolver</option><option value="FALLBACK">备用处理人 F</option></select></label>}
          <p className="sidebar-footer">Lock the Deposit.<br />Unlock the Trust.</p>
        </div>
      </aside>
      <main className="app-main">{lease.chainReadFailed && <p className="error" role="alert">状态读取失败（模拟）。保留上次数据，资金操作已禁用。</p>}{invalidRoute ? <section className="glass glass-pad"><h1>未找到此演示记录</h1><p>当前仅提供 Alice 虚构案例。</p><Link className="btn" href="/leases">返回租约列表</Link></section> : children}<DemoScenarios /></main>
    </div>
  </div><ConfirmDialog /><TxStatusBar /></div>;
}
