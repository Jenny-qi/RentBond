'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { MONAD_TESTNET } from '@/lib/network';
import { DEMO_ADDRESSES, type AccountMethod, type Role } from '@/features/leases/types';

const SESSION_KEY = 'rentbond.account.v1';

export interface AccountSession {
  address: string;
  expectedAddress?: string;
  role: Role;
  method: AccountMethod;
  chainId: number;
  networkOk: boolean;
  label: string;
}

interface AccountContextValue {
  session: AccountSession | null;
  createWithPasskey: (role: Role) => { ok: true } | { ok: false; error: string };
  restoreWithPasskey: (expectedAddress: string, role: Role) => { ok: true } | { ok: false; error: string };
  connectExternalWallet: (role: Role, chainId: number) => { ok: true } | { ok: false; error: string };
  switchRole: (role: Role) => void;
  signOut: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

function addressForRole(role: Role): string {
  if (role === 'FALLBACK') return DEMO_ADDRESSES.FALLBACK;
  if (role === 'LANDLORD') return DEMO_ADDRESSES.LANDLORD;
  if (role === 'RESOLVER') return DEMO_ADDRESSES.RESOLVER;
  return DEMO_ADDRESSES.TENANT;
}

function roleLabel(role: Role): string {
  if (role === 'FALLBACK') return '备用处理人 F';
  if (role === 'LANDLORD') return '房东 Landlord';
  if (role === 'RESOLVER') return '处理人 Resolver';
  return '租客 Tenant';
}

function loadSession(): AccountSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as AccountSession;
    if (!['TENANT', 'LANDLORD', 'RESOLVER', 'FALLBACK'].includes(candidate.role)
      || typeof candidate.address !== 'string'
      || candidate.address.toLowerCase() !== addressForRole(candidate.role).toLowerCase()
      || !['passkey', 'external-wallet'].includes(candidate.method)
      || !Number.isSafeInteger(candidate.chainId)) return null;
    return { ...candidate, networkOk: candidate.chainId === MONAD_TESTNET.chainId };
  } catch {
    return null;
  }
}

function persist(session: AccountSession | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!session) window.localStorage.removeItem(SESSION_KEY);
    else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* A blocked storage area must not prevent in-memory logout. No secrets are stored. */ }
}

/**
 * P0 path is Mera passkey (preview). Until RB-02 locks SDK versions and TS05 runs
 * on a real device, this adapter is an explicitly labeled mock: same-address restore,
 * no silent address swap, no server-side signing.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AccountSession | null>(null);

  useEffect(() => {
    setSession(loadSession());
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY || event.key === null) setSession(loadSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const commit = useCallback((next: AccountSession | null) => {
    persist(next);
    setSession(next);
  }, []);

  const createWithPasskey = useCallback((role: Role) => {
    const next: AccountSession = {
      address: addressForRole(role),
      expectedAddress: addressForRole(role),
      role,
      method: 'passkey',
      chainId: MONAD_TESTNET.chainId,
      networkOk: true,
      label: `${roleLabel(role)} · 通行密钥（模拟）`,
    };
    commit(next);
    return { ok: true } as const;
  }, [commit]);

  const restoreWithPasskey = useCallback(
    (expectedAddress: string, role: Role) => {
      const recovered = addressForRole(role);
      const expected = expectedAddress.trim().toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(expected)) {
        return { ok: false as const, error: '请输入完整的原账户地址。恢复必须是同一地址。' };
      }
      if (expected !== recovered.toLowerCase()) {
        return {
          ok: false as const,
          error:
            '本次通行密钥对应不同地址，不能假装恢复。新建 passkey 不会自动替换已入金租约的收款身份。',
        };
      }
      commit({
        address: recovered,
        expectedAddress: recovered,
        role,
        method: 'passkey',
        chainId: MONAD_TESTNET.chainId,
        networkOk: true,
        label: `${roleLabel(role)} · 已恢复原地址（模拟）`,
      });
      return { ok: true as const };
    },
    [commit],
  );

  const connectExternalWallet = useCallback(
    (role: Role, chainId: number) => {
      const networkOk = chainId === MONAD_TESTNET.chainId;
      commit({
        address: addressForRole(role),
        role,
        method: 'external-wallet',
        chainId,
        networkOk,
        label: networkOk
          ? `${roleLabel(role)} · 外部钱包（兼容入口，非 P0）`
          : `${roleLabel(role)} · 错误网络，已禁止发交易`,
      });
      if (!networkOk) {
        return { ok: false as const, error: '当前不是 Monad 测试网（chainId 10143）。连接钱包不等于登录，也不会发送交易。' };
      }
      return { ok: true as const };
    },
    [commit],
  );

  const switchRole = useCallback(
    (role: Role) => {
      commit(null);
      try { window.localStorage.removeItem('rentbond.forms.v1'); } catch { /* No persisted private forms. */ }
      createWithPasskey(role);
    },
    [commit, createWithPasskey],
  );

  const signOut = useCallback(() => {
    commit(null);
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem('rentbond.forms.v1'); } catch { /* No persisted private forms. */ }
    }
  }, [commit]);

  const value = useMemo(
    () => ({ session, createWithPasskey, restoreWithPasskey, connectExternalWallet, switchRole, signOut }),
    [session, createWithPasskey, restoreWithPasskey, connectExternalWallet, switchRole, signOut],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within AccountProvider');
  return ctx;
}
