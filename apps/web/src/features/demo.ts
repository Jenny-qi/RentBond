/** Explicit in-memory UI fixture simulator. NEVER imported by a chain adapter. */
import { assertAccounting, STEP, UNIT } from '@rentbond/shared';
import type { Action, Lease, Role, Case } from './model';
const DAY = 86400;
export const scenarios = { review:'核心拆分 · 700 / 100 / 200', claims:'申报期 · 尚未分配', funding:'条款与存入', active:'入住与交接', primary:'主处理阶段', proposed:'主结果挑战期', mature:'主结果已到生效时间', fallback:'备用处理阶段', exit:'等待超时退出', expired:'最终退出期限已到' };
export type Scenario = keyof typeof scenarios;
export function fixture(scenario: Scenario = 'review', now = Math.floor(Date.now()/1000)): Lease {
  const lease: Lease = {
    id:'alice-001', title:'Alice 的远程退租', stage:'ClaimsReview', deposit:'1000000000', revision:1,
    accounting:{ fundedAmount:'1000000000', unallocated:'200000000', tenantCredit:'700000000', landlordCredit:'100000000', tenantWithdrawn:'0',landlordWithdrawn:'0' },
    leaseEndAt:now-8*DAY, hardEndAt:now+29*DAY, claimDeadline:now-DAY,responseDeadline:now+6*DAY,acceptDeadline:now+7*DAY,
    accepted:true, approved:true, claimsSubmitted:true,
    claims:[{id:0,title:'退租清洁',amount:'100000000',reason:'退租时厨房清洁未达到双方约定的交接标准，需安排额外清洁。',clause:'条款 4.1 · 清洁',evidence:'清洁报价（虚构）',status:'Allocated'},
      {id:1,title:'桌面划痕',amount:'200000000',reason:'房东认为书桌表面划痕发生于租期内，租客认为入住清单已记录。',clause:'条款 4.2 · 损坏',evidence:'入住清单 v1 / 退租清单 v1',status:'Disputed'}],
    evidence:[{id:'move-in',name:'入住清单',stage:'入住',author:'tenant',version:1,state:'accepted',description:'书桌右上角有旧划痕，双方已在虚构清单中记录。',createdAt:now-90*DAY},
      {id:'move-out',name:'退租清单',stage:'退租',author:'landlord',version:1,state:'submitted',description:'房东提交的虚构交接说明，等待租客回应。',createdAt:now-8*DAY}],
    history:['虚构示例：双方已确认条款并存入 1,000 MockUSD','虚构示例：申报窗口关闭，700 / 100 / 200 拆分']
  };
  if (scenario==='funding') { lease.stage='AwaitingAcceptance';lease.accepted=false;lease.approved=false; lease.accounting={fundedAmount:'0',unallocated:'0',tenantCredit:'0',landlordCredit:'0',tenantWithdrawn:'0',landlordWithdrawn:'0'}; }
  if (scenario==='active' || scenario==='funding') { lease.claims=[];lease.claimsSubmitted=false;lease.leaseEndAt=now+30*DAY;lease.hardEndAt=lease.leaseEndAt+37*DAY; }
  if (scenario==='active') lease.stage='Active';
  if (scenario==='claims') {lease.stage='ClaimsOpen';lease.claimDeadline=now+DAY;lease.responseDeadline=now+8*DAY;lease.leaseEndAt=now-6*DAY;lease.hardEndAt=lease.leaseEndAt+37*DAY;lease.claims[0].status='Pending';lease.claims[1].status='Pending';}
  if (scenario==='active' || scenario==='claims') lease.accounting={...lease.accounting,unallocated:lease.deposit,tenantCredit:'0',landlordCredit:'0'};
  if (['primary','proposed','mature','fallback','exit','expired'].includes(scenario)) {
    lease.stage='ClaimCase';lease.responseDeadline=now-4*DAY;lease.claimDeadline=now-11*DAY;lease.leaseEndAt=now-18*DAY;lease.hardEndAt=lease.leaseEndAt+37*DAY;
    lease.case={id:'case-1',type:'CLAIMS',phase:'Primary',evidenceDeadline:now-DAY,primaryDeadline:now+6*DAY,challengeDeadline:0,fallbackStartAt:0,fallbackDeadline:0,timeoutAt:0};
    if(scenario==='proposed'||scenario==='mature') lease.case={...lease.case,phase:'Proposed',decision:'50000000',decisionReason:'虚构结果：旧划痕部分不支持，仅支持50 MockUSD。',challengeDeadline:scenario==='mature'?now-1:now+3*DAY};
    if(scenario==='fallback') lease.case={...lease.case,phase:'Fallback',fallbackStartAt:now-3*DAY,fallbackDeadline:now+4*DAY};
    if(scenario==='exit'){lease.stage='ExitPending';lease.case={...lease.case,phase:'ExitPending',fallbackStartAt:now-8*DAY,fallbackDeadline:now-DAY,timeoutAt:now+2*DAY};}
    if(scenario==='expired') lease.hardEndAt=now-1;
  }
  assertAccounting(lease.accounting);return lease;
}
function must(ok: unknown, message: string): asserts ok { if(!ok) throw new Error(message); }
function credit(l: Lease, t: bigint, r: bigint) {must(t>=0n&&r>=0n&&t+r<=BigInt(l.accounting.unallocated),'分配超过未分配余额');l.accounting.unallocated=(BigInt(l.accounting.unallocated)-t-r).toString();l.accounting.tenantCredit=(BigInt(l.accounting.tenantCredit)+t).toString();l.accounting.landlordCredit=(BigInt(l.accounting.landlordCredit)+r).toString();}
export function transition(input: Lease, role: Role, action: Action, now = Math.floor(Date.now()/1000)): Lease {
  const l=structuredClone(input);const a=l.accounting;const party=role==='tenant'||role==='landlord';
  if(now>=l.hardEndAt) must(['expire','withdraw'].includes(action.type),'已到最终期限，只可退出和领取');
  const funded=BigInt(a.fundedAmount)>0n;
  if(!['accept','approve','revokeApproval','fund','cancel'].includes(action.type)) must(funded,'尚未存入押金');
  if(['Closed','Cancelled'].includes(l.stage)) throw new Error('租约已结束');
  switch(action.type){
    case 'accept':must(role==='tenant'&&l.stage==='AwaitingAcceptance'&&now<l.acceptDeadline,'当前无法确认条款');l.accepted=true;l.stage='AwaitingFunding';break;
    case 'approve':must(role==='tenant'&&l.stage==='AwaitingFunding'&&now<l.acceptDeadline,'当前无法授权');l.approved=true;break;
    case 'revokeApproval':must(role==='tenant'&&!funded,'当前无法撤销授权');l.approved=false;break;
    case 'fund':must(role==='tenant'&&l.stage==='AwaitingFunding'&&l.accepted&&l.approved&&now<l.acceptDeadline,'须先确认条款及精确授权');a.fundedAmount=l.deposit;a.unallocated=l.deposit;l.stage='Active';break;
    case 'cancel':must(party&&!funded,'仅入金前双方可取消');l.stage='Cancelled';break;
    case 'startScheduled':must(['Active','CheckoutRequested'].includes(l.stage)&&now>=l.leaseEndAt,'尚未到约定结算时间');l.stage='ClaimsOpen';l.claimDeadline=l.leaseEndAt+7*DAY;l.responseDeadline=l.claimDeadline+7*DAY;break;
    case 'checkout':must(party&&l.stage==='Active'&&now<l.leaseEndAt&&action.date<=now&&action.evidence.trim(),'请填写有效交接日期和材料');l.stage='CheckoutRequested';l.checkoutBy=role;break;
    case 'checkoutRespond':must(party&&l.stage==='CheckoutRequested'&&l.checkoutBy!==role,'须由另一方回应');if(action.agree){l.stage='ClaimsOpen';l.claimDeadline=Math.min(now,l.leaseEndAt)+7*DAY;l.responseDeadline=l.claimDeadline+7*DAY;}else {l.history.push('交接存在异议，等待正式 CHECKOUT 接口或预定日期；未分配资金');}break;
    case 'claims':must(role==='landlord'&&l.stage==='ClaimsOpen'&&now<l.claimDeadline&&!l.claimsSubmitted,'只允许期限内提交一次清单');must(action.claims.length>0&&action.claims.length<=10,'最多10项');must(action.claims.every(c=>BigInt(c.amount)>0n&&BigInt(c.amount)%STEP===0n&&c.reason.length>=20&&c.reason.length<=2000&&c.clause&&c.evidence),'请补齐金额、条款、证据依据及20—2000字理由');must(action.claims.reduce((s,c)=>s+BigInt(c.amount),0n)<=BigInt(l.deposit),'扣款合计超过押金');l.claims=action.claims.map((c,i)=>({...c,id:i,status:'Pending'}));l.claimsSubmitted=true;break;
    case 'respond':{must(role==='tenant'&&['ClaimsOpen','ClaimsReview'].includes(l.stage)&&now<l.responseDeadline,'回应期已结束或身份不符');const c=l.claims.find(c=>c.id===action.id);must(c&&['Pending','Disputed'].includes(c.status),'该项目不可再回应');must(action.accept||action.reason.trim(),'请输入异议理由');c.status=action.accept?'Accepted':'Disputed';if(action.accept&&l.stage==='ClaimsReview'){credit(l,0n,BigInt(c.amount));c.status='Allocated';}break;}
    case 'waive':{must(role==='landlord'&&['ClaimsOpen','ClaimsReview'].includes(l.stage),'案件中不能普通撤回');const c=l.claims.find(c=>c.id===action.id);must(c&&c.status!=='Allocated'&&c.status!=='Waived','不可撤回');c.status='Waived';if(l.stage==='ClaimsReview'){credit(l,BigInt(c.amount),0n);c.status='Allocated';}break;}
    case 'closeClaims':must(l.stage==='ClaimsOpen'&&now>=l.claimDeadline,'申索窗口未关闭');credit(l,BigInt(l.deposit)-l.claims.reduce((s,c)=>s+BigInt(c.amount),0n),0n);for(const c of l.claims){if(c.status==='Accepted')credit(l,0n,BigInt(c.amount));else if(c.status==='Waived')credit(l,BigInt(c.amount),0n);else continue;c.status='Allocated';}l.stage='ClaimsReview';break;
    case 'openCase':must(l.stage==='ClaimsReview'&&now>=l.responseDeadline&&BigInt(a.unallocated)>0n,'未到开案条件');l.stage='ClaimCase';l.case={id:`case-${l.revision}`,type:'CLAIMS',phase:'Evidence',evidenceDeadline:l.responseDeadline+3*DAY,primaryDeadline:l.responseDeadline+10*DAY,challengeDeadline:0,fallbackStartAt:0,fallbackDeadline:0,timeoutAt:0};break;
    case 'decision':{const c=l.case;must(c&&l.stage==='ClaimCase','没有有效案件');const primary=role==='primary'&&['Evidence','Primary'].includes(c.phase)&&now>=c.evidenceDeadline&&now<c.primaryDeadline;const fallback=role==='fallback'&&c.phase==='Fallback'&&now>=c.fallbackStartAt+2*DAY&&now<c.fallbackDeadline;must(primary||fallback,'不是当前处理人或不在处理窗口');must(action.reason.trim().length>=20,'请填写至少20字处理理由');const remaining=l.claims.filter(item=>!['Allocated','Waived'].includes(item.status));must(action.amounts.length===remaining.length,'结果必须覆盖全部未分配项目');let amount=0n;for(let i=0;i<remaining.length;i++){const item=action.amounts[i];const n=BigInt(item.landlordShare);must(item.id===remaining[i].id&&n>=0n&&n<=BigInt(remaining[i].amount)&&n%STEP===0n,'项目顺序、上限或精度错误');amount+=n;}must(amount<=BigInt(a.unallocated),'处理金额越界');c.decision=amount.toString();c.decisionReason=action.reason;if(primary){c.phase='Proposed';c.challengeDeadline=Math.min(now+3*DAY,l.hardEndAt);}else{credit(l,BigInt(a.unallocated)-amount,amount);c.phase='Finalized';}break;}
    case 'challenge':must(party&&l.case?.phase==='Proposed'&&now<l.case.challengeDeadline,'挑战窗口已关闭');l.case.phase='Fallback';l.case.fallbackStartAt=now;l.case.fallbackDeadline=Math.min(now+7*DAY,l.hardEndAt);l.case.decision=undefined;break;
    case 'escalate':must(l.case&&['Evidence','Primary'].includes(l.case.phase)&&now>=l.case.primaryDeadline,'主处理未超时');l.case.phase='Fallback';l.case.fallbackStartAt=l.case.primaryDeadline;l.case.fallbackDeadline=Math.min(l.case.primaryDeadline+7*DAY,l.hardEndAt);break;
    case 'finalize':must(l.case?.phase==='Proposed'&&now>=l.case.challengeDeadline,'主结果尚未生效或已被挑战');credit(l,BigInt(a.unallocated)-BigInt(l.case.decision!),BigInt(l.case.decision!));l.case.phase='Finalized';break;
    case 'serviceTimeout':must(l.case?.phase==='Fallback'&&now>=l.case.fallbackDeadline,'备用服务未到截止');l.case.phase='ExitPending';l.case.timeoutAt=Math.min(l.case.fallbackDeadline+3*DAY,l.hardEndAt);l.stage='ExitPending';break;
    case 'timeout':must(l.case?.phase==='ExitPending'&&now>=l.case.timeoutAt,'尚未到退出日期');credit(l,BigInt(a.unallocated),0n);l.case.phase='Finalized';break;
    case 'expire':must(now>=l.hardEndAt&&BigInt(a.unallocated)>0n,'未到最终期限或已分配');for(const c of l.claims){if(c.status==='Accepted'){credit(l,0n,BigInt(c.amount));c.status='Allocated';}}if(l.case?.phase==='Proposed'&&now>=l.case.challengeDeadline){credit(l,BigInt(a.unallocated)-BigInt(l.case.decision!),BigInt(l.case.decision!));}credit(l,BigInt(a.unallocated),0n);if(l.case)l.case.phase='Finalized';l.settlement=undefined;break;
    case 'withdraw':{must(party,'只能领取当事人余额');const key=role==='tenant'?'tenantCredit':'landlordCredit';const paid=role==='tenant'?'tenantWithdrawn':'landlordWithdrawn';must(BigInt(a[key])>0n,'没有可领取余额');a[paid]=(BigInt(a[paid])+BigInt(a[key])).toString();a[key]='0';break;}
    case 'settle':must(party&&BigInt(a.unallocated)>0n&&action.validUntil>now&&action.validUntil<=Math.min(l.hardEndAt,l.case?.timeoutAt||l.hardEndAt),'和解不在有效期限');must(BigInt(action.tenantShare)+BigInt(action.landlordShare)===BigInt(a.unallocated)&&[action.tenantShare,action.landlordShare].every(v=>BigInt(v)>=0n&&BigInt(v)%STEP===0n),'两方金额须等于未分配余额');l.settlement={by:role,tenantShare:action.tenantShare,landlordShare:action.landlordShare,revision:l.revision+1,validUntil:action.validUntil};break;
    case 'confirmSettlement':must(party&&l.settlement&&l.settlement.by!==role&&l.settlement.revision===l.revision&&now<l.settlement.validUntil&&now<Math.min(l.hardEndAt,l.case?.timeoutAt||l.hardEndAt),'提案失效或须另一方确认');credit(l,BigInt(l.settlement.tenantShare),BigInt(l.settlement.landlordShare));l.settlement=undefined;if(l.case)l.case.phase='Finalized';break;
    case 'evidence':must(party&&action.name.trim()&&action.description.trim(),'请填写材料名称及说明');l.evidence.push({id:`doc-${l.revision}`,name:action.name,stage:action.stage,author:role,version:1,state:'saved',description:action.description,createdAt:now});break;
    case 'submitEvidence':{const e=l.evidence.find(e=>e.id===action.id);must(e&&e.author===role&&e.state==='saved','只能提交自己保存的版本');e.state='submitted';break;}
    case 'ackEvidence':{const e=l.evidence.find(e=>e.id===action.id);must(party&&e&&e.author!==role&&e.state==='submitted','只能回应另一方已提交版本');e.state=action.agree?'accepted':'disputed';break;}
  }
  if(funded&&BigInt(a.unallocated)===0n&&l.stage!=='Cancelled') {l.stage=BigInt(a.tenantCredit)+BigInt(a.landlordCredit)===0n?'Closed':'Allocated';}
  l.revision++;l.history.push(`虚构操作：${action.type} · ${new Date(now*1000).toISOString()}`);assertAccounting(a);return l;
}
