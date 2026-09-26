'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useLease } from '@/features/leases/LeaseProvider';
import { useTx } from '@/features/tx/TxProvider';
import { useAccount } from '@/features/account/AccountProvider';

export default function FundPage() {
  const { lease, markApprovedOnly, markFunded, workflow } = useLease();
  const { requestTx } = useTx();
  const { session } = useAccount();
  const canWrite = Boolean(session?.networkOk && session.role === 'TENANT' && !lease.cancelled && !lease.chainReadFailed);

  return (
    <Shell title="存入押金">
      <p className="kicker">P06 · approve 与 fund 分开</p>
      <h1 className="headline" style={{ maxWidth: '16ch' }}>确认存入 1,000 MockUSD</h1>
      <p className="lede">
        只允许指定租客一次存入精确 D。向合约直接转币不等于入金。授权成功但未 fund 必须显示未存入。
      </p>
      <section className="glass glass-pad">
        <p>收款合约 {lease.contractAddress}</p>
        <p>当前状态：{lease.funded ? '已存入（虚构演示，无链上交易）' : lease.cancelled ? '已取消约定' : lease.approvedNotFunded ? '已授权，未存入' : '尚未授权'}</p>
        {!lease.tenantAccepted && <p><Link href="/invite/alice-invite">先查看并确认双方条款</Link></p>}
        <div className="actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn"
            disabled={!canWrite || !lease.tenantAccepted || lease.funded || lease.approvedNotFunded}
            onClick={() =>
              requestTx({
                title: '授权 1,000 MockUSD',
                amountLabel: '精确授权 1000.00 MockUSD，不是无限额度',
                purpose: '仅允许本租约合约扣转测试资产。授权成功不等于押金到账。',
                stepLabel: 'ERC-20 approve（模拟）',
                onConfirm: markApprovedOnly,
              })
            }
          >
            第一步：精确授权
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canWrite || lease.funded || !lease.approvedNotFunded}
            onClick={() =>
              requestTx({
                title: '确认存入 1,000 MockUSD',
                amountLabel: '1,000 MockUSD · 测试资产，无现金价值',
                purpose: '将精确 D 转入本租约托管。取消后不会继续 fund。',
                stepLabel: 'fund（模拟）',
                onConfirm: markFunded,
              })
            }
          >
            第二步：确认存入 1,000 MockUSD
          </button>
        </div>
        {!lease.funded && <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn" disabled={!session?.networkOk || session.role !== 'TENANT' || lease.chainReadFailed || !lease.approvedNotFunded} onClick={() => requestTx({
            title: '撤销未使用的授权', amountLabel: '授权额度设为 0 MockUSD', purpose: '仍未存入押金；撤销后继续存入需要重新授权。', stepLabel: 'approve(0)（模拟）', onConfirm: () => workflow({ type: 'revoke', role: 'TENANT' }),
          })}>撤销授权</button>
          <button className="btn" disabled={!session?.networkOk || !['TENANT', 'LANDLORD'].includes(session.role) || lease.cancelled} onClick={() => requestTx({
            title: '取消尚未入金的约定', amountLabel: '不转移押金', purpose: '取消后不能接受或存入；取消约定不会自动撤销代币授权。', stepLabel: 'cancelUnfunded（模拟）', onConfirm: () => workflow({ type: 'cancel', role: session!.role }),
          })}>取消约定</button>
        </div>}
        <p className="help">余额不足、金额不符、未确认条款或错误网络均应拒绝。测试 Gas 补给失败时不改用平台代签。</p>
        <p><Link href={`/leases/${lease.id}`}>返回工作台</Link></p>
      </section>
    </Shell>
  );
}
