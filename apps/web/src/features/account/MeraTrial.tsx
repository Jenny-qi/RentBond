'use client';
import { useEffect, useRef, useState } from 'react';
import { inspectMeraAccount, meraErrorMessage, type MeraAccountRecord } from './mera';

export function MeraTrial() {
  const [record, setRecord] = useState<MeraAccountRecord | null>(null);
  const [expected, setExpected] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const inspect = async (mode: 'create' | 'restore') => {
    if (active.current) return;
    if (!window.isSecureContext || !navigator.credentials || !window.PublicKeyCredential) {
      setMessage('需要 HTTPS（或 localhost）以及支持 WebAuthn PRF 的浏览器。'); return;
    }
    const operation = new AbortController();
    active.current = operation; setBusy(true); setMessage('请本人完成系统通行密钥提示；没有交易或登录签名。'); setRecord(null);
    try {
      const result = await inspectMeraAccount({ mode, rpId: window.location.hostname, expectedAddress: expected, signal: operation.signal });
      if (operation.signal.aborted) return;
      setRecord(result); setExpected(result.address);
      setMessage(mode === 'restore' ? '本次恢复地址一致。签名密钥已清除；这不是 SIWE 登录或跨设备验收完成。' : '已得到新账户地址。请保留原地址、此域名及同步通行密钥，再使用恢复入口检查。');
    } catch (error) {
      if (!operation.signal.aborted) setMessage(meraErrorMessage(error));
    } finally {
      if (active.current === operation) { active.current = null; setBusy(false); }
    }
  };
  return <section className="glass glass-pad" style={{ marginTop: 16 }}>
    <h2>真实 Mera 账户试验 · TS05 待验收</h2>
    <p>这里会调用设备通行密钥，独立于上方虚构角色；不会给真实地址授予 Alice 的身份，也不会登录后端或发送资金交易。</p>
    <p className="help">域名和派生版本固定决定账户；换域名或新建通行密钥不能代替恢复。PRF 和签名密钥只在内存中短暂使用，完成或失败后清除，不写入存储或日志。</p>
    <label className="field"><span>原账户地址（恢复时必填）</span><input value={expected} onChange={e => setExpected(e.target.value)} spellCheck={false} disabled={busy} /></label>
    <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy} /> 我理解新建会添加设备通行密钥，不是恢复已有账户</label>
    <div className="actions" style={{ marginTop: 12 }}>
      <button className="btn" disabled={!consent || busy} onClick={() => void inspect('create')}>创建真实测试账户</button>
      <button className="btn" disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(expected.trim())} onClick={() => void inspect('restore')}>用原通行密钥核对地址</button>
      {busy && <button className="btn" onClick={() => { active.current?.abort(); setMessage('已取消；如系统提示仍在，请关闭它。本次迟到结果不会建立账户状态。'); }}>取消本次检查</button>}
    </div>
    {message && <p role="status">{message}</p>}
    {record && <div><p>地址：{record.address}</p><p>通行密钥域名：{record.rpId}</p><p className="help">派生版本：{record.derivation} · Mera 0.2.0</p></div>}
  </section>;
}
