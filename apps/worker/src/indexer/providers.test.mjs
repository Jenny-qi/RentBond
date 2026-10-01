/**
 * providers.test.mjs — RB-12 RPC provider unit tests.
 *
 * Tests verifyChainId and buildPublicClient using a mock HTTP server.
 * Uses Node.js native test runner (no external test framework).
 *
 * E owns.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { buildPublicClient, verifyChainId } from './providers.ts';

// ---------------------------------------------------------------------------
// Mock RPC server
// ---------------------------------------------------------------------------

/** Echo server that returns a configurable hex result for eth_chainId */
function createMockRpcServer(chainIdHex = '0x279F') {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body);

      if (payload.method === 'eth_chainId') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: chainIdHex }));
        return;
      }
      if (payload.method === 'eth_blockNumber') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: '0x10D4C0' }));
        return;
      }
      if (payload.method === 'eth_getLogs') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: [] }));
        return;
      }
      if (payload.method === 'eth_call') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: '0x' }));
        return;
      }
      res.writeHead(400);
      res.end();
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('verifyChainId', () => {
  it('returns true when RPC chain ID matches expected (Monad testnet 10143)', async () => {
    const server = await createMockRpcServer('0x279F'); // 10143
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
      const result = await verifyChainId(url, 10143);
      assert.equal(result, true);
    } finally {
      server.close();
    }
  });

  it('throws when RPC chain ID does not match expected', async () => {
    const server = await createMockRpcServer('0x1'); // chain 1 (mainnet)
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
      await assert.rejects(verifyChainId(url, 10143), /Chain ID mismatch/);
    } finally {
      server.close();
    }
  });

  it('throws on invalid expected chain ID', async () => {
    await assert.rejects(verifyChainId('http://127.0.0.1:8545', NaN), /positive safe integer/);
    await assert.rejects(verifyChainId('http://127.0.0.1:8545', -1), /positive safe integer/);
  });

  it('throws when RPC server is unreachable', async () => {
    await assert.rejects(verifyChainId('http://127.0.0.1:0', 10143));
  });
});

describe('buildPublicClient', () => {
  let server;
  let url;

  before(async () => {
    server = await createMockRpcServer();
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.close();
  });

  it('getBlockNumber returns bigint', async () => {
    const client = await buildPublicClient({ primaryUrl: url, network: { chainId: 10143 } });
    const block = await client.getBlockNumber();
    assert.equal(typeof block, 'bigint');
    assert.ok(block > 0n);
  });

  it('getChainId returns correct number', async () => {
    const client = await buildPublicClient({ primaryUrl: url, network: { chainId: 10143 } });
    const chainId = await client.getChainId();
    assert.equal(chainId, 10143);
  });

  it('getLogs returns array', async () => {
    const client = await buildPublicClient({ primaryUrl: url, network: { chainId: 10143 } });
    const logs = await client.getLogs({ address: '0x1234', fromBlock: '0x0', toBlock: 'latest' });
    assert.ok(Array.isArray(logs));
  });

  it('call returns hex string', async () => {
    const client = await buildPublicClient({ primaryUrl: url, network: { chainId: 10143 } });
    const result = await client.call({ to: '0x0000000000000000000000000000000000000000' });
    assert.ok(typeof result === 'string');
    assert.ok(result.startsWith('0x'));
  });
});
