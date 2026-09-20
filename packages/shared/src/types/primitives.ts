/**
 * Primitive type aliases — single source of truth for Address/Hash/Timestamp.
 * E maintains; B reviews chain type mapping.
 */

export type Address = `0x${string}`;
export type Hash = `0x${string}`;
export type Timestamp = number; // Unix UTC seconds

/** Validate and normalize an EVM address */
export function normalizeAddress(addr: string): Address {
  const normalized = addr.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
    throw new Error(`Invalid EVM address: ${addr}`);
  }
  return normalized as Address;
}

/** Compare two addresses for equality */
export function addressesEqual(a: string, b: string): boolean {
  return normalizeAddress(a) === normalizeAddress(b);
}

/** Validate a bytes32 hash */
export function validateHash(h: string): Hash {
  if (!/^0x[0-9a-f]{64}$/.test(h)) {
    throw new Error(`Invalid hash: ${h}`);
  }
  return h as Hash;
}
