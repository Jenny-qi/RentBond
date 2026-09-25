'use client';
import Link from 'next/link';
import { useLease } from './LeaseProvider';
import { useAccount } from '@/features/account/AccountProvider';
import { useTx } from '@/features/tx/TxProvider';
export function ClaimsProgress() {
  const { lease, workflow } = useLease();
  const { session } = useAccount();
  const { requestTx, phase } = useTx();
  const busy = ['awaiting-signature', 'submitted', 'confirming'].includes(phase);
  const disabled = !session?.networkOk || busy || lease.chainReadFailed;
  const next = lease.workflow === 'active' ? 'claims' : lease.workflow === 'claims' ? 'claim-deadline' : lease.workflow === 'claim-deadline' && lease.claimsWindowClosed ? 'response-deadline' : null;
  return <section className="glass glass-pad" style={{ marginTop: 16, marginBottom: 16 }}>
    <p>{lease.statusLabel}</p>
    {!lease.funded && <Link href={`/leases/${lease.id}/fund`}>先确认条款并存入押金</Link>}
    {next && lease.allocation.unallocated !== '0' && <details><summary>虚构时间场景（仅当前浏览器）</summary><p className="help">用于检查窗口边界，不改变链上时间，不代表交易已经执行。</p><button className="btn" disabled={disabled} onClick={() => workflow({ type: 'advance', to: next })}>{next === 'claims' ? '加载预定租期结束场景' : next === 'claim-deadline' ? '加载申索截止场景' : '加载回应截止场景'}</button></details>}
    {lease.workflow === 'claim-deadline' && !lease.claimsWindowClosed && <button className="btn" disabled={disabled} onClick={() => requestTx({ title: '关闭申索并分配无争议部分', amountLabel: '分配不等于领取', purpose: '到期后分配未申索及已认可部分，争议继续锁定。', stepLabel: 'closeClaims（模拟）', onConfirm: () => workflow({ type: 'close-claims' }) })}>执行关闭与分配</button>}
    {lease.workflow === 'response-deadline' && <button className="btn" disabled={disabled} onClick={() => requestTx({ title: '开启统一争议案件', amountLabel: '未回应不视为认可', purpose: '固定所有尚未分配项目，此后不能普通回应或撤回。', stepLabel: 'openClaimCase（模拟）', onConfirm: () => workflow({ type: 'open-case' }) })}>开启 CLAIMS 案件</button>}
    {lease.caseOpened && <Link className="btn" href={`/leases/${lease.id}/cases/claims-1`}>查看案件与处理结果</Link>}
  </section>;
}
