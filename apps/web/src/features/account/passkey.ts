import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, createSecp256k1SigningSession } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { getAddress, type LocalAccount } from 'viem';

export type AccountRecord = { credentialId: string; address: `0x${string}`; rpId: string; version: 1 };
export const ACCOUNT_STORAGE_KEY='rentbond.public-account.v1';
export function sameAccount(actual: string, expected: string) { if(getAddress(actual)!==getAddress(expected)) throw new Error('恢复地址与原账户不同。未替换原账户，也未建立会话。'); }
function requireBrowser() { if(!window.isSecureContext || !window.PublicKeyCredential) throw new Error('此设备需要 HTTPS（或 localhost）及支持通行密钥 PRF 的浏览器。'); }
export async function createAccount(): Promise<AccountRecord> {
  requireBrowser();
  const result=await createPasskeyWithPrfOutput({rp:{id:location.hostname,name:'RentBond'},user:{name:'RentBond account',displayName:'RentBond 测试账户'}});
  try { const session=createSecp256k1SigningSession({privateKey:result.prfOutput});try{return {credentialId:result.credentialId,address:toViemAccount(session).address,rpId:location.hostname,version:1};}finally{session.end();} }finally{result.prfOutput.fill(0);}
}
export async function recoverAccount(expectedAddress: string, credentialId?: string): Promise<AccountRecord> {
  requireBrowser();getAddress(expectedAddress);
  const result=await getPasskeyPrfOutput({rpId:location.hostname,...(credentialId?{credential:{credentialId}}:{})});
  try{const session=createSecp256k1SigningSession({privateKey:result.prfOutput});try{const address=toViemAccount(session).address;sameAccount(address,expectedAddress);return {credentialId:result.credentialId,address,rpId:location.hostname,version:1};}finally{session.end();}}finally{result.prfOutput.fill(0);}
}
/** Scope a fresh signing session to one already-confirmed operation. Never persist keys. */
export async function withAccount<T>(record: AccountRecord, operation: (account: LocalAccount)=>Promise<T>):Promise<T>{
  requireBrowser();if(record.rpId!==location.hostname)throw new Error('通行密钥域名不匹配，不能替换账户');
  const result=await getPasskeyPrfOutput({rpId:record.rpId,credential:{credentialId:record.credentialId}});
  try{const session=createSecp256k1SigningSession({privateKey:result.prfOutput});try{const account=toViemAccount(session);sameAccount(account.address,record.address);return await operation(account);}finally{session.end();}}finally{result.prfOutput.fill(0);}
}
