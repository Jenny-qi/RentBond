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
  return units % STEP === 0n;
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
