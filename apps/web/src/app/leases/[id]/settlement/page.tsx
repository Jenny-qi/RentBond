'use client';

import { useState } from 'react';
import { Shell } from '@/components/Shell';
import { AmountSplit } from '@/components/AmountSplit';
import { useLease } from '@/features/leases/LeaseProvider';
import { useTx } from '@/features/tx/TxProvider';
import { useAccount } from '@/features/account/AccountProvider';
import { formatMockUsd, parseShareAmount } from '@/lib/money';

export default function SettlementPage() {
  const { lease, withdrawTenant, withdrawLandlord, acceptSettlement, act } = useLease();
  const { requestTx } = useTx();
  const { session } = useAccount();
  const [tenantShare, setTenantShare] = useState('200');
  const [landlordShare, setLandlordShare] = useState('0');
  const [exportHint, setExportHint] = useState<string | null>(null);
  const [validMinutes, setValidMinutes] = useState('60');
  const expiryValid = /^\d+$/.test(validMinutes) && Number(validMinutes) >= 1 && Number(validMinutes) <= 1440;

  const tenantParsed = parseShareAmount(tenantShare, lease.allocation.unallocated);
  const landlordParsed = parseShareAmount(landlordShare, lease.allocation.unallocated);
  const uOk =
    tenantParsed.ok &&
    landlordParsed.ok &&
    BigInt(tenantParsed.baseUnits) + BigInt(landlordParsed.baseUnits) === BigInt(lease.allocation.unallocated);

  return (
    <Shell title="结算与领取">
      <p className="kicker">P12 · 预计 / 可领 / 已领 不可混淆</p>
      <h1 className="headline" style={{ maxWidth: '14ch' }}>领取到本账户</h1>
      <AmountSplit deposit={lease.depositBaseUnits} allocation={lease.allocation} mode={lease.allocationMode} />
      <p className="help">
        {!lease.funded ? '尚未入金。' : lease.allocation.unallocated === '0' ? '分配完成。' : '仍有未分配资金。'}
        {lease.funded && lease.allocation.unallocated === '0'
          && lease.allocation.tenantCredit === '0'
          && lease.allocation.landlordCredit === '0'
          ? ' 全部领取完成。'
          : ''}
        租客先领取不阻止房东以后领取。
      </p>

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!session || session.role !== 'TENANT' || lease.allocation.tenantCredit === '0' || !session.networkOk}
          onClick={() =>
            requestTx({
              title: `领取 ${formatMockUsd(lease.allocation.tenantCredit)}`,
              amountLabel: `${formatMockUsd(lease.allocation.tenantCredit)} → 本账户`,
              purpose: '测试币进入用户账户，不是银行到账。领取交易确认后才显示已领取。',
              stepLabel: 'withdraw（模拟）',
              onConfirm: withdrawTenant,
            })
          }
        >
          领取 {formatMockUsd(lease.allocation.tenantCredit)}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!session || session.role !== 'LANDLORD' || lease.allocation.landlordCredit === '0' || !session.networkOk}
          onClick={() =>
            requestTx({
              title: `领取 ${formatMockUsd(lease.allocation.landlordCredit)}`,
              amountLabel: `${formatMockUsd(lease.allocation.landlordCredit)} → 本账户`,
              purpose: '受益人地址固定，调用者不能改收款人。',
              stepLabel: 'withdraw（模拟）',
              onConfirm: withdrawLandlord,
            })
          }
        >
          房东领取 {formatMockUsd(lease.allocation.landlordCredit)}
        </button>
      </div>

      <section className="glass glass-pad" style={{ marginTop: 16 }}>
        <p className="kicker">共同和解剩余未分配</p>
        <p>该操作结清本工具中的剩余押金；不自动证明租赁关系结束，也不自动放弃合同以外的法律权利。查看材料不是接受和解。</p>
        <div className="grid-2">
          <label className="field">
            <span>租客份额（MockUSD，最多两位小数）</span>
            <input value={tenantShare} onChange={(e) => setTenantShare(e.target.value)} />
          </label>
          <label className="field">
            <span>房东份额</span>
            <input value={landlordShare} onChange={(e) => setLandlordShare(e.target.value)} />
          </label>
        </div>
        <label className="field"><span>提案有效分钟数（本地模拟：1—1440，退出阶段到达仍提前失效）</span><input inputMode="numeric" value={validMinutes} onChange={e => setValidMinutes(e.target.value)} /></label>
        {!uOk && lease.allocation.unallocated !== '0' && <p className="error">之和必须等于当前 U {formatMockUsd(lease.allocation.unallocated)}。金额变更会使旧提案失效。</p>}
        <button
          type="button"
          className="btn"
          disabled={!session || !['TENANT', 'LANDLORD'].includes(session.role) || !uOk || !expiryValid || lease.allocation.unallocated === '0' || ['timeout', 'hard-end'].includes(lease.demoStage)}
          onClick={() =>
            requestTx({
              title: '提出共同和解',
              amountLabel: `租客 ${tenantShare} / 房东 ${landlordShare} MockUSD`,
              purpose: '只结算当前未分配。已领取的 700/100 不进入新提案。',
              stepLabel: 'proposeSettlement（模拟）',
              onConfirm: () => {
                if (session && tenantParsed.ok && landlordParsed.ok) act({ type: 'propose', role: session.role, tenantShare: tenantParsed.baseUnits, landlordShare: landlordParsed.baseUnits, validUntil: Math.floor(Date.now() / 1000) + Number(validMinutes) * 60 });
              },
            })
          }
        >
          提出和解，等待另一方确认
        </button>
        {lease.proposal && <div className="glass glass-pad" style={{ marginTop: 16 }}>
          <p>已固定提案 · revision {lease.proposal.revision} · 退出截止或阶段变更后失效</p>
          <p>有效至 {new Date(lease.proposal.validUntil * 1000).toISOString()}（UTC）</p>
          <p>租客 {formatMockUsd(lease.proposal.tenantShare)} / 房东 {formatMockUsd(lease.proposal.landlordShare)}</p>
          <p className="help">提出方：{lease.proposal.proposer}。修改上方输入不会修改已提出的金额。</p>
          <button className="btn btn-primary" disabled={!session || !['TENANT', 'LANDLORD'].includes(session.role) || session.role === lease.proposal.proposer || lease.demoStage === 'timeout'} onClick={() => requestTx({
            title: '确认同一和解提案', amountLabel: `租客 ${formatMockUsd(lease.proposal!.tenantShare)} / 房东 ${formatMockUsd(lease.proposal!.landlordShare)}`,
            purpose: '确认后结清剩余押金，旧案件结果失效。', stepLabel: 'confirmSettlement（模拟）', onConfirm: () => acceptSettlement(lease.proposal!.id),
          })}>由另一方确认提案</button>
        </div>}
      </section>

      <section className="glass glass-pad" style={{ marginTop: 16 }}>
        <p className="kicker">导出入口</p>
        <p className="help">导出接口尚未接入，当前不会提交任务或生成文件。完整导出需 D 的权限校验与异步任务。</p>
        <button
          type="button"
          className="btn"
          onClick={() => setExportHint('导出尚不可用：未发送请求。等待受权限保护的导出 API 与短时下载链接。')}
        >
          申请导出本租约资料
        </button>
        {exportHint && <p className="help">{exportHint}</p>}
      </section>
    </Shell>
  );
}

