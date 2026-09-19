/** MockUSD base units. No floating point enters business accounting. */
export const UNIT = 1_000_000n;
export const STEP = 10_000n;
export function parseMoney(input: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(input)) throw new Error('请输入非负金额，最多两位小数');
  const [whole, fraction = ''] = input.split('.');
  return BigInt(whole) * UNIT + BigInt(fraction.padEnd(6, '0'));
}
export function formatMoney(value: bigint | string): string {
  const n = BigInt(value);
  if (n < 0n || n % STEP !== 0n) throw new Error('无效的业务金额');
  const whole = (n / UNIT).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = ((n % UNIT) / STEP).toString().padStart(2, '0');
  return cents === '00' ? whole : `${whole}.${cents}`;
}
export function validateDeposit(value: bigint) {
  if (value < UNIT || value > 10_000n * UNIT || value % STEP !== 0n) throw new Error('押金须为 1–10,000 MockUSD，最多两位小数');
}
export type Accounting = { fundedAmount: string; unallocated: string; tenantCredit: string; landlordCredit: string; tenantWithdrawn: string; landlordWithdrawn: string };
export function assertAccounting(a: Accounting) {
  for (const v of Object.values(a)) if (!/^\d+$/.test(v) || BigInt(v) % STEP !== 0n) throw new Error('金额数据格式错误');
  const sum = BigInt(a.unallocated) + BigInt(a.tenantCredit) + BigInt(a.landlordCredit) + BigInt(a.tenantWithdrawn) + BigInt(a.landlordWithdrawn);
  if (sum !== BigInt(a.fundedAmount)) throw new Error('金额数据不守恒，暂停操作');
}
