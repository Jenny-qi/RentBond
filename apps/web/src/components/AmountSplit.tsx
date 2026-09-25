import { formatMockUsd, formatMockUsdPlain } from '@/lib/money';
import type { Allocation, AllocationMode } from '@/features/leases/types';

export function AmountSplit({
  deposit,
  allocation,
  mode,
}: {
  deposit: string;
  allocation: Allocation;
  mode: AllocationMode;
}) {
  const modeLabel =
    mode === 'projected' ? '预计拆分（申索窗口关闭前不会分配）'
      : mode === 'claimable' ? '可领取（分配已确认，领取交易尚未确认）'
        : '已领取（领取交易确认后）';

  return (
    <section className="glass glass-pad" aria-label="资金拆分">
      <p className="kicker">{modeLabel}</p>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="h-temp">{formatMockUsdPlain(deposit)}</div>
          <p className="help">MockUSD · 测试押金，无现金价值</p>
        </div>
        <div className="hl">
          <span>租客可领 <b>{formatMockUsd(allocation.tenantCredit)}</b></span>
          <span>房东可领 <b>{formatMockUsd(allocation.landlordCredit)}</b></span>
          <span>未分配 U <b>{formatMockUsd(allocation.unallocated)}</b></span>
        </div>
      </div>
      <div className="grid-3" style={{ marginTop: 18 }}>
        <Stat label="未分配 / 争议锁定" value={formatMockUsd(allocation.unallocated)} hint="claimDeadline 前不会把这部分提前分走" />
        <Stat label="租客累计已领" value={formatMockUsd(allocation.tenantWithdrawn)} hint="确认领取后才计入" />
        <Stat label="房东累计已领" value={formatMockUsd(allocation.landlordWithdrawn)} hint="不从合约代币余额倒推押金" />
      </div>
      <AllocationBar allocation={allocation} deposit={deposit} />
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="kicker">{label}</p>
      <p style={{ fontSize: 22, margin: '6px 0' }}>{value}</p>
      <p className="help">{hint}</p>
    </div>
  );
}

export function AllocationBar({ allocation, deposit }: { allocation: Allocation; deposit: string }) {
  const d = Number(deposit);
  const pct = (v: string) => `${(Number(v) / d) * 100}%`;
  return (
    <div style={{ marginTop: 16 }} aria-hidden="true">
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
        <i style={{ width: pct(allocation.tenantCredit), background: '#e4c2ce', display: 'block' }} />
        <i style={{ width: pct(allocation.landlordCredit), background: '#ebd8a7', display: 'block' }} />
        <i style={{ width: pct(allocation.unallocated), background: '#d0ceda', display: 'block' }} />
        <i style={{ width: pct(allocation.tenantWithdrawn), background: '#ac8d9c', display: 'block' }} />
        <i style={{ width: pct(allocation.landlordWithdrawn), background: '#b5a27c', display: 'block' }} />
      </div>
      <p className="help" style={{ marginTop: 8 }}>
        柔粉：租客可领 · 淡黄：房东可领 · 灰白：待分配 · 深色：已领取。分配不等于领取。
      </p>
    </div>
  );
}

