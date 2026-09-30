'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createSiweMessage } from 'viem/siwe';
import type { Address, Hex, EIP1193Provider } from 'viem';
import { actionAbi, actionData, api, ApiError, checkedConfig, checkWallet, clearRequests, clients, type Action, type LiveConfig, type Wallet } from './client';
import { openPasskey } from './wallet';
import { meraErrorMessage } from '../account/mera';

type ReceiptRecord = { hash: Hex; address: Address; chainId: number; to: Address; data: Hex; title: string; leaseId?: string; factory: boolean };
type LiveContext = {
  config: LiveConfig; wallet: Wallet | null; generation: number; busy: boolean; message: string;
  login: (mode: 'create' | 'restore' | 'external', expected: string) => Promise<void>;
  logout: () => void; cancelLogin: () => void; request: typeof api;
  propose: (action: Action) => void; run: (task: () => Promise<void>) => Promise<void>;
  updated: number;
};
const Context = createContext<LiveContext | null>(null);
const RECEIPT_KEY = 'rentbond.pending-chain-transaction.v1';
export function LiveProvider({ config, children }: { config: LiveConfig; children: ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const walletRef = useRef<Wallet | null>(null);
  const epoch = useRef(0);
  const [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<Action | null>(null);
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [updated, setUpdated] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const invalidate = useCallback(() => {
    epoch.current++; clearRequests(); abort.current?.abort(); walletRef.current?.end(); walletRef.current = null;
    setWallet(null); setPending(null); setGeneration(epoch.current); setReceipt(null);
  }, []);
  const logout = useCallback(() => {
    invalidate(); setMessage('Local signing session and private pages cleared.');
    void api('/api/auth/logout', {}).catch(() => setMessage('Signed out locally. Server revocation was not confirmed; reconnect and sign out again.'));
  }, [invalidate]);
  const request: typeof api = useCallback(async (...args) => {
    const version = epoch.current;
    try {
      const value = await api(...args);
      if (version !== epoch.current) throw new Error('Account changed. The previous response was discarded.');
      return value;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && version === epoch.current) invalidate();
      throw e;
    }
  }, [invalidate]);
  const run = async (task: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await task(); }
    catch (e) { setMessage(meraErrorMessage(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  const login = async (mode: 'create' | 'restore' | 'external', expected: string) => {
    await run(async () => {
      checkedConfig(config);
      invalidate(); const version = epoch.current;
      const controller = new AbortController(); abort.current = controller;
      const guard = () => { controller.signal.throwIfAborted(); if (epoch.current !== version) throw new Error('Sign-in cancelled'); };
      await api('/api/auth/logout', {}); guard();
      let next: Wallet | undefined;
      try {
        if (mode === 'external') {
          const provider = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
          if (!provider) throw new Error('No browser wallet found. You can use a passkey instead.');
          const addresses = await provider.request({ method: 'eth_requestAccounts' }); guard();
          if (!addresses[0]) throw new Error('No account selected');
          next = { address: addresses[0], provider, end: () => {} };
        } else next = await openPasskey(mode, expected, controller.signal);
        guard(); await checkWallet(config, next); guard();
        const nonce = await api('/api/auth/nonce'); guard();
        if (nonce.domain !== window.location.host || nonce.uri !== window.location.origin || nonce.chainId !== config.chainId) throw new Error('The login challenge does not match this site or network.');
        const text = createSiweMessage({ domain: nonce.domain, uri: nonce.uri, address: next.address, version: '1', chainId: nonce.chainId, nonce: nonce.nonce, statement: nonce.statement, issuedAt: new Date(nonce.issuedAt), expirationTime: new Date(nonce.expirationTime) });
        setMessage('Confirm the login signature. It does not authorize deductions.');
        const { walletClient } = clients(config, next);
        const signature = await walletClient!.signMessage({ message: text }); guard();
        const result = await api('/api/auth/verify', { message: text, signature }); guard();
        if (result.wallet?.toLowerCase() !== next.address.toLowerCase()) throw new Error('Server session address mismatch');
        walletRef.current = next; setWallet(next); setMessage('Account verified. Each financial action still requires separate confirmation.');
        try { localStorage.setItem('rentbond.original-address', next.address); } catch { /* Public address only. */ }
        try {
          const saved = JSON.parse(sessionStorage.getItem(RECEIPT_KEY) ?? 'null') as ReceiptRecord | null;
          if (saved?.address.toLowerCase() === next.address.toLowerCase() && saved.chainId === config.chainId && /^0x[\da-f]{64}$/i.test(saved.hash)) setReceipt(saved);
        } catch { /* Malformed public transaction metadata is ignored. */ }
      } catch (error) { next?.end(); void api('/api/auth/logout', {}).catch(() => {}); throw error; }
    });
  };
  useEffect(() => {
    const provider = wallet?.provider as (EIP1193Provider & { on?: (e: string, f: () => void) => void; removeListener?: (e: string, f: () => void) => void }) | undefined;
    const changed = () => { logout(); setMessage('Wallet account or network changed. Please sign in again.'); };
    provider?.on?.('accountsChanged', changed); provider?.on?.('chainChanged', changed);
    const timer = wallet ? window.setTimeout(logout, 15 * 60 * 1000) : undefined;
    return () => { clearTimeout(timer); provider?.removeListener?.('accountsChanged', changed); provider?.removeListener?.('chainChanged', changed); };
  }, [wallet, logout]);
  useEffect(() => () => { abort.current?.abort(); walletRef.current?.end(); }, []);
  useEffect(() => { if (pending) dialog.current?.showModal(); else dialog.current?.close(); }, [pending]);
  const propose = (action: Action) => {
    if (!walletRef.current || pending || receipt) throw new Error('Sign in and resolve the current pending transaction first.');
    actionData(action); setPending(action);
  };
  const pollReceipt = async (record: ReceiptRecord, version: number) => {
    const { publicClient } = clients(config);
    if (await publicClient.getChainId() !== config.chainId) throw new Error('RPC network mismatch');
    const result = await publicClient.waitForTransactionReceipt({ hash: record.hash, confirmations: config.confirmations, timeout: 60000,
      onReplaced: ({ transaction, reason }) => {
        record = { ...record, hash: transaction.hash };
        if (epoch.current !== version) return;
        sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(record)); setReceipt(record);
        setMessage(reason === 'cancelled' ? 'The wallet submitted a cancellation. Waiting for confirmation.' : 'Transaction replaced. Checking the actual operation.');
      },
    });
    if (epoch.current !== version) return;
    const actual = await publicClient.getTransaction({ hash: result.transactionHash });
    if (epoch.current !== version) return;
    const same = actual.from.toLowerCase() === record.address.toLowerCase() && actual.to?.toLowerCase() === record.to.toLowerCase() && actual.input === record.data && actual.value === 0n;
    sessionStorage.removeItem(RECEIPT_KEY); setReceipt(null);
    if (result.status !== 'success' || !same) { setMessage(same ? 'Transaction reverted. The operation was not completed.' : 'A replacement or cancellation was confirmed. The original operation was not completed.'); setUpdated(n => n + 1); return; }
    setMessage(`${record.title}: confirmed on-chain. Refreshing the current state.`);
    if (record.factory && record.leaseId) {
      // Preserve an attachment retry after successful deployment; never redeploy on API failure.
      sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(record)); setReceipt(record);
      await request(`/api/leases/${record.leaseId}/deployment`, { transactionHash: result.transactionHash });
      sessionStorage.removeItem(RECEIPT_KEY); setReceipt(null);
    }
    setUpdated(n => n + 1);
  };
  const confirm = () => run(async () => {
    const action = pending, active = walletRef.current, version = epoch.current;
    if (!action || !active) return;
    const guard = () => { if (epoch.current !== version || walletRef.current !== active) throw new Error('Account changed. Signing was stopped'); };
    await checkWallet(config, active); guard();
    const session = await request('/api/auth/session'); guard();
    if (session.wallet.toLowerCase() !== active.address.toLowerCase()) throw new Error('Session address mismatch');
    const { publicClient, walletClient } = clients(config, active);
    const simulated = await publicClient.simulateContract({ address: action.address, abi: actionAbi(action), functionName: action.functionName, args: action.args, account: active.address }); guard();
    setMessage('Confirm signing on your device. Rejecting stops this operation.');
    const hash = await walletClient!.writeContract(simulated.request);
    const record: ReceiptRecord = { hash, address: active.address, chainId: config.chainId, to: action.address, data: actionData(action), title: action.title, leaseId: action.leaseId, factory: action.kind === 'factory' };
    // A submitted transaction remains real even if the account changes during wallet UI.
    try { sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(record)); } catch { /* Hash remains visible below. */ }
    if (epoch.current !== version) return;
    setPending(null); setReceipt(record); setMessage('Submitted, awaiting on-chain confirmation. Do not send again.');
    await pollReceipt(record, version);
  });
  return <Context.Provider value={{ config, wallet, generation, busy, message, login, logout, cancelLogin: () => { abort.current?.abort(); }, request, propose, run, updated }}>
    {children}
    <div className="live-status" role="status">{message}{receipt && <div><code>{receipt.hash}</code><button className="btn" disabled={busy || !wallet} onClick={() => void run(() => pollReceipt(receipt, epoch.current))}>Check confirmation / recover record</button><p>A pending status or lookup timeout is not a failure. Keep the transaction hash and restore the same account to check again.</p></div>}</div>
    <dialog ref={dialog} className="live-dialog" onCancel={e => { if (busy) e.preventDefault(); else setPending(null); }}>
      {pending && <><h2>{pending.title}</h2><p>{pending.explanation}</p><p>Test assets have no cash value. Confirm to request your signature. A successful simulation is not a confirmed transaction.</p><details><summary>Verify this operation</summary><p>Account: {wallet?.address}</p><p>Target: {pending.address}</p><p>Method: {pending.functionName}</p><pre>{JSON.stringify(pending.args, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2)}</pre></details><div className="actions"><button autoFocus className="btn" disabled={busy} onClick={() => setPending(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>Confirm & request signature</button></div></>}
    </dialog>
  </Context.Provider>;
}
export function useLive() { const value = useContext(Context); if (!value) throw new Error('LiveProvider missing'); return value; }
