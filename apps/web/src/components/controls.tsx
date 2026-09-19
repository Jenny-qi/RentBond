'use client';
import { useEffect,useRef,useState,type ReactNode } from 'react';
import { formatMoney } from '@rentbond/shared';
import { useRentBond } from '@/features/provider';
import type { Action,Lease } from '@/features/model';
export function Money({value}:{value:string}){return <span className="money">{formatMoney(value)} <small>MockUSD</small></span>;}
export function Deadline({value,label='截止时间'}:{value:number;label?:string}){return <div className="deadline"><span>{label}</span><strong>{new Date(value*1000).toLocaleString('zh-CN',{hour12:false})}</strong><small>{new Date(value*1000).toISOString().replace('T',' ').replace('.000Z',' UTC')}</small></div>;}
export function Panel({title,subtitle,children}:{title:string;subtitle?:string;children:ReactNode}){return <section className="panel"><div className="panel-title"><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{children}</section>;}
export function ConfirmButton({label,title,description,action,disabled=false,secondary=false}:{label:string;title?:string;description:string;action:Action|(()=>Action);disabled?:boolean;secondary?:boolean}){
 const {act}=useRentBond();const [open,setOpen]=useState(false);const [error,setError]=useState('');const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open)ref.current?.showModal();else ref.current?.close();},[open]);
 return <><button className={secondary?'secondary':''} disabled={disabled} onClick={()=>{setError('');setOpen(true);}}>{label}</button><dialog ref={ref} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} aria-label={title||label}><div className="dialog-content"><span className="eyebrow">确认操作 · 虚构预览</span><h2>{title||label}</h2><p>{description}</p><p className="muted">此次仅更新当前浏览器内存中的示例。不会签名、付款或上传。</p>{error&&<p role="alert" className="error">{error}</p>}<div className="actions"><button className="secondary" onClick={()=>setOpen(false)}>取消</button><button onClick={()=>{try{act(typeof action==='function'?action():action);setOpen(false);}catch(e){setError(e instanceof Error?e.message:'无法执行');}}}>确认{label}</button></div></div></dialog></>;
}
export function BalanceCard({lease}:{lease:Lease}){
 const a=lease.accounting;const total=BigInt(lease.deposit);const pieces=[{label:'租客可领取',value:a.tenantCredit,cls:'tenant'},{label:'房东可领取',value:a.landlordCredit,cls:'landlord'},{label:'尚未分配',value:a.unallocated,cls:'disputed'},{label:'累计已领取',value:(BigInt(a.tenantWithdrawn)+BigInt(a.landlordWithdrawn)).toString(),cls:'paid'}];
 return <section className="balance-card"><div className="balance-top"><div><span className="eyebrow">YOUR DEPOSIT · 测试押金</span><h2><Money value={lease.deposit}/></h2></div><span className="badge">{a.fundedAmount==='0'?'尚未存入':'虚构资金快照'}</span></div><div className="allocation-bar" role="img" aria-label={pieces.map(p=>`${p.label} ${formatMoney(p.value)}`).join('，')}>{pieces.map(p=><span key={p.cls} className={p.cls} style={{width:`${Number(BigInt(p.value)*10000n/total)/100}%`}} />)}</div><div className="allocation-grid">{pieces.map(p=><div key={p.cls}><span className={`dot ${p.cls}`}/><span>{p.label}</span><strong data-testid={p.cls}><Money value={p.value}/></strong></div>)}</div><p>已分配部分不受后续争议影响。领取后才显示已领取。</p></section>;
}
