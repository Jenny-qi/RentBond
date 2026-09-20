/**
 * Worker entry point.
 *
 * Independent long-running Node.js process for:
 * - indexer/: chain event replay and idempotent projection
 * - jobs/: deadline/expiry tasks that are safe to retry
 * - notifications/: email/SMS reminders (P1)
 * - exports/: async export job consumption
 *
 * E owns this module; D collaborates on event table and task persistence.
 *
 * Key invariants:
 * - Stopping the Worker does NOT freeze contract exit — the contract is trustless.
 * - Restarting the Worker must NOT double-allocate (idempotency via chainId/txHash/logIndex).
 * - Task deadlines come from on-chain parameters, not wall-clock retry logic.
 */

export { indexer } from './indexer/index.js';
export { jobs } from './jobs/index.js';
export { notifications } from './notifications/index.js';
export { exports } from './exports/index.js';
