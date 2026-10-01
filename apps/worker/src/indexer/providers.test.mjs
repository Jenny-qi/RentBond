import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, test } from 'node:test';
import { verifyChainId } from './providers.ts';

const server = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  const message = JSON.parse(body);
  assert.equal(message.method, 'eth_chainId');
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: '0x279F' }));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
after(() => server.close());
const url = `http://127.0.0.1:${server.address().port}`;

test('checks the actual RPC chain ID instead of assuming the configured network', async () => {
  assert.equal(await verifyChainId(url, 10143), true);
  assert.equal(await verifyChainId(url, 1), false);
});

test('rejects an invalid expected chain ID before sending RPC', async () => {
  await assert.rejects(verifyChainId(url, NaN), /positive safe integer/);
});

test('fails closed when RPC cannot return a chain ID', async () => {
  await assert.rejects(verifyChainId('http://127.0.0.1:0', 10143));
});
