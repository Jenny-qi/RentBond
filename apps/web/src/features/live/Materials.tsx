'use client';
import { useState } from 'react';
import type { Address } from 'viem';
import { useLive } from './LiveProvider';
import type { Data } from './client';
import { Files, Form } from './ui';
export function Materials({ data, caseId, refresh }: { data: Data; caseId?: string; refresh: () => void }) {
  const { request, propose, run, busy, wallet } = useLive();
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<Data | null>(null);
  const [prepared, setPrepared] = useState<Data | null>(null);
  const leaseId = data.leaseId ?? data.id;
  const submitBundle = (bundle: Data) => propose({ title: `Submit bundle version ${bundle.manifest.version}`, explanation: 'Record the commitment for this version. This does not prove that a photo or statement is true.', address: data.contractAddress as Address, functionName: 'recordEvidence', args: bundle.transaction.args });
  return <section>
    <Form title="Upload private materials / add a version" fields={[{ name: 'purpose', label: 'Purpose', options: caseId ? [{ value: 'case', label: 'Current case' }] : ['terms', 'move-in', 'repair', 'move-out', 'claim'].map(value => ({ value, label: ({ terms: 'Terms', 'move-in': 'Move-in', repair: 'Repair', 'move-out': 'Move-out', claim: 'Claim' } as Record<string, string>)[value] })) }, { name: 'documentId', label: 'Original document ID (leave blank for a new file; approvals do not carry over)', required: false }]} submit="Upload & finalize this file version" onSubmit={async v => {
      if (!file || file.size > 10485760 || !['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) throw new Error('Select a PNG, JPEG or PDF up to 10 MB.');
      const bytes = await file.arrayBuffer();
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
      const intent = await request('/api/documents/upload-intent', { leaseId, purpose: v.purpose, mime: file.type, size: file.size, sha256, ...(v.documentId ? { documentId: v.documentId } : {}), ...(caseId ? { caseId } : {}) });
      if (!intent.uploadUrl.startsWith('/api/documents/')) throw new Error('Invalid upload URL');
      const response = await fetch(intent.uploadUrl, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': file.type }, body: bytes });
      if (!response.ok) throw new Error('Upload failed. This version has not been submitted.');
      const result = await request(`/api/documents/${intent.documentId}/submit`, { uploadId: intent.uploadId });
      setUploaded({ ...result, documentId: intent.documentId, version: intent.version }); refresh();
    }}><label className="field">Choose a file<input type="file" accept="image/png,image/jpeg,application/pdf" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></label><p>Upload fictional test materials only. Saved files must be included in an evidence bundle and explicitly submitted by their author.</p></Form>
    {uploaded && <p>Saved document {uploaded.documentId} · Version {uploaded.version}. Reference this version below.</p>}
    <Form key={uploaded ? `${uploaded.documentId}/${uploaded.version}` : 'bundle'} title="Submit an evidence bundle" fields={[{ name: 'stage', label: 'Stage', options: caseId ? [{ value: 'case', label: 'Evidence for this case' }] : [{ value: 'move-in', label: 'Move-in' }, { value: 'repair', label: 'Repair' }, { value: 'move-out', label: 'Move-out' }] }, { name: 'roomKey', label: 'Room / item' }, { name: 'description', label: 'Condition description', type: 'textarea' }, { name: 'documentId', label: 'Document ID', value: uploaded?.documentId }, { name: 'version', label: 'File version', type: 'number', value: String(uploaded?.version ?? 1) }, { name: 'capturedAt', label: 'Declared capture time (optional)', type: 'datetime-local', required: false }, { name: 'bundleId', label: 'Existing bundle ID (optional, for a new version)', required: false }]} submit="Save bundle & review on-chain submission" onSubmit={async v => {
      const result = await request(caseId ? `/api/cases/${caseId}/evidence` : '/api/inspections', { leaseId, stage: v.stage, ...(v.bundleId ? { bundleId: v.bundleId } : {}), items: [{ roomKey: v.roomKey, description: v.description, documents: [{ documentId: v.documentId, version: Number(v.version) }], ...(v.capturedAt ? { capturedAt: new Date(v.capturedAt).getTime() } : {}) }] });
      setPrepared(result); submitBundle(result);
    }} />
    {prepared && <button className="btn" disabled={busy} onClick={() => void run(async () => submitBundle(prepared))}>Continue submitting the saved bundle</button>}
    <Files documents={data.documents ?? []} caseId={caseId} />
    {(data.bundles ?? []).filter((b: Data) => b.onChain && !b.acknowledged && b.manifest.author?.toLowerCase() !== wallet?.address.toLowerCase()).map((b: Data) => <div className="glass glass-pad" key={b.id}><p>Respond to bundle {b.manifest.bundleId} Version {b.manifest.version}</p>{[true, false].map(agree => <button className="btn" disabled={busy} key={String(agree)} onClick={() => void run(async () => propose({ title: agree ? 'Acknowledge this evidence version' : 'Dispute this evidence version', explanation: 'Respond to this exact version only. Future versions will require a new response.', address: data.contractAddress, functionName: 'acknowledgeEvidence', args: [b.manifest.author, BigInt(b.manifest.version), b.manifest.bundleId, b.commitment, agree] }))}>{agree ? 'Agree with this version' : 'Dispute this version'}</button>)}</div>)}
    <Form title="Append a withdrawal note" fields={[{ name: 'bundleId', label: 'Your evidence bundle ID' }, { name: 'version', label: 'Bundle version', type: 'number' }, { name: 'reason', label: 'Withdrawal note (at least 20 characters)', type: 'textarea', minLength: 20 }]} submit="Append note and preserve originals" onSubmit={async v => { await request(`/api/leases/${leaseId}/statements`, { kind: 'evidence-withdrawal', bundleId: v.bundleId, version: Number(v.version), reason: v.reason }); refresh(); }} />
  </section>;
}
