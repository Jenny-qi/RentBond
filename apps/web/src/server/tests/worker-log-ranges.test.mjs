import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { readLogRanges } from '../../../../worker/src/log-ranges.mjs';

test('inclusive log subranges cover partial final range exactly with bounded concurrency', async () => {
  const requests = []; let active = 0, peak = 0;
  const address = '0x' + '12'.repeat(20);
  const client = { async getLogs(request) {
    requests.push(request); active++; peak = Math.max(peak, active);
    await setTimeout(Number(1200n - request.fromBlock) % 7);
    active--; return [{ blockNumber: request.fromBlock }];
  } };
  const logs = await readLogRanges(client, { address, fromBlock: 109n, toBlock: 1125n }, 100);
  assert.equal(peak, 4); assert.equal(active, 0);
  assert.equal(requests.length, 11);
  requests.forEach((request, index) => {
    assert.equal(request.address, address);
    assert.equal(request.fromBlock, 109n + BigInt(index * 100));
    assert.equal(request.toBlock, index === 10 ? 1125n : request.fromBlock + 99n);
  });
  assert.deepEqual(logs.map(log => log.blockNumber), requests.map(request => request.fromBlock));
});

test('failure rejects the whole batch, stops new ranges and drains pending reads', async () => {
  let active = 0, called = 0;
  const failure = new Error('RPC_UNAVAILABLE');
  const client = { async getLogs(request) {
    called++; active++;
    try {
      if (request.fromBlock === 100n) throw failure;
      await setTimeout(15); return [];
    } finally { active--; }
  } };
  await assert.rejects(readLogRanges(client, { fromBlock: 0n, toBlock: 999n }, 100), error => error === failure);
  assert.equal(active, 0); assert.equal(called, 4);
});

test('single-block reads and invalid bounds cannot silently skip history', async () => {
  const client = { async getLogs(request) { return [request]; } };
  assert.deepEqual(await readLogRanges(client, { fromBlock: 7n, toBlock: 7n }, 100), [{ fromBlock: 7n, toBlock: 7n }]);
  await assert.rejects(readLogRanges(client, { fromBlock: 8n, toBlock: 7n }, 100), /INVALID_LOG_RANGE/);
  await assert.rejects(readLogRanges(client, { fromBlock: -1n, toBlock: 7n }, 100), /INVALID_LOG_RANGE/);
  for (const size of [0, -1, 1.5, NaN]) await assert.rejects(readLogRanges(client, { fromBlock: 0n, toBlock: 7n }, size));
  await assert.rejects(readLogRanges(client, { fromBlock: 0n, toBlock: 7n }, 100, 5));
});
