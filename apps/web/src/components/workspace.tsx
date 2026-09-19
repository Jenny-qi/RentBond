'use client';
import Link from 'next/link';
import { usePathname,useRouter } from 'next/navigation';
import { useEffect,useState } from 'react';
import { useRentBond } from '@/features/provider';
import { roleNames,type Role,stageNames } from '@/features/model';
import { scenarios,type Scenario } from '@/features/demo';
import { AccountView } from '@/features/account/view';
import { LeaseScreen,CreateLease,ResolverList } from './lease-screens';
import { api } from '@/features/api';
export function Workspace(){
 const path=usePathname();const router=useRouter();const s=useRentBond();const [menu,setMenu]=useState(false);
 function demo(){s.begin();router.push('/leases/alice-001');}
 const nav=[['/leases','◫','我的租约'],['/leases/alice-001/claims','≡','扣款与回应'],['/resolver','◇','处理人工作台'],['/login','⌁','账户与恢复']];
 return <div className="app-shell"><a className="skip" href="#main">跳至主要内容</a><aside className={`sidebar ${menu?'show':''}`}><Link className="brand" href="/" onClick={()=>setMenu(false)}><span className="brand-mark">R</span>RentBond<span className="brand-period">.</span></Link><p className="sidebar-caption">押金结算，有据可循。</p><nav aria-label="主导航">{nav.map(([href,icon,label])=><Link key={href} className={path===href?'selected':''} href={href} onClick={()=>setMenu(false)}><span>{icon}</span>{label}</Link>)}</nav><div className="sidebar-bottom"><span className="badge">MONAD TESTNET</span><p>测试资产，无现金价值。<br/>为远程退租设计。</p><Link href="/">了解 RentBond ↗</Link></div></aside><div className="main-shell"><header className="topbar"><button className="mobile-toggle secondary" onClick={()=>setMenu(!menu)} aria-label="展开导航">☰</button><span>跨境租房 <span className="muted">/ 远程押金结算</span></span><span className="environment">● Monad 测试网目标 · 无现金价值</span></header>
 <div className={`mode-banner ${s.mode==='demo'?'demo':''}`} role="note">{s.mode==='demo'?<><b>虚构交互预览</b><span>无链上交易 · 无文件上传 · 刷新即清除</span><button className="text-button" onClick={()=>{s.leave();router.push('/');}}>退出预览</button></>:<><b>真实连接模式</b><span>后端与合约未接入时停止操作，不使用示例填充。</span><button className="text-button" onClick={demo}>打开虚构预览 →</button></>}</div>
 {s.mode==='demo'&&<div className="demo-tools"><label>预览身份<select aria-label="预览身份" value={s.role} onChange={e=>s.switchRole(e.target.value as Role)}>{Object.entries(roleNames).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><label>虚构快照<select aria-label="虚构快照" value={s.scenario} onChange={e=>s.reset(e.target.value as Scenario)}>{Object.entries(scenarios).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><span>切换快照重置示例，不修改真实期限。</span></div>}
 <main id="main" key={`${path}-${s.epoch}`}><Content path={path} demo={demo}/></main><footer>RentBond · 可编程押金结算 <span>只将有争议的部分留在处理流程中。</span></footer></div></div>;
}
function Content({path,demo}:{path:string;demo:()=>void}){
 const s=useRentBond();const router=useRouter();
 if(path==='/')return <><section className="hero"><span className="eyebrow">LESS WAITING. MORE CLARITY.</span><h1>退租可以远程，<br/>押金不必悬而未决。</h1><p>面向跨境租房的国际学生与小型房东。逐项说明扣款，先结算没有争议的部分。</p><div className="actions"><Link className="button" href="/login">使用通行密钥继续 ↗</Link><button className="secondary" onClick={demo}>体验部分结算</button></div><small>双方须在入金前采用本流程，不能追回已交给房东的旧押金。</small><div className="hero-illustration" aria-label="虚构案例押金拆分"><div className="paper"><span>ALICE’S DEPOSIT · 虚构案例</span><strong>1,000 <small>MockUSD</small></strong><hr/><div>未申索 → 租客 <b>700</b></div><div>已认可 → 房东 <b>100</b></div><div className="dispute-pill">仅争议部分待处理 <b>200</b></div><small>窗口关闭并确认分配后可领取</small></div></div></section><div className="feature-grid">{[['01','逐项提出扣款','房东提供金额、理由和证据，申索不等于收款。'],['02','认可与争议分开','租客逐项回应，不让一项分歧拖住所有资金。'],['03','查看每笔去向','分配、可领取和已领取，各有清楚记录。']].map(([n,t,d])=><section key={n} className="panel"><span className="step-number">{n}</span><h2>{t}</h2><p>{d}</p></section>)}</div></>;
 if(path==='/login')return <AccountView/>;
 if(path==='/leases/new')return <CreateLease/>;
 if(s.mode!=='demo')return <LiveUnavailable path={path}/>;
 if(path==='/leases')return <><div className="page-heading"><div><span className="eyebrow">YOUR RENTALS</span><h1>我的租约</h1><p>查看押金去向，以及下一步需要完成的事。</p></div><Link className="button" href="/leases/new">＋ 创建租约</Link></div>{s.lease?<Link className="panel lease-list-card" href={`/leases/${s.lease.id}`}><div><span className="badge">{stageNames[s.lease.stage]}</span><h2>{s.lease.title}</h2><p>国际学生 · 私人房东 · 虚构案例</p></div><strong>查看工作台 →</strong></Link>:<p>当前没有租约。</p>}</>;
 if(path==='/resolver')return <ResolverList/>;
 if(path==='/invite/demo-invite')return <LeaseScreen tab="invite"/>;
 if(path.startsWith('/invite/'))return <div className="panel"><h1>邀请不可用</h1><p>邀请不存在或已过期。请联系房东重新发起；不会自动关联示例租约。</p></div>;
 const parts=path.split('/').filter(Boolean);
 if(parts[0]==='leases'&&parts[1]===s.lease?.id){const tab=parts[2]||'overview';if(['overview','claims','fund','checkout','cases','settlement'].includes(tab))return <LeaseScreen tab={tab}/>;}
 return <section className="panel"><h1>未找到该页面</h1><p>请从我的租约进入正确的工作台。</p><button onClick={()=>router.push('/leases')}>返回租约</button></section>;
}
function LiveUnavailable({path}:{path:string}){
 const [message,setMessage]=useState('正在检查服务连接…');const [retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setMessage('正在检查服务连接…');api<unknown>(path.startsWith('/leases')?'/api/leases':'/api/health',{signal:controller.signal}).then(()=>setMessage('服务可达；尚需 B/D 按交接契约接入经过校验的租约读取与生成 ABI，当前业务界面未开放。')).catch(e=>{if(!controller.signal.aborted)setMessage(e.message);});return ()=>controller.abort();},[path,retry]);
 return <section className="panel empty-state"><span className="empty-icon">◇</span><h1>等待真实服务接入</h1><p role="status">{message}</p><p>不会把连接失败显示为余额为零，也不会自动加载虚构租约。</p><div className="actions"><button className="secondary" onClick={()=>setRetry(v=>v+1)}>重新检查</button><Link className="button" href="/login">前往账户</Link></div></section>;
}
