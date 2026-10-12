import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackendStartupError, backendUnavailableResponse } from '../startup-diagnostics.ts';
import { getApp } from '../runtime.ts';

test('startup failure log and HTTP response correlate without exposing private error details', async () => {
  const secret = 'PRIVATE_DATABASE_PASSWORD_AND_FILE_PATH';
  for (const [stage, code, category] of [
    ['configuration', undefined, 'configuration_invalid'],
    ['database', 'ECONNREFUSED', 'database_unavailable'],
    ['migrations', '28P01', 'database_authentication'],
    ['migrations', '42501', 'database_permission'],
    ['migrations', '42P01', 'migration_required'],
    ['services', undefined, 'services_initialization'],
  ]) {
    const lines = [];
    const error = Object.assign(new Error(secret), { code });
    const response = backendUnavailableResponse(new BackendStartupError(stage, error), line => lines.push(line));
    const body = await response.json(), log = JSON.parse(lines[0]);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(log.category, category);
    assert.equal(log.stage, stage);
    assert.equal(log.requestId, body.error.requestId);
    assert.deepEqual(Object.keys(log).sort(), ['category', 'event', 'requestId', 'stage']);
    assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message', 'requestId', 'retryable']);
    assert.ok(!JSON.stringify([lines, body]).includes(secret));
    assert.ok(!JSON.stringify(body).includes(category));
  }
  const lines = [];
  backendUnavailableResponse({ name: secret, message: secret, code: secret }, line => lines.push(line));
  assert.equal(JSON.parse(lines[0]).category, 'backend_unknown');
  assert.ok(!lines[0].includes(secret));
});

test('real runtime distinguishes missing configuration and migration, closes DB and retries initialization', async () => {
  const saved = { ...process.env }, dir = await mkdtemp(join(tmpdir(), 'rentbond-startup-'));
  try {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, {
      NEXT_PUBLIC_APP_ENV: 'local', NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      RENTBOND_DATA_DIR: dir, FILE_SCAN_MODE: 'disabled-local',
    });
    await assert.rejects(getApp(), e => e.category === 'configuration_invalid');
    assert.equal(globalThis.rentbondBackend, undefined);
    process.env.SESSION_SECRET = 'isolated-fixture-session-secret-'.repeat(2);
    for (let retry = 0; retry < 2; retry++) {
      await assert.rejects(getApp(), e => e.stage === 'migrations' && e.category === 'migration_required');
      assert.equal(globalThis.rentbondBackend, undefined);
    }
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, saved);
    delete globalThis.rentbondBackend;
    await rm(dir, { recursive: true, force: true });
  }
});
