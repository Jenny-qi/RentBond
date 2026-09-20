/**
 * Shared package entry point.
 *
 * E maintains the public surface; B reviews amount/chain types;
 * D reviews schemas; C is a consumer.
 *
 * Re-exports: money utilities, schemas, types, commitments, network config.
 */

// Money
export {
  parseAmount,
  formatAmount,
  isStepAligned,
  validateAmountRange,
  DECIMALS,
  STEP,
} from './money/index.js';

// Schemas
export {
  SCHEMA_VERSION,
  HTTP_STATUS,
  type ApiError,
  type HttpStatusCode,
} from './schemas/index.js';

// Types
export {
  LEASE_STATUS,
  CLAIM_RESPONSE,
  TX_STATUS,
  CASE_STATUS,
  ROLE,
  type AllocationSnapshot,
  type ClaimItem,
  type LeaseSummary,
  type LeaseState,
  type LeaseStatus,
  type ClaimResponse,
  type TxStatus,
  type CaseStatus,
  type Role,
} from './types/index.js';

// Primitives
export {
  normalizeAddress,
  addressesEqual,
  validateHash,
  type Address,
  type Hash,
  type Timestamp,
} from './types/primitives.js';

// Commitments
export {
  computeTermsCommitment,
  verifyTermsCommitment,
  TERMS_HASH_ALGO,
  SALT_LENGTH,
  ALICE_FIXTURE_COMMITMENT,
} from './commitments/index.js';

// Network
export {
  MONAD_TESTNET,
  networksMatch,
  isFinalized,
  type NetworkConfig,
} from './network/index.js';
