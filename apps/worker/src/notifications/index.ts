/**
 * Notification service — email/SMS reminders (P1).
 *
 * Currently a placeholder. The contract drives deadlines;
 * notifications are informational only and non-blocking.
 *
 * E owns; D collaborates on event table and task persistence.
 */

export interface NotificationPayload {
  recipientAddress: string;
  type: 'CLAIMS_WINDOW_CLOSING' | 'DISPUTE_REQUIRES_ACTION' | 'FUNDS_READY_TO_CLAIM';
  leaseId: string;
  /** ISO timestamp */
  sentAt?: string;
}

/** Placeholder — implement after RB-08 / P1 mail provider decision */
export async function sendNotification(_payload: NotificationPayload): Promise<void> {
  console.warn('[NOTIFICATION] sendNotification not implemented — P1 after RB-08');
}
