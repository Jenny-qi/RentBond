/**
 * API input and lease structure schemas.
 *
 * E maintains; D reviews server-side schemas; C reviews consumer compatibility.
 * All schemas use stable field ordering and include schemaVersion.
 */

export const SCHEMA_VERSION = '1.0.0';

/** RentBond's JSON error envelope (not RFC 7807 Problem Details). */
export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
  };
}

/** Standard error codes shared across API, Worker, and contracts */
export const ERROR_CODE = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  EXPIRED_NONCE: 'EXPIRED_NONCE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Lease / contract state
  LEASE_NOT_FOUND: 'LEASE_NOT_FOUND',
  LEASE_NOT_ACTIVE: 'LEASE_NOT_ACTIVE',
  LEASE_ALREADY_FUNDED: 'LEASE_ALREADY_FUNDED',
  CLAIMS_WINDOW_CLOSED: 'CLAIMS_WINDOW_CLOSED',
  CLAIM_DEADLINE_NOT_PASSED: 'CLAIM_DEADLINE_NOT_PASSED',
  DUPLICATE_CLAIM: 'DUPLICATE_CLAIM',

  // Funds
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  ALLOCATION_UNDERFLOW: 'ALLOCATION_UNDERFLOW',
  ALLOCATION_CONSERVATION_VIOLATED: 'ALLOCATION_CONSERVATION_VIOLATED',
  WITHDRAWAL_ALREADY_CLAIMED: 'WITHDRAWAL_ALREADY_CLAIMED',
  TRANSFER_FAILED: 'TRANSFER_FAILED',

  // Concurrency
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',

  // Network / RPC
  RPC_ERROR: 'RPC_ERROR',
  RPC_CHAIN_MISMATCH: 'RPC_CHAIN_MISMATCH',
  TX_REORG: 'TX_REORG',
  TX_NOT_FOUND: 'TX_NOT_FOUND',

  // Input validation
  INVALID_INPUT: 'INVALID_INPUT',
  AMOUNT_NOT_STEP_ALIGNED: 'AMOUNT_NOT_STEP_ALIGNED',
  ADDRESS_MALFORMED: 'ADDRESS_MALFORMED',
  SCHEMA_VERSION_MISMATCH: 'SCHEMA_VERSION_MISMATCH',

  // Worker
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_ALREADY_RUNNING: 'JOB_ALREADY_RUNNING',
  TRIGGER_BLOCK_NOT_REACHED: 'TRIGGER_BLOCK_NOT_REACHED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',

  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/** HTTP status codes used */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];

/**
 * Build a structured API error.
 */
export function apiError(code: ErrorCode, message: string, requestId = crypto.randomUUID(), retryable = false): ApiError {
  return { error: { code, message, requestId, retryable } };
}
