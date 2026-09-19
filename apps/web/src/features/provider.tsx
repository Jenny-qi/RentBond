'use client';
import { createContext, useContext, useState, useRef, type ReactNode } from 'react';
import { fixture, transition, type Scenario } from './demo';
import type { Action, Lease, Role } from './model';
import { api } from './api';
type Store={mode:'live'|'demo';role:Role;lease:Lease|null;scenario:Scenario;epoch:number;notice:string;begin:(scenario?:Scenario)=>void;reset:(scenario:Scenario)=>void;switchRole:(role:Role)=>void;leave:()=>Promise<void>;act:(action:Action)=>void;setNotice:(text:string)=>void};
const Context=createContext<Store|null>(null);
export function Provider({children}:{children:ReactNode}){
 const [mode,setMode]=useState<'live'|'demo'>('live');const [role,setRole]=useState<Role>('tenant');const [lease,setLease]=useState<Lease|null>(null);const [scenario,setScenario]=useState<Scenario>('review');const [epoch,setEpoch]=useState(0);const [notice,setNotice]=useState('');
 const ref=useRef(lease);ref.current=lease;
 function begin(s:Scenario='review'){setMode('demo');setScenario(s);setLease(fixture(s));setRole('tenant');setEpoch(e=>e+1);setNotice('已进入虚构交互预览。没有链上交易，不会保存或上传材料。');}
 function reset(s:Scenario){setScenario(s);setLease(fixture(s));setEpoch(e=>e+1);setNotice('已重置虚构快照。此操作不改变真实租约时间。');}
 function switchRole(r:Role){if(mode!=='demo')return;setRole(r);setEpoch(e=>e+1);setNotice('已切换虚构视角，未提交表单已清除。');}
 async function leave(){setLease(null);ref.current=null;setMode('live');setEpoch(e=>e+1);setNotice('');/* Demo never creates a real session. */}
 function act(action:Action){if(mode!=='demo'||!ref.current)throw new Error('真实写入未接入');const next=transition(ref.current,role,action);ref.current=next;setLease(next);setNotice('虚构操作已更新。没有发生真实交易。');}
 return <Context.Provider value={{mode,role,lease,scenario,epoch,notice,begin,reset,switchRole,leave,act,setNotice}}>{children}</Context.Provider>;
}
export function useRentBond(){const ctx=useContext(Context);if(!ctx)throw new Error('Missing provider');return ctx;}
