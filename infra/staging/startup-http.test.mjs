// Explicit production-build test. Run after `npm run build --prefix apps/web`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('production API emits a correlated redacted startup log and generic non-cacheable 503', async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: fileURLToPath(new URL('../../apps/web/', import.meta.url)),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SESSION_SECRET: '', DATABASE_URL: '',
      NEXT_PUBLIC_APP_ENV: 'local', NEXT_PUBLIC_APP_URL: `http://localhost:${port}`, FILE_SCAN_MODE: 'disabled-local' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  const exited = new Promise(resolve => child.once('exit', resolve));
  try {
    const ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Production test server did not start.')); }, 30000);
      const inspect = () => { if (logs.includes('Ready in')) { cleanup(); resolve(); } };
      const failed = () => { cleanup(); reject(new Error('Production test server exited.')); };
      const cleanup = () => { clearTimeout(timeout); child.stdout.off('data', inspect); child.off('exit', failed); child.off('error', failed); };
      child.stdout.on('data', inspect); child.once('exit', failed); child.once('error', failed);
      inspect();
    });
    await ready;
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(body.error.message, 'Backend is not configured or unavailable.');
    const records = logs.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
    const matching = records.find(log => log.requestId === body.error.requestId);
    assert.equal(matching?.event, 'backend.unavailable');
    assert.equal(matching?.stage, 'configuration');
    assert.equal(matching?.category, 'configuration_invalid');
    assert.deepEqual(Object.keys(matching).sort(), ['category', 'event', 'requestId', 'stage']);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await exited;
  }
});
