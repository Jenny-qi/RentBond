'use client';

import { useAccount } from '@/features/account/AccountProvider';
import { useLease } from '@/features/leases/LeaseProvider';
import { useTx } from '@/features/tx/TxProvider';
import { Shell } from '@/components/Shell';
import { shortenAddress } from '@/lib/network';
import { DEMO_ADDRESSES } from '@/features/leases/types';

export default function InvitePage() {
  const { session } = useAccount();
  const { lease, workflow } = useLease();
  const { requestTx } = useTx();
  const wrongWallet = session && session.address.toLowerCase() !== DEMO_ADDRESSES.TENANT.toLowerCase()
    && session.role === 'TENANT';

  return (
    <Shell title="邀请与确认">
      <p className="kicker">P05 · 邀请只帮助查找租约，不赋予签约权限</p>
      <h1 className="headline" style={{ maxWidth: '12ch' }}>同一份条款</h1>
      <p className="lede">数字工具不改变强制法律权利。账户与邀请不能证明房源真实。</p>

      <section className="glass glass-pad">
        <p>资产：MockUSD（测试，无现金价值） · 押金 1,000</p>
        <p>租客 {shortenAddress(lease.tenantAddress)} · 房东 {shortenAddress(lease.landlordAddress)}</p>
        <p>处理人 {shortenAddress(lease.resolverAddress)} · 备用 {shortenAddress(lease.fallbackAddress)}</p>
        <p className="help">termsHash 放在核验详情：{lease.termsHash}</p>
        <p className="help">超时退出政策：TIMEOUT_RETURN_UNAWARDED_TO_TENANT · hardEndAt {lease.deadlines.hardEndAtUtc}</p>
      </section>

      {(!session || session.address.toLowerCase() !== lease.tenantAddress.toLowerCase()) && (
        <p className="glass glass-pad" style={{ marginTop: 12 }}>
          错误钱包只能看到有限邀请信息，不能接受别人的角色或查看全部附件。
          {wrongWallet ? ' 当前地址与邀请租客不一致。' : ''}
        </p>
      )}

      {session?.role === 'TENANT' && session.networkOk && (
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 16 }}
          disabled={lease.tenantAccepted || lease.funded || lease.cancelled || lease.chainReadFailed}
          onClick={() =>
            requestTx({
              title: '确认接受条款',
              amountLabel: '不在此步转移 1,000 MockUSD',
              purpose: '你确认与房东接受同一 termsHash。登录或打开邀请不是同意扣款。',
              stepLabel: 'acceptTerms（模拟）',
              onConfirm: () => workflow({ type: 'accept-terms', role: session.role }),
            })
          }
        >
          {lease.tenantAccepted ? '已确认条款（模拟）' : '确认条款（仍未存入）'}
        </button>
      )}
    </Shell>
  );
}

