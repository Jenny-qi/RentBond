'use client';

import { useEffect, useRef } from 'react';
import { useTx } from '@/features/tx/TxProvider';

export function ConfirmDialog() {
  const { pending, phase, confirmSign, cancelSign } = useTx();
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pending || phase !== 'awaiting-signature') return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelSign();
      if (e.key === 'Tab') {
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [pending, phase, cancelSign]);

  if (!pending || phase !== 'awaiting-signature') return null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="glass dialog" ref={dialog}>
        <p className="kicker">需要你本人确认</p>
        <h2 id="confirm-title">{pending.title}</h2>
        <p>{pending.purpose}</p>
        <p><b>{pending.amountLabel}</b></p>
        <p className="help">{pending.stepLabel} 应用不会代签。取消、离开或会话失效后不会后台继续执行。</p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={cancelSign}>取消，不执行</button>
          <button type="button" className="btn btn-primary" onClick={confirmSign}>
            {pending.title}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TxStatusBar() {
  const { phase, hash, lastMessage, reset } = useTx();
  if (phase === 'idle' && !lastMessage) return null;
  const label =
    phase === 'awaiting-signature' ? '等待用户签署'
      : phase === 'submitted' ? '已提交'
        : phase === 'confirming' ? '等待链上确认'
          : phase === 'confirmed' ? '已确认（模拟）'
            : phase === 'failed' ? '已失败'
              : phase === 'cancelled' ? '已取消，未执行该操作'
                : '交易';
  return (
    <div className="stage tx-status" role="status" aria-live="polite" style={{ minHeight: 'auto', marginTop: 0, padding: '12px 22px' }}>
      <div className="row">
        <span>{label}{lastMessage ? ` · ${lastMessage}` : ''}</span>
        <span className="actions">
          {hash && (
            <span className="small muted">模拟编号 {hash.slice(0, 12)} · 无链上交易</span>
          )}
          <button type="button" className="btn" onClick={reset}>关闭</button>
        </span>
      </div>
    </div>
  );
}
