'use client';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { createAliceLease, createUnfundedLease, type AliceLease, type ClaimResponse } from './types';
import { transition, type Action } from './model';
import { workflowTransition, type WorkflowAction } from './workflow';
import { verifyConservation } from '@/lib/money';
import { useAccount } from '@/features/account/AccountProvider';
interface LeaseContextValue {
  lease: AliceLease;
  scenario: number;
  loadScenario: (name: 'unfunded' | 'split') => void;
  setReadFailure: (failed: boolean) => void;
  workflow: (action: WorkflowAction) => void;
  act: (action: Action) => void;
  respondClaim: (id: number, response: ClaimResponse, disputeNote?: string) => void;
  markApprovedOnly: () => void;
  markFunded: () => void;
  withdrawTenant: () => void;
  withdrawLandlord: () => void;
  proposePrimary: (award: string, reason?: string) => void;
  challengePrimary: () => void;
  acceptSettlement: (proposalId: number) => void;
}
const LeaseContext = createContext<LeaseContextValue | null>(null);
export function LeaseProvider({ children }: { children: ReactNode }) {
  const [lease, render] = useState(createAliceLease);
  const [scenario, setScenario] = useState(0);
  const current = useRef(lease);
  const { session } = useAccount();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const setLease = (updater: (prev: AliceLease) => AliceLease) => {
    const next = updater(current.current);
    if (!verifyConservation(next.funded ? next.depositBaseUnits : '0', next.allocation)) throw new Error('金额守恒检查失败');
    current.current = next;
    render(next);
  };
  const role = () => {
    const latest = sessionRef.current;
    if (!latest?.networkOk || latest.address !== session?.address) throw new Error('账户已变更，请重新确认');
    if (current.current.chainReadFailed) throw new Error('状态读取失败，请刷新后重新确认');
    return latest.role;
  };
  const act = (action: Action) => {
    const caller = role();
    if ('role' in action && action.role !== caller) throw new Error('当前账户无权执行');
    setLease(prev => transition(prev, action));
  };
  const workflow = (action: WorkflowAction) => {
    const caller = role();
    if ('role' in action && action.role !== caller) throw new Error('当前账户无权执行');
    setLease(prev => workflowTransition(prev, action));
  };
  return <LeaseContext.Provider value={{
    lease, scenario, act, workflow,
    loadScenario: name => {
      setLease(() => name === 'unfunded' ? createUnfundedLease() : createAliceLease());
      setScenario(value => value + 1);
    },
    setReadFailure: failed => setLease(prev => ({ ...prev, chainReadFailed: failed })),
    respondClaim: (id, response, note) => workflow({ type: 'respond', role: role(), id, accept: response === 'Accepted', note }),
    markApprovedOnly: () => workflow({ type: 'approve', role: role() }),
    markFunded: () => workflow({ type: 'fund', role: role() }),
    withdrawTenant: () => act({ type: 'withdraw', role: 'TENANT' }),
    withdrawLandlord: () => act({ type: 'withdraw', role: 'LANDLORD' }),
    proposePrimary: (award, reason = '虚构逐项理由：对照入住与退租记录，按现有材料支持部分损坏金额。') => act({ type: 'primary', role: role(), award, reason }),
    challengePrimary: () => act({ type: 'challenge', role: role() }),
    acceptSettlement: proposalId => act({ type: 'accept', role: role(), proposalId }),
  }}>{children}</LeaseContext.Provider>;
}
export function useLease() {
  const ctx = useContext(LeaseContext);
  if (!ctx) throw new Error('useLease must be used within LeaseProvider');
  return ctx;
}
