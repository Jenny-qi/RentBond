'use client';
import { useState, type ReactNode, type FormEvent } from 'react';
import { useLive } from './LiveProvider';
import { json, type Data } from './client';
import { formatMockUsd, parseShareAmount } from '../../lib/money';
export const money = (value: unknown) => formatMockUsd(String(value ?? '0'));
export const units = (value: string, maximum = '10000000000') => { const result = parseShareAmount(value, maximum); if (!result.ok) throw new Error(result.error); return result.baseUnits; };
export const seconds = (value: string) => { const n = new Date(value).getTime() / 1000; if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Enter a valid date'); return n; };
export function DateText({ value }: { value: unknown }) { const n = Number(value); return <span>{n ? `${new Date(n * 1000).toLocaleString('en-GB')} (${new Date(n * 1000).toISOString()})` : 'Not started'}</span>; }
export interface Field { name: string; label: string; type?: string; value?: string; options?: { value: string; label: string }[]; minLength?: number; required?: boolean }
export function Form({ title, fields, submit, onSubmit, children, disabled = false }: { title: string; fields: Field[]; submit: string; onSubmit: (values: Record<string, string>) => Promise<void>; children?: ReactNode; disabled?: boolean }) {
  const { run, busy } = useLive();
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    const values = Object.fromEntries(Array.from(new FormData(form), ([k, v]) => [k, String(v)]));
    void run(async () => {
      for (const field of fields) {
        const value = values[field.name]?.trim() ?? '';
        if (field.required !== false && !value) throw new Error(`Required: ${field.label}`);
        if (value && field.minLength && value.length < field.minLength) throw new Error(`${field.label}: enter at least ${field.minLength} characters.`);
      }
      await onSubmit(values);
    });
  };
  return <form noValidate className="glass glass-pad live-form" onSubmit={handle}><h2>{title}</h2><fieldset disabled={busy || disabled}>{fields.map(f => <label className="field" key={f.name}><span>{f.label}</span>{f.options ? <select name={f.name} defaultValue={f.value} required={f.required !== false}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type === 'textarea' ? <textarea name={f.name} defaultValue={f.value} required={f.required !== false} minLength={f.minLength} rows={4} /> : <input name={f.name} type={f.type ?? 'text'} defaultValue={f.value} required={f.required !== false} minLength={f.minLength} />}</label>)}{children}<button className="btn btn-primary" type="submit">{submit}</button></fieldset></form>;
}
export function Details({ title, value }: { title: string; value: unknown }) { return <details className="live-details"><summary>{title}</summary><pre>{json(value)}</pre></details>; }
export function Files({ documents, caseId }: { documents: Data[]; caseId?: string }) {
  const { request, run, busy } = useLive();
  return <ul>{documents.map((d, i) => { const id = d.documentId ?? d.id, version = d.version; return <li key={`${id}-${version}-${i}`}>Document {id} · Version {version} <button className="btn" disabled={busy} onClick={() => void run(async () => { const r = await request(`/api/documents/${id}/access?version=${version}${caseId ? `&caseId=${caseId}` : ''}`); if (!r.url.startsWith('/api/files/')) throw new Error('Invalid download link'); window.location.assign(r.url); })}>Download original</button></li>; })}</ul>;
}
export function History({ data, caseId }: { data: Data; caseId?: string }) {
  return <section className="glass glass-pad"><h2>Evidence, reasons & history</h2>{(data.statements ?? []).map((s: Data) => <article key={s.id}><b>{s.manifest.kind} · {s.onChain ? 'Recorded on-chain' : 'Saved; awaiting submission by the author'}</b><p>{s.manifest.reason}</p>{s.manifest.reasons?.map((r: Data) => <p key={r.claimId}>Item {r.claimId}: landlord award {money(r.landlordAmount)}; {r.reason}</p>)}<Files documents={s.manifest.documents ?? []} caseId={caseId} /></article>)}{(data.claims ?? []).map((c: Data) => <article key={c.id}><b>Claim list · {c.onChain ? 'Recorded on-chain' : 'Private draft; not submitted on-chain'}</b>{c.manifest.items.map((item: Data) => <div key={item.commitment}><p>Item {item.manifest.claimId} · {money(item.manifest.amount)} · {item.manifest.category}</p><p>{item.manifest.reason}</p><p>Terms: {item.manifest.clause}</p><Files documents={item.manifest.documents ?? []} caseId={caseId} /></div>)}</article>)}{(data.bundles ?? []).map((b: Data) => <article key={b.id}><p>Bundle version {b.manifest.version} · {b.onChain ? 'Recorded on-chain' : 'Saved; awaiting on-chain submission'} · {b.acknowledged ? b.agreed ? 'Acknowledged by the other party' : 'Disputed by the other party' : 'No response from the other party'}</p>{b.manifest.items.map((item: Data, i: number) => <div key={i}><p>{item.roomKey}: {item.description}</p>{item.capturedAt && <p>Declared capture time {new Date(item.capturedAt).toLocaleString('en-GB')} (does not prove authenticity)</p>}<Files documents={item.documents} caseId={caseId} /></div>)}</article>)}<Details title="On-chain history & transaction hashes" value={data.events ?? []} /></section>;
}
export function ExportGas({ leaseId, caseId }: { leaseId: string; caseId?: string }) {
  const { request, run, busy } = useLive();
  const [job, setJob] = useState<Data | null>(null);
  const [gas, setGas] = useState<Data | null>(null);
  return <section className="glass glass-pad"><h2>Exports & test gas</h2><button className="btn" disabled={busy} onClick={() => void run(async () => setJob(await request('/api/exports', { leaseId, ...(caseId ? { caseId } : {}) })))}>Prepare a private export</button>{job && <div><p>Export status: {job.state} (download when ready)</p><button className="btn" disabled={busy} onClick={() => void run(async () => { const next = await request(`/api/exports/${job.id}`); setJob(next); if (next.state === 'ready') { const access = await request(`/api/exports/${job.id}/access`); if (!access.url.startsWith('/api/files/')) throw new Error('Invalid link'); window.location.assign(access.url); } })}>Check status & download</button></div>}<button className="btn" disabled={busy} onClick={() => void run(async () => setGas(await request('/api/test-gas/request', { leaseId })))}>Request limited test MON</button>{gas && <div><p>Gas request status: {gas.state} · Only confirmed means the transfer has completed</p><button className="btn" disabled={busy} onClick={() => void run(async () => setGas(await request(`/api/test-gas/requests/${gas.id}`)))}>Check gas request</button></div>}</section>;
}
