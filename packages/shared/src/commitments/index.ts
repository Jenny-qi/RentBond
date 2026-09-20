/**
 * Stable serialization, commitment scheme, and test vectors.
 * E maintains; B/D/E jointly fix vectors before implementation.
 *
 * Terms document: UTF-8, stable field order, schemaVersion, random 32-byte salt,
 * then keccak256. File body: SHA-256. Salt and file content stored privately;
 * commitment (hash) is public.
 */

import { createHash } from 'node:crypto';
import type { Hash } from '../types/primitives.js';

/** Digest algorithm for terms document commitment */
export const TERMS_HASH_ALGO = 'sha256';
/** Salt length in bytes (32 bytes = 256 bits) */
export const SALT_LENGTH = 32;

/**
 * Compute the commitment hash for a terms document.
 * termsJson: stable-field-ordered JSON string with schemaVersion
 * salt: random 32 bytes (hex)
 */
export function computeTermsCommitment(termsJson: string, salt: string): Hash {
  const data = termsJson + salt;
  return createHash('sha256').update(data, 'utf8').digest('hex') as Hash;
}

/**
 * Verify a terms document against a known commitment.
 */
export function verifyTermsCommitment(
  termsJson: string,
  salt: string,
  expectedCommitment: Hash
): boolean {
  return computeTermsCommitment(termsJson, salt) === expectedCommitment;
}

/** Fixture-only commitment vectors for AT12 700/100/200 scenario */
export const ALICE_FIXTURE_COMMITMENT = '0x' + 'aa'.repeat(32);
