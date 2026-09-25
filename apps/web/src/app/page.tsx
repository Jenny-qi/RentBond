'use client';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { DeadlineStrip } from '@/components/DeadlineStrip';
import { AllocationBar } from '@/components/AmountSplit';
import { useLease } from '@/features/leases/LeaseProvider';
import { formatMockUsdPlain } from '@/lib/money';
export default function HomePage() {
  const { lease } = useLease();
  const base = `/leases/${lease.id}`;
  const metrics = [
    { label: '租客可领取', value: lease.allocation.tenantCredit, note: '无争议部分，无需等待整个案件', tone: 'rose', icon: '↗' },
    { label: '房东可领取', value: lease.allocation.landlordCredit, note: '已认可扣款，按约定分配', tone: 'cream', icon: '↗' },
    { label: '待分配金额', value: lease.allocation.unallocated, note: '争议部分，进入有期限的处理', tone: 'silver', icon: '◷' },
  ];
  return <Shell title="总览 Overview">
    <section className="home-hero">
      <div className="hero-copy"><p className="eyebrow"><span /> BUILT FOR A WORLD WITHOUT BORDERS</p>
        <h1 aria-label="RentBond — Lock the Deposit. Unlock the Trust."><span className="hero-product">RentBond —</span>Lock the Deposit.<br /><em>Unlock the Trust.</em></h1>
        <p className="hero-description">让争议有期限，让押金有归处。<br />为跨境租房的你，把每一项扣款与每一笔余额说清楚。</p>
        <div className="actions"><Link className="btn btn-primary" href={base}>查看我的押金 <span>↗</span></Link><Link className="btn btn-ghost" href="/leases/new">创建租约 ＋</Link></div>
      </div>
      <section className="deposit-card" aria-label="演示押金总览"><div className="row"><span className="kicker">ALICE'S DEPOSIT</span><span className="pill">虚构案例</span></div><p className="deposit-location">Brooklyn, New York <span>↗</span></p><p className="deposit-amount">{formatMockUsdPlain(lease.depositBaseUnits)}<span>MockUSD</span></p><p className="deposit-caption">一笔押金。每一部分，都有去向。</p><AllocationBar allocation={lease.allocation} deposit={lease.depositBaseUnits} /><div className="deposit-foot"><span>测试资产 · 无现金价值</span><Link href={`${base}/settlement`}>查看资金明细 ↗</Link></div></section>
    </section>
    <section className="overview-section" aria-label="当前资金状态"><div className="section-heading"><h2>押金，一目了然<span>THE BREAKDOWN</span></h2><Link className="small" href={`${base}/settlement`}>结算与领取 ↗</Link></div>
      <div className="metric-grid">{metrics.map(m => <article className={`metric-card ${m.tone}`} key={m.label}><div className="row"><span>{m.label}</span><span className="metric-icon">{m.icon}</span></div><p className="metric-amount">{formatMockUsdPlain(m.value)}<span>MockUSD</span></p><p className="help">{m.note}</p></article>)}</div>
      <p className="accounting-note">申索窗口关闭并确认分配后才可领取；领取交易确认后才计入已领取。累计已领：租客 {formatMockUsdPlain(lease.allocation.tenantWithdrawn)} / 房东 {formatMockUsdPlain(lease.allocation.landlordWithdrawn)} MockUSD。</p>
    </section>
    <div className="home-bottom"><section className="glass glass-pad deadlines-panel"><div className="section-heading"><h2>每一步，都有期限</h2><span className="pill">演示时间线</span></div><DeadlineStrip deadlines={lease.deadlines} /></section><section className="glass glass-pad next-step"><p className="kicker">A CLEARER WAY FORWARD</p><h2>只争议 200，<br />不锁住全部 1,000。</h2><p className="help">入金前双方接受规则；房东逐项申索，租客逐项回应。未回应不视为同意。</p><Link className="text-link" href={`${base}/claims`}>查看 Alice 的扣款案例 ↗</Link></section></div>
    <footer className="home-footer"><span>RentBond — Lock the Deposit. Unlock the Trust.</span><span>MONAD TESTNET · CONSUMER PRODUCTS & PAYMENTS</span></footer>
  </Shell>;
}
