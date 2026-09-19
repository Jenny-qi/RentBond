/** Transport boundary for B's generated ABI and E's verified finality policy. */
export type TxState = 'idle'|'awaiting-signature'|'submitted'|'confirming'|'confirmed'|'failed'|'cancelled';
export type TxUpdate = { state:TxState; hash?:string; message?:string };
export interface TxTransport {
  chainId():Promise<number>;
  simulate():Promise<void>;
  send():Promise<string>;
  confirm(hash:string):Promise<'success'|'reverted'|'pending'>;
}
export async function executeConfirmed(transport:TxTransport, expectedChainId:number, signal:AbortSignal, update:(state:TxUpdate)=>void){
  let hash:string|undefined;
  try{
    if(!Number.isSafeInteger(expectedChainId)||expectedChainId<=0)throw new Error('未配置测试网络');
    signal.throwIfAborted();
    if(await transport.chainId()!==expectedChainId)throw new Error('网络不匹配，已停止写入');
    await transport.simulate();signal.throwIfAborted();
    update({state:'awaiting-signature'});hash=await transport.send();
    update({state:'submitted',hash});
    // After broadcasting, cancellation cannot undo the transaction. Keep its hash.
    update({state:'confirming',hash});
    const result=await transport.confirm(hash);
    update({state:result==='success'?'confirmed':result==='reverted'?'failed':'confirming',hash});
    return result;
  }catch(error){
    const message=error instanceof Error?error.message:'操作失败';
    if(hash){update({state:'confirming',hash,message:'交易已提交，确认暂不可用。请核查此交易，勿重复支付。'});return 'pending';}
    update({state:signal.aborted||(error as {code?:number}).code===4001?'cancelled':'failed',message});return 'reverted';
  }
}
/** approve/fund are deliberately separate confirmations, with no automatic second send. */
export const liveWriteBlocker='待成员 B 提供生成 ABI、部署记录和确认策略，并与 D 完成真实会话及服务联调后开放。';
