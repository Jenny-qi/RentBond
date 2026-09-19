import { createSiweMessage } from 'viem/siwe';
import { withAccount, type AccountRecord } from './account/passkey';
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{
  if(!path.startsWith('/api/'))throw new Error('只允许同源 API');
  const response=await fetch(path,{...init,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...init.headers}});
  if(!response.ok){const messages:Record<number,string>={401:'会话已失效，请重新登录',403:'无权访问此租约或案件',404:'后端接口尚未接入，当前没有真实业务数据',409:'数据版本或状态已改变，请刷新后重新确认',422:'请检查输入内容',429:'操作频繁，请稍后重试',503:'服务暂不可用，未执行资金操作'};throw new ApiError(response.status,messages[response.status]??'网络服务异常，请稍后重试');}
  if(response.status===204)return undefined as T;
  if(!response.headers.get('content-type')?.includes('application/json'))throw new ApiError(503,'服务响应格式不正确，暂停依赖此数据的操作');
  return await response.json() as T;
}
export async function signIn(record:AccountRecord, signal?:AbortSignal){
  const chainId=Number(process.env.NEXT_PUBLIC_CHAIN_ID);
  if(!Number.isSafeInteger(chainId)||chainId<=0)throw new Error('尚未配置已核实的测试网络，登录暂不可用');
  const {nonce}=await api<{nonce:string}>('/api/auth/nonce',{signal});
  if(!/^[a-zA-Z0-9]{8,}$/.test(nonce))throw new Error('登录挑战格式错误');
  const message=createSiweMessage({address:record.address,chainId,domain:location.host,uri:location.origin,version:'1',nonce,issuedAt:new Date(),expirationTime:new Date(Date.now()+5*60_000),statement:'登录 RentBond 测试应用。此签名不授权扣款、存入或领取。'});
  signal?.throwIfAborted();
  const signature=await withAccount(record, async account=>{signal?.throwIfAborted();return account.signMessage({message});});
  signal?.throwIfAborted();
  return api<{wallet:string}>('/api/auth/verify',{method:'POST',body:JSON.stringify({message,signature}),signal});
}
