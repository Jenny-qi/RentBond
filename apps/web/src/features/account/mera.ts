import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, createSecp256k1SigningSession, getEvmAddress, isMeraError, type WebAuthnClient } from '@category-labs/mera';

// Frozen derivation identity. Changing it creates a different account, not recovery.
export const MERA_DERIVATION = 'rentbond.mera.evm.v1';
export interface MeraAccountRecord {
  derivation: typeof MERA_DERIVATION;
  rpId: string;
  address: `0x${string}`;
  credentialId: string;
}
export function assertSameAddress(expected: string, actual: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(expected.trim())) throw new Error('请输入完整的原账户地址。');
  if (expected.trim().toLowerCase() !== actual.toLowerCase()) throw new Error('所选通行密钥对应不同地址，恢复失败；未替换原账户。');
}
async function salt() {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(MERA_DERIVATION)));
}
// Outputs public metadata only. End the session and erase PRF bytes even on mismatch/cancel.
export async function inspectMeraAccount(input: {
  mode: 'create' | 'restore'; rpId: string; expectedAddress?: string;
  signal?: AbortSignal; webAuthnClient?: WebAuthnClient;
}): Promise<MeraAccountRecord> {
  if (!input.rpId || /[/:\s]/.test(input.rpId)) throw new Error('无效的通行密钥域名。');
  if (input.mode === 'restore' && !/^0x[0-9a-fA-F]{40}$/.test(input.expectedAddress?.trim() ?? '')) throw new Error('恢复前需要原账户地址。');
  input.signal?.throwIfAborted();
  const prfSalt = await salt();
  input.signal?.throwIfAborted();
  const result = input.mode === 'create'
    ? await createPasskeyWithPrfOutput({ rp: { id: input.rpId, name: 'RentBond account trial' }, user: { name: 'RentBond test account', displayName: 'RentBond 测试账户' }, prfSalt, timeout: 60000, webAuthnClient: input.webAuthnClient })
    : await getPasskeyPrfOutput({ rpId: input.rpId, prfSalt, timeout: 60000, webAuthnClient: input.webAuthnClient });
  let session: ReturnType<typeof createSecp256k1SigningSession> | undefined;
  try {
    input.signal?.throwIfAborted();
    session = createSecp256k1SigningSession({ privateKey: result.prfOutput });
    const address = getEvmAddress(session.publicKey);
    if (input.mode === 'restore') assertSameAddress(input.expectedAddress!, address);
    return { derivation: MERA_DERIVATION, rpId: input.rpId, address, credentialId: result.credentialId };
  } finally {
    session?.end();
    result.prfOutput.fill(0);
  }
}
export function meraErrorMessage(error: unknown): string {
  if (isMeraError(error)) {
    if (error.code === 'PRF_UNAVAILABLE') return '此设备或通行密钥不支持 PRF，无法恢复签名账户；不会自动创建替代地址。';
    if (error.code === 'PASSKEY_OPERATION_FAILED') return '通行密钥操作取消、超时或不可用，未完成账户验证。';
    return '账户密码学检查失败，未建立签名会话。请保留原通行密钥并检查兼容性。';
  }
  if (error instanceof DOMException && error.name === 'AbortError') return '已取消本次账户检查。';
  return error instanceof Error ? error.message : '账户检查失败，未改变原账户。';
}
