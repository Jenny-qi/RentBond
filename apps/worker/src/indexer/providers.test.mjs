import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { buildPublicClient, verifyChainId } from './providers.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function mockRpc(handler) {
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const response = handler(request.method, request.params);
    return Response.json({ jsonrpc: '2.0', id: request.id, ...response });
  };
}

const network = { chainId: 10143 };
const rpcUrl = 'https://example.invalid/rpc';

test('accepts the expected chain and rejects a different chain', async () => {
  mockRpc(() => ({ result: '0x279f' }));
  assert.equal(await verifyChainId(rpcUrl, 10143), true);
  mockRpc(() => ({ result: '0x1' }));
  await assert.rejects(verifyChainId(rpcUrl, 10143), /Chain ID mismatch/);
});

test('invalid expected chain ID is rejected before making an RPC request', async () => {
  globalThis.fetch = () => { throw new Error('fetch must not run'); };
  await assert.rejects(verifyChainId(rpcUrl, NaN), /positive safe integer/);
  await assert.rejects(verifyChainId(rpcUrl, -1), /positive safe integer/);
});

test('RPC transport and error responses are propagated', async () => {
  globalThis.fetch = async () => { throw new Error('connection failed'); };
  await assert.rejects(verifyChainId(rpcUrl, 10143), /connection failed/);
  mockRpc(() => ({ error: { message: 'backend unavailable' } }));
  await assert.rejects(verifyChainId(rpcUrl, 10143), /backend unavailable/);
});

test('read methods preserve valid values', async () => {
  mockRpc((method) => ({
    result: {
      eth_blockNumber: '0x10d4c0',
      eth_chainId: '0x279f',
      eth_getLogs: [],
      eth_call: '0x',
    }[method],
  }));
  const client = await buildPublicClient({ primaryUrl: rpcUrl, network });
  assert.equal(await client.getBlockNumber(), BigInt('0x10d4c0'));
  assert.equal(await client.getChainId(), 10143);
  assert.deepEqual(await client.getLogs({ fromBlock: '0x1', toBlock: '0x1' }), []);
  assert.equal(await client.call({ to: '0x0000000000000000000000000000000000000000' }), '0x');
});

test('missing RPC results reject rather than masquerade as an empty read', async () => {
  mockRpc(() => ({}));
  const client = await buildPublicClient({ primaryUrl: rpcUrl, network });
  await assert.rejects(client.getLogs({ fromBlock: '0x1', toBlock: '0x1' }), /eth_getLogs returned no result/);
  await assert.rejects(client.call({ to: '0x0000000000000000000000000000000000000000' }), /eth_call returned no result/);
  await assert.rejects(client.getBlockNumber(), /eth_blockNumber returned no result/);
});

test('null RPC results reject rather than masquerade as an empty read', async () => {
  mockRpc(() => ({ result: null }));
  const client = await buildPublicClient({ primaryUrl: rpcUrl, network });
  await assert.rejects(client.getLogs({ fromBlock: '0x1', toBlock: '0x1' }), /eth_getLogs returned no result/);
});
