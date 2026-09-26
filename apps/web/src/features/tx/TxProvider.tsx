'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAccount } from '@/features/account/AccountProvider';
import type { TxPhase } from '@/features/leases/types';
import { useLease } from '@/features/leases/LeaseProvider';

export interface PendingTx {
  id: string;
  title: string;
  amountLabel: string;
  purpose: string;
  stepLabel: string;
  onConfirm: () => void;
}

interface TxContextValue {
  phase: TxPhase;
  pending: PendingTx | null;
  hash: string | null;
  lastMessage: string | null;
  requestTx: (tx: Omit<PendingTx, 'id'>) => void;
  confirmSign: () => void;
  cancelSign: () => void;
  reset: () => void;
}

const TxContext = createContext<TxContextValue | null>(null);

function mockHash(): string {
  const n = Math.floor(Math.random() * 1e16).toString(16).padStart(16, '0');
  return `0x${n}${'0'.repeat(48)}`.slice(0, 66);
}

export function TxProvider({ children }: { children: ReactNode }) {
  const { session } = useAccount();
  const { lease } = useLease();
  const latestLease = useRef(lease);
  latestLease.current = lease;
  const [phase, setPhase] = useState<TxPhase>('idle');
  const [pending, setPending] = useState<PendingTx | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const busy = useRef(false);
  const path = usePathname();
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const requestTx = useCallback(
    (tx: Omit<PendingTx, 'id'>) => {
      if (busy.current) return;
      if (lease.chainReadFailed) {
        setLastMessage('状态读取失败，已保留上次数据；请刷新后重新确认。');
        return;
      }
      if (!session) {
        setLastMessage('请先进入账户。登录不是同意扣款。');
        return;
      }
      if (!session.networkOk) {
        setLastMessage('错误网络不发交易。请切换到 Monad 测试网。');
        return;
      }
      clearTimer();
      setHash(null);
      const expectedRevision = lease.revision;
      setPending({ ...tx, id: `tx-${Date.now()}`, onConfirm: () => {
        if (latestLease.current.chainReadFailed || latestLease.current.revision !== expectedRevision) {
          throw new Error('状态已变化或读取失败，请重新查看金额并确认。');
        }
        tx.onConfirm();
      } });
      busy.current = true;
      setPhase('awaiting-signature');
      setLastMessage('等待你在本机确认这笔操作。取消后不会继续执行。');
    },
    [session, lease.chainReadFailed, lease.revision],
  );

  const cancelSign = useCallback(() => {
    clearTimer();
    setPhase('cancelled');
    setPending(null);
    busy.current = false;
    setLastMessage('已取消，未执行该操作。');
  }, []);

  const confirmSign = useCallback(() => {
    if (!pending || phase !== 'awaiting-signature' || timer.current !== null) return;
    const run = pending.onConfirm;
    const nextHash = mockHash();
    setHash(nextHash);
    setPhase('submitted');
    setLastMessage('已提交。收到交易哈希不等于成功。');
    timer.current = window.setTimeout(() => {
      setPhase('confirming');
      setLastMessage('确认中，可查看交易。超时不会自动判定失败并引导重复支付。');
      timer.current = window.setTimeout(() => {
        try {
          run();
          setPhase('confirmed');
          setLastMessage('模拟确认完成。这是虚构数据，不是测试网交易证据。');
        } catch (error) {
          setPhase('failed');
          setLastMessage(error instanceof Error ? error.message : '操作失败，未完成');
        }
        timer.current = null;
        busy.current = false;
        setPending(null);
      }, 900);
    }, 700);
  }, [pending, phase]);

  const reset = useCallback(() => {
    clearTimer();
    setPhase('idle');
    setPending(null);
    setHash(null);
    setLastMessage(null);
    busy.current = false;
  }, []);
  useEffect(() => { reset(); }, [path, reset]);

  const value = useMemo(
    () => ({ phase, pending, hash, lastMessage, requestTx, confirmSign, cancelSign, reset }),
    [phase, pending, hash, lastMessage, requestTx, confirmSign, cancelSign, reset],
  );

  return <TxContext.Provider value={value}>{children}</TxContext.Provider>;
}

export function useTx() {
  const ctx = useContext(TxContext);
  if (!ctx) throw new Error('useTx must be used within TxProvider');
  return ctx;
}
