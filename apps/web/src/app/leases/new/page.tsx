'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Shell } from '@/components/Shell';
import { parseUserAmount } from '@/lib/money';
import { DEMO_ADDRESSES } from '@/features/leases/types';

export default function NewLeasePage() {
  const [amount, setAmount] = useState('1000.00');
  const [start, setStart] = useState('2025-08-01');
  const [end, setEnd] = useState('2026-01-01');
  const [tenant, setTenant] = useState<string>(DEMO_ADDRESSES.TENANT);
  const [landlord, setLandlord] = useState<string>(DEMO_ADDRESSES.LANDLORD);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const parsed = parseUserAmount(amount);
    return parsed;
  }, [amount]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^0x[0-9a-fA-F]{40}$/.test(tenant) || !/^0x[0-9a-fA-F]{40}$/.test(landlord)) {
      setError('请输入完整有效地址；当前仅能预览 Alice 示例，尚未保存草稿。');
      return;
    }
    if (tenant.toLowerCase() === landlord.toLowerCase()) {
      setError('租客与房东地址必须不同。');
      return;
    }
    if (!preview.ok) {
      setError(preview.error);
      return;
    }
    if (end <= start) {
      setError('结束日须晚于开始日。');
      return;
    }
    setError('表单校验通过，但草稿 API 尚未接入：未保存，也未生成邀请。请从首页打开已有的 Alice 虚构示例。');
  };

  return (
    <Shell title="创建租约">
      <p className="kicker">P04 创建向导</p>
      <h1 className="headline" style={{ maxWidth: '14ch' }}>部署后不可随意改动</h1>
      <p className="lede">所有校验会在 D 的服务端重做。R/F 来自已授权服务方案，无需四方排队签字。本表目前只做前端校验，不会写链。</p>
      <form className="glass glass-pad" onSubmit={onSubmit}>
        <label className="field">
          <span>押金（MockUSD，最多 2 位小数）</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>开始日</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>预计结束日</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>租客地址（由邀请关联，勿手抄给对方）</span>
          <input value={tenant} onChange={(e) => setTenant(e.target.value)} spellCheck={false} />
        </label>
        <label className="field">
          <span>房东地址</span>
          <input value={landlord} onChange={(e) => setLandlord(e.target.value)} spellCheck={false} />
        </label>
        <p className="help">服务方案：演示处理人 + 备用处理人已预授权。真实资产被阻止。hardEndAt = 结束日 + 37 天（正常配置）。</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary">校验草稿（保存与邀请尚未接入）</button>
      </form>
    </Shell>
  );
}
