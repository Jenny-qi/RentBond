'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { useAccount } from '@/features/account/AccountProvider';
import { DEMO_ADDRESSES, type Role } from '@/features/leases/types';
import { MONAD_TESTNET } from '@/lib/network';
import { MeraTrial } from '@/features/account/MeraTrial';

export default function LoginPage() {
  const { session, createWithPasskey, restoreWithPasskey, connectExternalWallet } = useAccount();
  const [role, setRole] = useState<Role>('TENANT');
  const [expected, setExpected] = useState<string>(DEMO_ADDRESSES.TENANT);
  const [error, setError] = useState<string | null>(null);
  const [wrongChain, setWrongChain] = useState(false);
  const router = useRouter();

  const onCreate = () => {
    setError(null);
    createWithPasskey(role);
    router.push('/leases');
  };

  const onRestore = (e: FormEvent) => {
    e.preventDefault();
    const result = restoreWithPasskey(expected, role);
    if (!result.ok) setError(result.error);
    else router.push('/leases');
  };

  const onExternal = () => {
    const chainId = wrongChain ? 1 : MONAD_TESTNET.chainId;
    const result = connectExternalWallet(role, chainId);
    if (!result.ok) setError(result.error);
  };

  return (
    <Shell title="登录与角色">
      <p className="kicker">P02 · 默认通行密钥 · Mera 试验未完成前为模拟</p>
      <h1 className="headline" style={{ maxWidth: '18ch' }}>进入同一地址</h1>
      <p className="lede">不要求安装扩展或抄助记词。登录不是同意扣款或自动付款授权。连接钱包不等于登录。</p>

      {session && (
        <p className="glass glass-pad">{session.label} · {session.address}</p>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="glass glass-pad">
          <label className="field">
            <span>演示角色（T / L / R / F）</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="TENANT">租客 Alice</option>
              <option value="LANDLORD">房东</option>
              <option value="RESOLVER">演示处理人</option>
              <option value="FALLBACK">备用处理人 F</option>
            </select>
          </label>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            使用通行密钥继续
          </button>
          <p className="help" style={{ marginTop: 10 }}>
            真实 Mera passkey 需 HTTPS、设备 PRF 与 TS05 证据。当前明确为模拟账户，资金不会上链。
          </p>
        </section>

        <form className="glass glass-pad" onSubmit={onRestore}>
          <label className="field">
            <span>恢复已有账户（必须同一地址）</span>
            <input value={expected} onChange={(e) => setExpected(e.target.value)} spellCheck={false} />
          </label>
          <button type="submit" className="btn">恢复原账户</button>
          <p className="help" style={{ marginTop: 10 }}>
            另建 passkey 可能产生不同地址。不同地址不能访问原租约私有材料，也不会被静默替换。
          </p>
        </form>
      </div>

      <section className="glass glass-pad" style={{ marginTop: 16 }}>
        <p className="kicker">外部钱包 · 工程兼容入口</p>
        <label className="row">
          <span>模拟错误网络</span>
          <input type="checkbox" checked={wrongChain} onChange={(e) => setWrongChain(e.target.checked)} />
        </label>
        <button type="button" className="btn" onClick={onExternal} style={{ marginTop: 12 }}>
          连接外部钱包（非 P0）
        </button>
        <p className="help">错误网络不发交易。拒签可退出。测试 MON 补给由 D 提供，前端失败时不代签。</p>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <MeraTrial />
    </Shell>
  );
}
