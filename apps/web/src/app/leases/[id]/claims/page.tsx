'use client';

import { useState } from 'react';
import { Shell } from '@/components/Shell';
import { AmountSplit } from '@/components/AmountSplit';
import { useLease } from '@/features/leases/LeaseProvider';
import { useTx } from '@/features/tx/TxProvider';
import { useAccount } from '@/features/account/AccountProvider';
import { formatMockUsd } from '@/lib/money';
import { ClaimComposer } from '@/features/leases/ClaimComposer';
import { ClaimsProgress } from '@/features/leases/ClaimsProgress';
import type { ClaimDraftItem } from '@/features/leases/types';

export default function ClaimsPage() {
  const { lease, respondClaim, workflow } = useLease();
  const { requestTx } = useTx();
  const { session } = useAccount();
  const [confirming, setConfirming] = useState<ClaimDraftItem | null>(null);
  const [disputeFor, setDisputeFor] = useState<ClaimDraftItem | null>(null);
  const [disputeNote, setDisputeNote] = useState('');

  const asLandlord = session?.role === 'LANDLORD';
  const asTenant = session?.role === 'TENANT';

  return (
    <Shell title="扣款清单">
      <p className="kicker">P09 · 最多 10 项 · 确认后不能新增或提高金额</p>
      <h1 className="headline" style={{ maxWidth: '16ch' }}>认可清洁，争议划痕</h1>
      <AmountSplit deposit={lease.depositBaseUnits} allocation={lease.allocation} mode={lease.allocationMode} />
      <ClaimsProgress />
      {asLandlord && !lease.claimsSubmitted && <ClaimComposer />}

      {lease.claims.map((item) => (
        <article key={item.id} className="glass glass-pad" style={{ marginTop: 12 }}>
          <div className="row">
            <b>{item.categoryLabel} · {formatMockUsd(item.amountBaseUnits)}</b>
            <span className="pill">{item.response}</span>
          </div>
          <p>{item.reason}</p>
          <p className="help">{item.clauseRef} · {item.evidenceNote}</p>
          {item.disputeNote && <p className="help">异议：{item.disputeNote}</p>}
          {asLandlord && !lease.caseOpened && ['claims', 'claim-deadline'].includes(lease.workflow) && item.response !== 'Withdrawn' && !(lease.claimsWindowClosed && item.response === 'Accepted') && <button className="btn" onClick={() => requestTx({
            title: `撤回${item.categoryLabel} ${formatMockUsd(item.amountBaseUnits)}`, amountLabel: '该款归租客，窗口关闭前不提前分配', purpose: '撤回后不可恢复；已分配项目不能反转。', stepLabel: 'waiveClaim（模拟）', onConfirm: () => workflow({ type: 'waive', role: 'LANDLORD', id: item.id }),
          })}>撤回此项</button>}
          {asTenant && !lease.caseOpened && ['claims', 'claim-deadline'].includes(lease.workflow) && ['Pending', 'Disputed'].includes(item.response) && (
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={() => setConfirming(item)}>
                认可{item.categoryLabel}费 {formatMockUsd(item.amountBaseUnits)}
              </button>
              <button type="button" className="btn" onClick={() => { setDisputeFor(item); setDisputeNote(''); }}>
                提出异议
              </button>
            </div>
          )}
        </article>
      ))}

      {asLandlord && (
        <p className="help">房东可在案件创建前撤回尚未分配项；已认可并分配的款项不能用撤回反转。</p>
      )}

      {confirming && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="glass dialog">
            <h2>确认认可 {confirming.categoryLabel} {formatMockUsd(confirming.amountBaseUnits)}</h2>
            <p>该认可不可撤销。申索窗口关闭前只记录、不分配；关闭后才进入可领取。</p>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setConfirming(null)}>返回</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const item = confirming;
                  setConfirming(null);
                  requestTx({
                    title: `认可${item.categoryLabel}费 ${formatMockUsd(item.amountBaseUnits)}`,
                    amountLabel: formatMockUsd(item.amountBaseUnits),
                    purpose: '明确确认该扣款。未回应不视为同意。',
                    stepLabel: 'respondClaim(Accepted) 模拟',
                    onConfirm: () => {
                      respondClaim(item.id, 'Accepted');
                    },
                  });
                }}
              >
                确认认可{confirming.categoryLabel}费 {formatMockUsd(confirming.amountBaseUnits)}
              </button>
            </div>
          </div>
        </div>
      )}

      {disputeFor && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="glass dialog">
            <h2>对 {disputeFor.categoryLabel} 提出异议</h2>
            <p>不要求必须有图片。提交后该金额在窗口关闭后继续锁定，进入处理而不是自动给房东。</p>
            <label className="field">
              <span>异议理由</span>
              <textarea rows={4} value={disputeNote} onChange={(e) => setDisputeNote(e.target.value)} />
            </label>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setDisputeFor(null)}>返回</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!disputeNote.trim()}
                onClick={() => {
                  const item = disputeFor;
                  setDisputeFor(null);
                  requestTx({
                    title: `异议 ${item.categoryLabel}`,
                    amountLabel: formatMockUsd(item.amountBaseUnits),
                    purpose: '争议金额将继续锁定。',
                    stepLabel: 'respondClaim(Disputed) 模拟',
                    onConfirm: () => {
                      respondClaim(item.id, 'Disputed', disputeNote);
                    },
                  });
                }}
              >
                提交异议
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
