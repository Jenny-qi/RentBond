import type { Row } from "./db.ts";

// Public permissionless advances only. No user decisions, approvals or withdrawals.
export const workerActions = {
  START_SETTLEMENT: { fn: "startScheduledSettlement", field: "leaseEndAt", area: "terms", case: false },
  CLOSE_CLAIMS: { fn: "closeClaims", field: "claimDeadline", area: "schedule", case: false },
  OPEN_CLAIM_CASE: { fn: "openClaimCase", field: "responseDeadline", area: "schedule", case: false },
  ESCALATE_TIMEOUT: { fn: "escalateTimeout", field: "primaryDeadline", area: "activeCase", case: true },
  FINALIZE_PRIMARY: { fn: "finalizePrimary", field: "challengeDeadline", area: "activeCase", case: true },
  MARK_SERVICE_TIMEOUT: { fn: "markServiceTimeout", field: "fallbackDeadline", area: "activeCase", case: true },
  FINALIZE_TIMEOUT: { fn: "finalizeTimeout", field: "timeoutAt", area: "activeCase", case: true },
  EXPIRE_ESCROW: { fn: "expireEscrow", field: "hardEndAt", area: "terms", case: false },
} as const;
export type WorkerKind = keyof typeof workerActions;

export function actionDeadline(snapshot: Row, kind: WorkerKind): string {
  const action = workerActions[kind];
  return String(snapshot[action.area]?.[action.field] ?? "0");
}

/** Candidates are derived from a confirmed snapshot, not mutable event payloads. */
export function plannedActions(snapshot: Row): Array<{ kind: WorkerKind; dueAt: string; caseId?: string }> {
  const { phase, terms, accounting, schedule, activeCase: active } = snapshot;
  if (BigInt(accounting.fundedAmount) === 0n || [9, 10, 11].includes(Number(phase))) return [];
  const result: Array<{ kind: WorkerKind; dueAt: string; caseId?: string }> = [];
  const add = (kind: WorkerKind) => {
    const dueAt = actionDeadline(snapshot, kind);
    if (BigInt(dueAt) > 0n) result.push({ kind, dueAt,
      ...(workerActions[kind].case ? { caseId: String(active.caseId) } : {}) });
  };
  // The fixed hard end supersedes every ordinary advance, including overdue cases.
  if (BigInt(accounting.unallocated) > 0n) add("EXPIRE_ESCROW");
  if (BigInt(snapshot.chainTime) >= BigInt(terms.hardEndAt)) return result;
  if ([2, 3, 4].includes(Number(phase)) && !schedule.started) add("START_SETTLEMENT");
  if (Number(phase) === 5) add("CLOSE_CLAIMS");
  if (Number(phase) === 6 && BigInt(accounting.unallocated) > 0n) add("OPEN_CLAIM_CASE");
  if (active.exists && [4, 7, 8].includes(Number(phase))) {
    // CHECKOUT cases expire at leaseEndAt. Scheduled settlement takes over.
    if (Number(active.caseType) === 1 && BigInt(snapshot.chainTime) >= BigInt(terms.leaseEndAt)) return result;
    const kind = ({ 1: "ESCALATE_TIMEOUT", 2: "FINALIZE_PRIMARY", 3: "MARK_SERVICE_TIMEOUT", 4: "FINALIZE_TIMEOUT" } as const)[Number(active.phase) as 1 | 2 | 3 | 4];
    if (kind && (kind !== "FINALIZE_TIMEOUT" || Number(active.caseType) === 2)) add(kind);
  }
  return result;
}

export function actionMatches(job: Row, snapshot: Row): boolean {
  return plannedActions(snapshot).some((a) => a.kind === job.kind &&
    a.dueAt === String(job.due_at) && (a.caseId ?? null) === (job.case_id === null ? null : String(job.case_id)));
}
