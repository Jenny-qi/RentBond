'use client';
import { useEffect,useRef,useState } from 'react';
import { ACCOUNT_STORAGE_KEY,createAccount,recoverAccount,sameAccount,type AccountRecord } from './passkey';
import { api,signIn } from '../api';
export function AccountView(){
 const [record,setRecord]=useState<AccountRecord|null>(null);const [expected,setExpected]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [loggedIn,setLoggedIn]=useState(false);const abort=useRef<AbortController|null>(null);
 useEffect(()=>{try{const saved=localStorage.getItem(ACCOUNT_STORAGE_KEY);if(saved){const r=JSON.parse(saved) as AccountRecord;if(r.version===1&&r.rpId===location.hostname){setRecord(r);setExpected(r.address);}}}catch{setMessage('本机账户索引不可读，请使用原地址恢复。');}return ()=>abort.current?.abort();},[]);
 async function run(fn:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('等待设备确认…');abort.current=new AbortController();try{await fn();}catch(e){setMessage(e instanceof Error?e.message:'操作失败或已取消');}finally{setBusy(false);}}
 function save(r:AccountRecord){localStorage.setItem(ACCOUNT_STORAGE_KEY,JSON.stringify(r));setRecord(r);setExpected(r.address);setLoggedIn(false);}
 return <div className="account-layout"><section className="panel"><span className="eyebrow">YOUR ACCOUNT</span><h1>用通行密钥继续</h1><p>创建或恢复你的账户，然后单独确认登录。登录不授权任何资金操作。</p><div className="account-icon">⌁</div>{record?<><p className="badge">已保存本机公开账户索引 · 不代表已登录</p><p className="address">{record.address}</p></>:<button disabled={busy} onClick={()=>run(async()=>{const r=await createAccount();if(abort.current?.signal.aborted)return;save(r);setMessage('账户已创建。请保存公开地址，用于换设备核对；尚未登录或存入。');})}>创建通行密钥账户</button>}
 <label>原账户公开地址<input placeholder="0x…（用于核对，不是私钥）" value={expected} onChange={e=>setExpected(e.target.value)} disabled={busy}/></label>
 <button className="secondary" disabled={busy||!expected} onClick={()=>run(async()=>{const r=await recoverAccount(expected,record?.address.toLowerCase()===expected.toLowerCase()?record.credentialId:undefined);if(abort.current?.signal.aborted)return;save(r);setMessage('已恢复并核对同一地址。尚未建立服务端会话。');})}>恢复并核对原账户</button>
 {record&&<button disabled={busy} onClick={()=>run(async()=>{const result=await signIn(record,abort.current?.signal);sameAccount(result.wallet,record.address);setLoggedIn(true);setMessage('服务端已验证登录。资金操作仍须逐次确认。');})}>确认登录（不授权资金）</button>}
 <div role="status" className="notice">{message||'Mera PRF 真机兼容性和跨设备恢复仍需按 TS05 验收。'}</div>
 {busy&&<button className="secondary" onClick={()=>{abort.current?.abort();setMessage('已取消后续登录请求。设备通行密钥窗口请同时取消。');}}>取消后续请求</button>}
 {(record||loggedIn)&&<button className="text-button" disabled={busy} onClick={()=>run(async()=>{await api<void>('/api/auth/logout',{method:'POST'});setRecord(null);setLoggedIn(false);setExpected('');localStorage.removeItem(ACCOUNT_STORAGE_KEY);setMessage('已退出。服务端会话及本机公开索引已清除。');})}>退出会话并清除本机索引</button>}
 </section><aside className="panel soft"><h2>账户与押金，分别确认</h2><ol className="steps"><li><b>创建或恢复</b><p>设备需支持通行密钥 PRF；在稳定的 HTTPS 域名使用。</p></li><li><b>确认登录</b><p>只证明当前地址，后端还需核查租约成员权限。</p></li><li><b>确认具体金额</b><p>存入、认可扣款、和解、领取都要单独确认。</p></li></ol><p>换设备时选择已同步的原通行密钥。另建一把密钥会得到不同账户，不能视为恢复。</p></aside></div>;
}
