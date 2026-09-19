'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="standalone"><h1>页面暂时无法加载</h1><p>没有据此执行资金操作。请刷新并核对已提交的交易。</p><button onClick={reset}>重新加载</button></main>;}
