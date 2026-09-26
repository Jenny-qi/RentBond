'use client';
import { useLease } from '@/features/leases/LeaseProvider';
import { useTx } from '@/features/tx/TxProvider';
export function DemoScenarios() {
  const { lease, loadScenario, setReadFailure } = useLease();
  const { phase } = useTx();
  const busy = ['awaiting-signature', 'submitted', 'confirming'].includes(phase);
  return <details className="glass glass-pad" style={{ marginTop: 16 }}>
    <summary>本地演示场景与故障测试</summary>
    <p className="help">仅加载内存中的虚构案例；会清除本次演示进度。不是链上交易，也不修改正式租约时间。刷新页面返回 700/100/200 案例。</p>
    <div className="actions">
      <button className="btn" disabled={busy} onClick={() => loadScenario('unfunded')}>从未入金开始演示</button>
      <button className="btn" disabled={busy} onClick={() => loadScenario('split')}>重置为 700 / 100 / 200</button>
      <button className="btn" disabled={busy} onClick={() => setReadFailure(!lease.chainReadFailed)}>{lease.chainReadFailed ? '恢复模拟读取' : '模拟读取失败'}</button>
    </div>
  </details>;
}
