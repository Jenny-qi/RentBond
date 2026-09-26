/**
 * Stable serialization, commitment scheme, and test vectors.
 * E maintains; B/D/E jointly fix vectors before implementation.
 *
 * Terms document: UTF-8, stable field order, schemaVersion, random 32-byte salt,
 * then keccak256. File body: SHA-256. Salt and file content stored privately;
 * commitment (hash) is public.
 */

import { concatHex, keccak256, stringToHex, type Hex } from "viem";
import type { Hash } from "../types/primitives.js";

/** Digest algorithm for terms document commitment */
export const TERMS_HASH_ALGO = "keccak256";
/** Salt length in bytes (32 bytes = 256 bits) */
export const SALT_LENGTH = 32;
export const COMMITMENT_DOMAIN = "RentBond:private:v1\n";

/** Sorted keys and integer numbers make the JSON representation portable. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map(canonicalJson).join(",") + "]";
  if (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) +
            ":" +
            canonicalJson((value as Record<string, unknown>)[key]),
        )
        .join(",") +
      "}"
    );
  }
  throw new TypeError(
    "Use JSON values, safe integer numbers and decimal strings for amounts.",
  );
}

/**
 * Compute the commitment hash for a terms document.
 * termsJson: stable-field-ordered JSON string with schemaVersion
 * salt: random 32 bytes (hex)
 */
export function computeTermsCommitment(termsJson: string, salt: string): Hash {
  if (!/^0x[0-9a-fA-F]{64}$/.test(salt))
    throw new TypeError("Salt must be 32 bytes, 0x-prefixed.");
  const value = JSON.parse(termsJson);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.schemaVersion !== "string"
  ) {
    throw new TypeError("A commitment requires an object with schemaVersion.");
  }
  return keccak256(
    concatHex([
      stringToHex(COMMITMENT_DOMAIN),
      salt as Hex,
      stringToHex(canonicalJson(value)),
    ]),
  );
}

/**
 * Verify a terms document against a known commitment.
 */
export function verifyTermsCommitment(
  termsJson: string,
  salt: string,
  expectedCommitment: Hash,
): boolean {
  try {
    return (
      computeTermsCommitment(termsJson, salt).toLowerCase() ===
      expectedCommitment.toLowerCase()
    );
  } catch {
    return false;
  }
}

/** Fixture-only commitment vectors for AT12 700/100/200 scenario */
export const ALICE_FIXTURE_COMMITMENT = "0x" + "aa".repeat(32);
