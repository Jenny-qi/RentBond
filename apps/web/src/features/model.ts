import type { Accounting } from '@rentbond/shared';
export type Role = 'tenant' | 'landlord' | 'primary' | 'fallback';
export const roleNames: Record<Role, string> = { tenant: '租客 Alice', landlord: '房东 Morgan', primary: '主处理人 Robin', fallback: '备用处理人 Taylor' };
export type Stage = 'AwaitingAcceptance' | 'AwaitingFunding' | 'Active' | 'CheckoutRequested' | 'ClaimsOpen' | 'ClaimsReview' | 'ClaimCase' | 'ExitPending' | 'Allocated' | 'Closed' | 'Cancelled';
export const stageNames: Record<Stage,string> = { AwaitingAcceptance:'等待确认条款',AwaitingFunding:'等待存入',Active:'租期内',CheckoutRequested:'等待交接回应',ClaimsOpen:'扣款申报期',ClaimsReview:'扣款回应期',ClaimCase:'争议处理中',ExitPending:'等待超时退出',Allocated:'分配完成',Closed:'全部领取完成',Cancelled:'已取消' };
export type Claim = { id: number; title: string; amount: string; reason: string; clause: string; evidence: string; status: 'Pending' | 'Accepted' | 'Disputed' | 'Waived' | 'Allocated' };
export type Evidence = { id: string; name: string; stage: string; author: Role; version: number; state: 'saved' | 'submitted' | 'accepted' | 'disputed'; description: string; createdAt: number };
export type Case = { id: string; type: 'CHECKOUT' | 'CLAIMS'; phase: 'Evidence' | 'Primary' | 'Proposed' | 'Fallback' | 'ExitPending' | 'Finalized'; evidenceDeadline: number; primaryDeadline: number; challengeDeadline: number; fallbackStartAt: number; fallbackDeadline: number; timeoutAt: number; decision?: string; decisionReason?: string };
export type Lease = {
  id: string; title: string; stage: Stage; deposit: string; accounting: Accounting; revision: number;
  leaseEndAt: number; hardEndAt: number; claimDeadline: number; responseDeadline: number; acceptDeadline: number;
  accepted: boolean; approved: boolean; claimsSubmitted: boolean; claims: Claim[]; evidence: Evidence[];
  case?: Case; checkoutBy?: Role; settlement?: { by: Role; tenantShare: string; landlordShare: string; revision: number; validUntil: number };
  history: string[];
};
export const claimNames = { Pending:'未回应', Accepted:'已认可', Disputed:'有异议', Waived:'已撤回', Allocated:'已分配' };
export type Action =
  | { type: 'accept' | 'approve' | 'revokeApproval' | 'fund' | 'cancel' | 'startScheduled' | 'closeClaims' | 'openCase' | 'challenge' | 'escalate' | 'finalize' | 'serviceTimeout' | 'timeout' | 'expire' | 'withdraw' | 'confirmSettlement' }
  | { type: 'respond'; id: number; accept: boolean; reason: string }
  | { type: 'waive'; id: number }
  | { type: 'claims'; claims: Claim[] }
  | { type: 'checkout'; date: number; evidence: string }
  | { type: 'checkoutRespond'; agree: boolean }
  | { type: 'decision'; amounts: {id:number;landlordShare:string}[]; reason: string }
  | { type: 'settle'; tenantShare: string; landlordShare: string; validUntil: number }
  | { type: 'evidence'; name: string; description: string; stage: string }
  | { type: 'submitEvidence' | 'ackEvidence'; id: string; agree?: boolean };
