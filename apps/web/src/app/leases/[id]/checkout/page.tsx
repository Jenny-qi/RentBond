'use client';

import { FormEvent, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useTx } from '@/features/tx/TxProvider';
import { useAccount } from '@/features/account/AccountProvider';

export default function CheckoutPage() {
  const { requestTx } = useTx();
  const { session } = useAccount();
  const [date, setDate] = useState('2025-12-20');
  const [note, setNote] = useState('租客已离境，钥匙已交物业。请求确认提前交接。');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const today = '2026-01-04';
    if (date > today) {
      setError('实际交接日期不得在未来。');
      return;
    }
    if (note.trim().length < 8) {
      setError('需要说明，并至少引用一份已提交材料。');
      return;
    }
    requestTx({
      title: '请求确认提前交接',
      amountLabel: '此操作不分配押金',
      purpose: '确认交接只开启申索时间，不是把押金判给某人。无人回应可开 CHECKOUT，不会因此立即退全款。',
      stepLabel: 'requestCheckout（模拟）',
      onConfirm: () => { throw new Error('该操作尚未接入合约与服务接口，未执行。'); },
    });
  };

  return (
    <Shell title="交接">
      <p className="kicker">P08 · 到期日与交接状态必须区分</p>
      <h1 className="headline" style={{ maxWidth: '14ch' }}>不自动当作交接完成</h1>
      <p className="lede">预定 leaseEndAt 仍会进入结算。CHECKOUT 超时不触发租期内全额退款。失联处理入口保留，不删除 F 路径。</p>
      <form className="glass glass-pad" onSubmit={onSubmit}>
        <label className="field">
          <span>实际交接日期</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>说明与材料引用</span>
          <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={!session}>发起交接请求</button>
          <button
            type="button"
            className="btn"
            disabled={!session}
            onClick={() =>
              requestTx({
                title: '认可本次交接请求',
                amountLabel: '不转移 MockUSD',
                purpose: '认可后可提前开启申索窗口。居住权不由本按钮裁定。',
                stepLabel: 'confirmCheckout（模拟）',
                onConfirm: () => { throw new Error('该操作尚未接入合约与服务接口，未执行。'); },
              })
            }
          >
            对方认可
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              requestTx({
                title: '对交接提出异议',
                amountLabel: '可进入 CHECKOUT 案件',
                purpose: '异议不会立即分配押金。',
                stepLabel: 'objectCheckout（模拟）',
                onConfirm: () => { throw new Error('该操作尚未接入合约与服务接口，未执行。'); },
              })
            }
          >
            提出异议
          </button>
        </div>
      </form>
    </Shell>
  );
}

