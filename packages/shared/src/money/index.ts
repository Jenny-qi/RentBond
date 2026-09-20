/**
 * Money utilities — Amount parsing, formatting, and step validation.
 * All amounts in MockUSD are 6 decimal places internally.
 * Business step: 10,000 units = 0.01 MockUSD.
 *
 * E maintains; B reviews amount/chain types; D reviews schema.
 */

export const DECIMALS = 6;
export const STEP = 10_000n; // business step in base units

/**
 * Parse a decimal string to bigint base units.
 * Rejects fractional amounts that would be lost.
 */
export function parseAmount(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  const padded = (fraction + '0'.repeat(DECIMALS)).slice(0, DECIMALS);
  return BigInt(whole) * 10n ** BigInt(DECIMALS) + BigInt(padded);
}

/**
 * Format base units to decimal string for display.
 */
export function formatAmount(units: bigint): string {
  const divisor = 10n ** BigInt(DECIMALS);
  const whole = units / divisor;
  const remainder = units % divisor;
  const fraction = remainder.toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/**
 * Check that an amount conforms to the business step (10,000 base units).
 */
export function isStepAligned(units: bigint): boolean {
  return units >= 0n && units % STEP === 0n;
}

/**
 * Reject amounts that overflow safe integer range when treated as numbers.
 */
export function validateAmountRange(units: bigint): void {
  if (units < 0n) throw new Error('Amount must be non-negative');
  // 78 decimal digits max (numeric(78,0))
  const MAX_UNITS = 10n ** 78n - 1n;
  if (units > MAX_UNITS) throw new Error('Amount exceeds maximum range');
}

/**
 * Add two amounts. Returns sum as bigint.
 * Throws if result would exceed MAX_UNITS or if inputs are negative.
 */
export function addAmounts(a: string, b: string): bigint {
  const ua = parseAmount(a);
  const ub = parseAmount(b);
  validateAmountRange(ua);
  validateAmountRange(ub);
  const sum = ua + ub;
  validateAmountRange(sum);
  if (!isStepAligned(sum)) throw new Error('Sum is not step-aligned');
  return sum;
}

/**
 * Subtract b from a. Returns difference as bigint.
 * Throws if result would be negative.
 */
export function subtractAmounts(a: string, b: string): bigint {
  const ua = parseAmount(a);
  const ub = parseAmount(b);
  validateAmountRange(ua);
  validateAmountRange(ub);
  if (ua < ub) throw new Error('Subtraction would result in negative amount');
  const diff = ua - ub;
  if (!isStepAligned(diff)) throw new Error('Difference is not step-aligned');
  return diff;
}

/**
 * Verify that deposit = unallocated + tenantCredit + landlordCredit + tenantWithdrawn + landlordWithdrawn.
 * Used to check allocation conservation before and after each state transition.
 */
export function verifyAllocationConservation(
  deposit: string,
  snapshot: {
    unallocated: string;
    tenantCredit: string;
    landlordCredit: string;
    tenantWithdrawn: string;
    landlordWithdrawn: string;
  }
): void {
  const d = parseAmount(deposit);
  const sum =
    parseAmount(snapshot.unallocated) +
    parseAmount(snapshot.tenantCredit) +
    parseAmount(snapshot.landlordCredit) +
    parseAmount(snapshot.tenantWithdrawn) +
    parseAmount(snapshot.landlordWithdrawn);
  if (d !== sum) {
    throw new Error(
      `Allocation conservation violated: deposit=${deposit} sum=${sum}`
    );
  }
}
