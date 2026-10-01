/**
 * Notification queue — durable JSON store with retry for email/SMS notifications.
 *
 * The actual send implementation (SMTP / SendGrid / Twilio) is injected at runtime.
 * This module provides the queue, persistence, deduplication, and retry scheduling.
 *
 * E owns; D collaborates on event table and task persistence.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPE = {
  CLAIMS_WINDOW_CLOSING: 'CLAIMS_WINDOW_CLOSING',
  DISPUTE_REQUIRES_ACTION: 'DISPUTE_REQUIRES_ACTION',
  FUNDS_READY_TO_CLAIM: 'FUNDS_READY_TO_CLAIM',
} as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
} as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

export interface NotificationPayload {
  recipientAddress: string;
  type: NotificationType;
  leaseId: string;
  /** ISO timestamp — set by sender */
  sentAt?: string;
}

export interface NotificationRecord {
  id: string;
  payload: NotificationPayload;
  status: NotificationStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;   // Unix ms — when to retry next
  createdAt: number;
  error?: string;
}

interface NotificationStore {
  notifications: Record<string, NotificationRecord>;
}

// ---------------------------------------------------------------------------
// Store persistence
// ---------------------------------------------------------------------------

async function loadStore(path: string): Promise<NotificationStore> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as NotificationStore;
  } catch {
    return { notifications: {} };
  }
}

async function saveStore(path: string, store: NotificationStore): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path + '.tmp', JSON.stringify(store, null, 2), 'utf-8');
  await rename(path + '.tmp', path);
}

// ---------------------------------------------------------------------------
// Queue operations
// ---------------------------------------------------------------------------

/**
 * Idempotent enqueue — skips if a PENDING/SENT/RETRYING notification with the
 * same (recipientAddress, type, leaseId) already exists.
 */
export async function enqueueNotification(
  storePath: string,
  payload: NotificationPayload,
  options: { maxAttempts?: number; id?: string } = {}
): Promise<{ enqueued: boolean; id: string }> {
  const store = await loadStore(storePath);
  const id = options.id ?? `${payload.recipientAddress}:${payload.type}:${payload.leaseId}:${Date.now()}`;

  // Deduplicate — don't re-enqueue if already in flight
  const existing = Object.values(store.notifications).find(
    (n) =>
      n.payload.recipientAddress === payload.recipientAddress &&
      n.payload.type === payload.type &&
      n.payload.leaseId === payload.leaseId &&
      (n.status === NOTIFICATION_STATUS.PENDING ||
        n.status === NOTIFICATION_STATUS.SENT ||
        n.status === NOTIFICATION_STATUS.RETRYING)
  );
  if (existing) {
    return { enqueued: false, id: existing.id };
  }

  store.notifications[id] = {
    id,
    payload: { ...payload, sentAt: new Date().toISOString() },
    status: NOTIFICATION_STATUS.PENDING,
    attempts: 0,
    maxAttempts: options.maxAttempts ?? 5,
    createdAt: Date.now(),
  };

  await saveStore(storePath, store);
  console.log(`[NOTIFICATIONS] Enqueued: ${id}`);
  return { enqueued: true, id };
}

/**
 * Mark a notification as sent. Idempotent — safe to call multiple times.
 */
export async function markSent(
  storePath: string,
  id: string
): Promise<void> {
  const store = await loadStore(storePath);
  const record = store.notifications[id];
  if (!record) return;
  record.status = NOTIFICATION_STATUS.SENT;
  record.error = undefined;
  await saveStore(storePath, store);
  console.log(`[NOTIFICATIONS] Sent: ${id}`);
}

/**
 * Record a failed attempt. Schedules next retry with exponential backoff
 * if attempts remain; otherwise marks permanently FAILED.
 */
export async function markFailed(
  storePath: string,
  id: string,
  error: string
): Promise<void> {
  const store = await loadStore(storePath);
  const record = store.notifications[id];
  if (!record) return;

  record.attempts += 1;
  record.lastAttemptAt = Date.now();
  record.error = error;

  if (record.attempts >= record.maxAttempts) {
    record.status = NOTIFICATION_STATUS.FAILED;
    console.warn(`[NOTIFICATIONS] Permanently failed after ${record.attempts} attempts: ${id} — ${error}`);
  } else {
    // Exponential backoff: 1min, 5min, 15min, 30min, 60min
    const backoffMs = Math.min(60 * 60_000, 60_000 * Math.pow(2, record.attempts - 1));
    record.nextRetryAt = Date.now() + backoffMs;
    record.status = NOTIFICATION_STATUS.RETRYING;
    console.warn(`[NOTIFICATIONS] Retry ${record.attempts}/${record.maxAttempts} in ${backoffMs / 1000}s: ${id}`);
  }

  await saveStore(storePath, store);
}

/**
 * Get all notifications currently due for retry.
 */
export async function getRetryableNotifications(
  storePath: string
): Promise<NotificationRecord[]> {
  const store = await loadStore(storePath);
  const now = Date.now();
  return Object.values(store.notifications).filter(
    (n) =>
      (n.status === NOTIFICATION_STATUS.PENDING || n.status === NOTIFICATION_STATUS.RETRYING) &&
      (n.nextRetryAt === undefined || n.nextRetryAt <= now)
  );
}

/**
 * Get a notification record by ID.
 */
export async function getNotification(
  storePath: string,
  id: string
): Promise<NotificationRecord | undefined> {
  const store = await loadStore(storePath);
  return store.notifications[id];
}

/**
 * Run one notification processing cycle.
 *
 * @param storePath        Path to notification-store.json
 * @param sendFn           Actual delivery function — returns true on success
 * @param pollIntervalMs   How long to sleep between cycles (default 30s)
 * @param maxBatch         Max notifications to process per cycle (default 50)
 */
export async function runNotificationWorker(
  storePath: string,
  sendFn: (payload: NotificationPayload) => Promise<boolean>,
  pollIntervalMs = 30_000,
  maxBatch = 50
): Promise<void> {
  console.log('[NOTIFICATIONS] Worker started');

  let running = true;
  const shutdown = () => { running = false; };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  while (running) {
    const retryable = await getRetryableNotifications(storePath);
    const batch = retryable.slice(0, maxBatch);

    for (const record of batch) {
      try {
        const ok = await sendFn(record.payload);
        if (ok) {
          await markSent(storePath, record.id);
        } else {
          await markFailed(storePath, record.id, 'provider returned false');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await markFailed(storePath, record.id, msg);
      }
    }

    if (batch.length < maxBatch) {
      await sleep(pollIntervalMs);
    }
  }

  console.log('[NOTIFICATIONS] Worker stopped');
}

// ---------------------------------------------------------------------------
// Built-in providers
// ---------------------------------------------------------------------------

/**
 * Default sendNotification — logs a warning.
 * Replace with a real provider after RB-08.
 *
 * Available providers to integrate after RB-08:
 *  - Resend (email): https://resend.com
 *  - SendGrid (email): https://sendgrid.com
 *  - Twilio (SMS): https://twilio.com
 */
export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  console.warn(`[NOTIFICATION] Would send ${payload.type} to ${payload.recipientAddress} for lease ${payload.leaseId}`);
  // TODO after RB-08: integrate real email/SMS provider here
  // e.g. await resend.emails.send({ from: '...', to: payload.recipientAddress, ... })
  return true; // Return true so it doesn't retry — replace with real impl
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
