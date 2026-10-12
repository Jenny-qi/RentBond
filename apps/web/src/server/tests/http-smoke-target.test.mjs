import test from 'node:test';
import assert from 'node:assert/strict';
import { smokeTarget } from './http-smoke-target.mjs';

test('HTTP smoke defaults to loopback and rejects unacknowledged public writes', () => {
  assert.equal(smokeTarget({ RENTBOND_TEST_BASE_URL: 'http://localhost:3000' }).publicTest, false);
  assert.throws(() => smokeTarget({ RENTBOND_TEST_BASE_URL: 'https://example.com' }));
  assert.throws(() => smokeTarget({ RENTBOND_TEST_BASE_URL: 'https://example.com' }, ['--public-testnet']));
  assert.throws(() => smokeTarget({ RENTBOND_TEST_BASE_URL: 'https://example.com',
    RENTBOND_TEST_PUBLIC_ORIGIN: 'https://other.example' }, ['--public-testnet']));
});

test('public smoke requires an exact HTTPS origin without credentials or hidden target components', () => {
  const target = (origin) => smokeTarget({ RENTBOND_TEST_BASE_URL: origin,
    RENTBOND_TEST_PUBLIC_ORIGIN: origin }, ['--public-testnet']);
  assert.equal(target('https://example.com').publicTest, true);
  for (const origin of ['http://example.com', 'https://localhost',
    'https://user:secret@example.com', 'https://example.com/path',
    'https://example.com?key=value', 'https://example.com#fragment', 'https://example.com/'])
    assert.throws(() => target(origin));
});
