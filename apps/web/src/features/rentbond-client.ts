/** Proposed client DTOs for D's documented routes, not an implemented backend. */
import {validateDeposit} from '@rentbond/shared';
import {api} from './api';
export type DraftInput={title:string;depositAmount:string;leaseEndAt:number;serviceProfileId:string;version?:number};
export function createDraft(input:DraftInput){
 validateDeposit(BigInt(input.depositAmount));
 if(!input.title.trim()||!input.serviceProfileId||input.leaseEndAt<=Date.now()/1000)throw new Error('草稿字段不完整或日期无效');
 return api<{draftId:string;version:number}>('/api/leases/drafts',{method:'POST',body:JSON.stringify(input)});
}
export function claimInvite(token:string){return api<{draftId:string;version:number}>(`/api/invites/${encodeURIComponent(token)}/claim`,{method:'POST',body:'{}'});}
export function requestExport(leaseId:string){return api<{jobId:string;status:'queued'}>('/api/exports',{method:'POST',body:JSON.stringify({leaseId})});}
export function requestTestGas(leaseId:string){return api<{status:'queued'|'limited';requestId:string}>('/api/test-gas/request',{method:'POST',body:JSON.stringify({leaseId})});}
export function uploadIntent(file:File,leaseId:string){
 if(!['image/jpeg','image/png','application/pdf'].includes(file.type)||file.size>10*1024*1024)throw new Error('文件类型或大小不符合要求');
 return api<{documentId:string;uploadUrl:string}>('/api/documents/upload-intent',{method:'POST',body:JSON.stringify({leaseId,name:file.name,type:file.type,size:file.size,purpose:'evidence'})});
}
// No arbitrary remote upload or wallet call is made from this DTO layer.
