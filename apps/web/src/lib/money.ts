/**
 * Consumer copy of amount display rules from packages/shared (C does not own that package).
 * JSON amounts are decimal strings of base units; JS uses bigint. Never use float for deposit math.
 */

export const DECIMALS = 6;
export const STEP = 10_000n;
export const MIN_DEPOSIT = 1;
export const MAX_DEPOSIT = 10_000;
export const ASSET_SYMBOL = 'MockUSD';
export const TESTNET_BANNER = 'Monad 测试网 · 测试资产，无现金价值';

export function parseBaseUnits(units: string): bigint {
  if (!/^\d+$/.test(units)) throw new Error(`Invalid base units: ${units}`);
  return BigInt(units);
}

export function formatMockUsd(units: string | bigint): string {
  const value = typeof units === 'bigint' ? units : parseBaseUnits(units);
  const divisor = 10n ** BigInt(DECIMALS);
  const whole = value / divisor;
  const remainder = value % divisor;
  const fraction = remainder.toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  const amount = fraction ? `${whole}.${fraction}` : whole.toString();
  return `${amount} ${ASSET_SYMBOL}`;
}

export function formatMockUsdPlain(units: string | bigint): string {
  const value = typeof units === 'bigint' ? units : parseBaseUnits(units);
  const divisor = 10n ** BigInt(DECIMALS);
  const whole = value / divisor;
  const remainder = value % divisor;
  if (remainder === 0n) return whole.toString();
  const fraction = remainder.toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  return `${whole}.${fraction}`;
}

/** Front-end input: max 2 decimal places, range 1–10,000. */
export function parseUserAmount(input: string): { ok: true; baseUnits: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: '金额最多 2 位小数，且须为数字。' };
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const padded = (fraction + '0'.repeat(DECIMALS)).slice(0, DECIMALS);
  const units = BigInt(whole) * 10n ** BigInt(DECIMALS) + BigInt(padded);
  const minUnits = 10n ** BigInt(DECIMALS); // 1.00 MockUSD for deposits
  if (units < minUnits || units > 10_000n * 10n ** BigInt(DECIMALS)) {
    return { ok: false, error: `押金须在 ${MIN_DEPOSIT}–${MAX_DEPOSIT} ${ASSET_SYMBOL}。` };
  }
  if (units % STEP !== 0n) {
    return { ok: false, error: '最小业务单位为 0.01 MockUSD。' };
  }
  return { ok: true, baseUnits: units.toString() };
}

/** Awards and settlement shares: 0 allowed, still 2 decimals and 0.01 step. */
export function parseShareAmount(input: string, maxBaseUnits: string): { ok: true; baseUnits: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: '金额最多 2 位小数，且须为数字。' };
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const padded = (fraction + '0'.repeat(DECIMALS)).slice(0, DECIMALS);
  const units = BigInt(whole) * 10n ** BigInt(DECIMALS) + BigInt(padded);
  if (units < 0n || units > parseBaseUnits(maxBaseUnits)) {
    return { ok: false, error: `金额须在 0 与上限 ${formatMockUsd(maxBaseUnits)} 之间。` };
  }
  if (units % STEP !== 0n) {
    return { ok: false, error: '最小业务单位为 0.01 MockUSD。' };
  }
  return { ok: true, baseUnits: units.toString() };
}

export function verifyConservation(deposit: string, parts: {
  unallocated: string;
  tenantCredit: string;
  landlordCredit: string;
  tenantWithdrawn: string;
  landlordWithdrawn: string;
}): boolean {
  const sum =
    parseBaseUnits(parts.unallocated) +
    parseBaseUnits(parts.tenantCredit) +
    parseBaseUnits(parts.landlordCredit) +
    parseBaseUnits(parts.tenantWithdrawn) +
    parseBaseUnits(parts.landlordWithdrawn);
  return parseBaseUnits(deposit) === sum;
}
