'use client';
import { useState } from 'react';
import { useLease } from './LeaseProvider';
import { useTx } from '@/features/tx/TxProvider';
import { formatMockUsd, parseShareAmount } from '@/lib/money';
const categories = { cleaning: '清洁', damage: '损坏', unpaid: '未付费用', other: '其他' };
const initial = () => ({ category: 'cleaning', amount: '', reason: '', clauseRef: '', evidenceNote: '' });
export function ClaimComposer() {
  const { lease, workflow } = useLease();
  const { requestTx } = useTx();
  const [rows, setRows] = useState([initial()]);
  const [error, setError] = useState('');
  const update = (index: number, key: keyof ReturnType<typeof initial>, value: string) => setRows(old => old.map((row, i) => i === index ? { ...row, [key]: value } : row));
  return <form className="glass glass-pad" onSubmit={event => {
    event.preventDefault(); setError('');
    try {
      const claims = rows.map((row, id) => {
        const parsed = parseShareAmount(row.amount, lease.depositBaseUnits);
        if (!parsed.ok) throw new Error(parsed.error);
        if (BigInt(parsed.baseUnits) === 0n) throw new Error('每项扣款必须大于 0');
        if (row.reason.trim().length < 20 || row.reason.trim().length > 2000) throw new Error('每项理由须为 20—2000 字');
        if (!row.clauseRef.trim() || !row.evidenceNote.trim()) throw new Error('须填写条款引用及证据或无证据说明');
        return { ...row, id, categoryLabel: categories[row.category as keyof typeof categories], amountBaseUnits: parsed.baseUnits, response: 'Pending' as const };
      });
      const total = claims.reduce((sum, c) => sum + BigInt(c.amountBaseUnits), 0n);
      if (total > BigInt(lease.depositBaseUnits)) throw new Error('扣款合计不能超过押金');
      requestTx({ title: `一次提交 ${claims.length} 项扣款`, amountLabel: `合计 ${formatMockUsd(total)}`, purpose: '确认后不能新增项目或提高金额；申报不等于扣款被批准。', stepLabel: 'submitClaims（模拟，无材料上链）', onConfirm: () => workflow({ type: 'submit-claims', role: 'LANDLORD', claims }) });
    } catch (e) { setError(e instanceof Error ? e.message : '请检查清单'); }
  }}>
    <h2>房东准备最终扣款清单</h2>
    <p className="help">内容仅保存在当前演示内存；真实材料存储与承诺值尚待 D/B 接口。</p>
    {rows.map((row, i) => <fieldset key={i} style={{ marginBottom: 16 }}><legend>第 {i + 1} 项</legend>
      <label className="field"><span>类别</span><select value={row.category} onChange={e => update(i, 'category', e.target.value)}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="field"><span>金额（MockUSD）</span><input required inputMode="decimal" value={row.amount} onChange={e => update(i, 'amount', e.target.value)} /></label>
      <label className="field"><span>理由（20—2000 字）</span><textarea required minLength={20} maxLength={2000} value={row.reason} onChange={e => update(i, 'reason', e.target.value)} /></label>
      <label className="field"><span>对应租约条款</span><input required value={row.clauseRef} onChange={e => update(i, 'clauseRef', e.target.value)} /></label>
      <label className="field"><span>证据、票据引用或无证据说明</span><textarea required value={row.evidenceNote} onChange={e => update(i, 'evidenceNote', e.target.value)} /></label>
      <button type="button" className="btn" disabled={rows.length === 1} onClick={() => setRows(old => old.filter((_, j) => i !== j))}>移除此草稿项</button>
    </fieldset>)}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions"><button type="button" className="btn" disabled={rows.length >= 10} onClick={() => setRows(old => [...old, initial()])}>添加扣款项（最多 10 项）</button><button className="btn btn-primary" disabled={lease.workflow !== 'claims' || lease.chainReadFailed}>确认最终清单</button></div>
  </form>;
}
