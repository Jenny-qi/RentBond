import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTransaction, recoverTransactionAddress } from 'viem';
import { createSecp256k1SigningSession } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { clients, simulateAction, actionData } from './client.ts';

const config = { mode: 'testnet', chainId: 10143, rpcUrl: 'https://rpc.invalid', factory: '0x' + '22'.repeat(20), confirmations: 1 };
const action = { address: '0x' + '33'.repeat(20), functionName: 'acceptTerms', args: ['0x' + 'ab'.repeat(32)] };
const hash = '0x' + '44'.repeat(32);

test('Mera signs the simulated contract transaction locally and submits raw bytes', async t => {
  const session = createSecp256k1SigningSession({ privateKey: new Uint8Array(32).fill(1) });
  const account = toViemAccount(session);
  const wallet = { address: account.address, account, end: () => session.end() };
  const calls = []; let raw;
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const request = JSON.parse(options.body); calls.push(request.method);
    let result;
    switch (request.method) {
      case 'eth_call': result = '0x'; break;
      case 'eth_chainId': result = '0x279f'; break;
      case 'eth_getTransactionCount': result = '0x0'; break;
      case 'eth_getBlockByNumber': result = { number: '0x1', baseFeePerGas: '0x77359400', gasLimit: '0x1c9c380', timestamp: '0x1', transactions: [] }; break;
      case 'eth_maxPriorityFeePerGas': case 'eth_gasPrice': result = '0x77359400'; break;
      case 'eth_estimateGas': result = '0x186a0'; break;
      case 'eth_sendRawTransaction': raw = request.params[0]; result = hash; break;
      default: throw new Error(`Unexpected RPC method: ${request.method}`);
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), { headers: { 'Content-Type': 'application/json' } });
  });
  try {
    const simulated = await simulateAction(config, wallet, action);
    const { walletClient } = clients(config, wallet);
    assert.equal(await walletClient.writeContract(simulated.request), hash);
    assert.ok(calls.includes('eth_sendRawTransaction'));
    assert.ok(!calls.includes('eth_sendTransaction'));
    assert.equal(await recoverTransactionAddress({ serializedTransaction: raw }), account.address);
    const tx = parseTransaction(raw);
    assert.equal(tx.chainId, 10143);
    assert.equal(tx.to.toLowerCase(), action.address);
    assert.equal(tx.data, actionData(action));
    assert.equal(tx.value ?? 0n, 0n);
  } finally { session.end(); }
});

test('external wallets keep signing through their own provider', async t => {
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.method, 'eth_call');
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: '0x' }));
  });
  const calls = [];
  const wallet = { address: '0x' + '55'.repeat(20), end() {}, provider: { request: async ({ method, params }) => {
    calls.push(method);
    if (method === 'eth_chainId') return '0x279f';
    assert.equal(method, 'eth_sendTransaction');
    assert.equal(params[0].from, wallet.address);
    assert.equal(params[0].data, actionData(action));
    return hash;
  } } };
  const simulated = await simulateAction(config, wallet, action);
  assert.equal(await clients(config, wallet).walletClient.writeContract(simulated.request), hash);
  assert.ok(calls.includes('eth_sendTransaction'));
});
