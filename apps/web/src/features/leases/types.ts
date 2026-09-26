export type Role = 'TENANT' | 'LANDLORD' | 'RESOLVER' | 'FALLBACK';
export type AccountMethod = 'passkey' | 'external-wallet';
export type DataMode = 'MOCK_FIXTURE';

export type TxPhase =
  | 'idle'
  | 'awaiting-signature'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'failed'
  | 'cancelled';

export type AllocationMode = 'projected' | 'claimable' | 'withdrawn';

export type ClaimResponse = 'Pending' | 'Accepted' | 'Disputed' | 'Withdrawn';

export type EvidenceTag =
  | 'saved-unrecorded'
  | 'submitted'
  | 'acknowledged'
  | 'objected'
  | 'unilateral';

export interface Allocation {
  unallocated: string;
  tenantCredit: string;
  landlordCredit: string;
  tenantWithdrawn: string;
  landlordWithdrawn: string;
}

export interface ClaimDraftItem {
  id: number;
  category: string;
  categoryLabel: string;
  amountBaseUnits: string;
  reason: string;
  clauseRef: string;
  evidenceNote: string;
  response: ClaimResponse;
  disputeNote?: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  stage: 'move-in' | 'repair' | 'move-out';
  authorRole: Role;
  submittedAtLabel: string;
  capturedAtLabel: string;
  tag: EvidenceTag;
  version: number;
}

export interface DeadlineSet {
  leaseEndAtUtc: string;
  leaseEndAtLocal: string;
  claimDeadlineUtc: string;
  responseDeadlineUtc: string;
  primaryDeadlineUtc: string;
  fallbackDeadlineUtc: string;
  timeoutAtUtc: string;
  hardEndAtUtc: string;
  countdownHint: string;
  timingProfile: 'DEMO_SHORT' | 'NORMAL_TEST';
}

export interface AliceLease {
  decisionVector?: { id: number; award: string; reason: string }[];
  tenantAccepted: boolean;
  cancelled: boolean;
  workflow: 'unfunded' | 'active' | 'claims' | 'claim-deadline' | 'response-deadline' | 'case';
  proposalSequence: number;
  revision: number;
  demoStage: 'challenge' | 'primary-ready' | 'primary-timeout' | 'fallback' | 'timeout' | 'hard-end';
  primaryAward: string;
  decisionReason: string;
  proposal?: { id: number; tenantShare: string; landlordShare: string; proposer: Role; revision: number; validUntil: number };
  id: string;
  title: string;
  locationHint: string;
  statusLabel: string;
  depositBaseUnits: string;
  funded: boolean;
  approvedNotFunded: boolean;
  claimsSubmitted: boolean;
  claimsWindowClosed: boolean;
  caseOpened: boolean;
  primaryProposed: boolean;
  primaryEffective: boolean;
  challenged: boolean;
  settlementPhase: 'claims-open' | 'awaiting-close' | 'split' | 'primary-pending' | 'settled';
  nextAction: string;
  nextActor: Role;
  tenantAddress: string;
  landlordAddress: string;
  resolverAddress: string;
  fallbackAddress: string;
  contractAddress: string;
  termsHash: string;
  allocation: Allocation;
  allocationMode: AllocationMode;
  claims: ClaimDraftItem[];
  evidence: EvidenceItem[];
  deadlines: DeadlineSet;
  lastSyncedAt: string;
  chainReadFailed: boolean;
}

export const ALICE_LEASE_ID = 'alice-demo-001';

export const DEMO_ADDRESSES = {
  TENANT: '0xa11ce00000000000000000000000000000000001',
  LANDLORD: '0xb0b0000000000000000000000000000000000002',
  RESOLVER: '0x5e50c00000000000000000000000000000000003',
  FALLBACK: '0xfabac00000000000000000000000000000000004',
  CONTRACT: '0xde0051c000000000000000000000000000000005',
} as const;

export function createAliceLease(): AliceLease {
  return {
    tenantAccepted: true,
    cancelled: false,
    workflow: 'case',
    proposalSequence: 0,
    revision: 0,
    demoStage: 'challenge',
    primaryAward: '50000000',
    decisionReason: '虚构结果：对照入住与退租记录，桌面损坏项支持房东 50 MockUSD，其余归租客。',
    id: ALICE_LEASE_ID,
    title: 'Brooklyn 单间 · Alice 远程结算',
    locationHint: 'Brooklyn, New York, USA',
    statusLabel: '申索窗口已关闭 · 部分分配待领取',
    depositBaseUnits: '1000000000',
    funded: true,
    approvedNotFunded: false,
    claimsSubmitted: true,
    claimsWindowClosed: true,
    caseOpened: true,
    primaryProposed: true,
    primaryEffective: false,
    challenged: false,
    settlementPhase: 'split',
    nextAction: '领取无争议押金 700 MockUSD',
    nextActor: 'TENANT',
    tenantAddress: DEMO_ADDRESSES.TENANT,
    landlordAddress: DEMO_ADDRESSES.LANDLORD,
    resolverAddress: DEMO_ADDRESSES.RESOLVER,
    fallbackAddress: DEMO_ADDRESSES.FALLBACK,
    contractAddress: DEMO_ADDRESSES.CONTRACT,
    termsHash: '0x7e1e50000000000000000000000000000000000000000000000000000000a11ce',
    allocation: {
      unallocated: '200000000',
      tenantCredit: '700000000',
      landlordCredit: '100000000',
      tenantWithdrawn: '0',
      landlordWithdrawn: '0',
    },
    allocationMode: 'claimable',
    claims: [
      {
        id: 0,
        category: 'cleaning',
        categoryLabel: '清洁',
        amountBaseUnits: '100000000',
        reason:
          '退租后厨房与卫生间需专业清洁。对照入住清单，该费用依据租赁附件第 4.2 条可扣押金。无第三方发票，已标注“没有票据，但需说明依据”。',
        clauseRef: '附件 4.2 清洁标准',
        evidenceNote: '退租照片 bundle v2 · 无发票',
        response: 'Accepted',
      },
      {
        id: 1,
        category: 'desk_damage',
        categoryLabel: '桌面损坏',
        amountBaseUnits: '200000000',
        reason:
          '书桌台面有划痕。房东主张入住后新增损坏。租客主张该划痕已出现在入住清单照片中，属于原有状况。',
        clauseRef: '附件 6.1 物品损坏',
        evidenceNote: '入住照片 v1 与退租照片 v2',
        response: 'Disputed',
        disputeNote: '入住当天已拍摄该划痕，不属于本次损坏。',
      },
    ],
    evidence: [
      {
        id: 'ev-movein-desk',
        title: '书桌台面（入住）',
        stage: 'move-in',
        authorRole: 'TENANT',
        submittedAtLabel: '2025-08-01 14:12 UTC',
        capturedAtLabel: '2025-08-01 09:40 当地',
        tag: 'acknowledged',
        version: 1,
      },
      {
        id: 'ev-moveout-clean',
        title: '厨房清洁（退租）',
        stage: 'move-out',
        authorRole: 'LANDLORD',
        submittedAtLabel: '2026-01-02 18:03 UTC',
        capturedAtLabel: '2026-01-02 12:11 当地',
        tag: 'submitted',
        version: 2,
      },
      {
        id: 'ev-draft',
        title: '补充特写（未上链）',
        stage: 'move-out',
        authorRole: 'TENANT',
        submittedAtLabel: '—',
        capturedAtLabel: '2026-01-03 08:00 当地',
        tag: 'saved-unrecorded',
        version: 1,
      },
    ],
    deadlines: {
      leaseEndAtUtc: '2026-01-01 00:00 UTC',
      leaseEndAtLocal: '2025-12-31 19:00 EST',
      claimDeadlineUtc: '2026-01-04 00:00 UTC',
      responseDeadlineUtc: '2026-01-08 00:00 UTC',
      primaryDeadlineUtc: '2026-01-18 00:00 UTC',
      fallbackDeadlineUtc: '2026-01-25 00:00 UTC',
      timeoutAtUtc: '2026-01-28 00:00 UTC',
      hardEndAtUtc: '2026-02-07 00:00 UTC',
      countdownHint: '主结果挑战窗口仍开放（页面时钟仅作提示）',
      timingProfile: 'DEMO_SHORT',
    },
    lastSyncedAt: '2026-01-04 16:40 UTC（虚构同步时间）',
    chainReadFailed: false,
  };
}

export function createUnfundedLease(depositBaseUnits = '1000000000'): AliceLease {
  const lease = createAliceLease();
  return { ...lease, depositBaseUnits, tenantAccepted: false, funded: false,
    workflow: 'unfunded', claimsSubmitted: false, claimsWindowClosed: false,
    caseOpened: false, primaryProposed: false, primaryAward: '0', decisionReason: '',
    claims: [], evidence: [], deadlines: { ...lease.deadlines, countdownHint: '未入金演示阶段；上述日期为固定虚构参考，不使用当前系统时间放行操作' }, statusLabel: '等待条款确认（模拟）',
    nextAction: '先确认条款，再授权并存入', allocationMode: 'projected',
    allocation: { unallocated: '0', tenantCredit: '0', landlordCredit: '0', tenantWithdrawn: '0', landlordWithdrawn: '0' } };
}

export const RECENT_LEASES = [
  {
    id: 'liverpool-uk',
    city: 'Liverpool, UK',
    status: 'Partly settled',
    tenantCredit: '400000000',
    note: '虚构对照卡，非本账户租约',
  },
  {
    id: 'palermo-it',
    city: 'Palermo, Italy',
    status: '等待结算',
    tenantCredit: '0',
    note: '无权访问 · 仅展示空态样式',
  },
];
