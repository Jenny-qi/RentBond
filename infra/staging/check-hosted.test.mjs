import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHostedEnv } from './check-hosted.mjs';

const env = () => ({
  NEXT_PUBLIC_APP_ENV: 'testnet', NEXT_PUBLIC_APP_URL: 'https://rentbond-nine.vercel.app',
  NEXT_PUBLIC_CHAIN_ID: '10143', CHAIN_ID: '10143', CHAIN_CONFIRMATIONS: '2',
  NEXT_PUBLIC_RPC_URL: 'https://rpc.example.test', RPC_URL: 'https://rpc.example.test',
  NEXT_PUBLIC_FACTORY_ADDRESS: '0x' + '1'.repeat(40),
  NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS: '0x' + '2'.repeat(40),
  SESSION_SECRET: 'PRIVATE_SESSION_SECRET_VALUE'.repeat(2),
  DATABASE_URL: 'postgresql://fixture:PRIVATE_PASSWORD@db.example.test/rentbond',
  STORAGE_URL: 'https://storage.example.test', STORAGE_SERVICE_KEY: 'PRIVATE_STORAGE_KEY',
  CLAMAV_HOST: 'scanner.internal.example.test', FILE_SCAN_MODE: 'clamav',
  DEPLOYMENT_BLOCK: '10', WORKER_EXECUTE: 'false',
});
test('hosted check accepts configuration only and never claims live readiness or reveals values', () => {
  const input = env(), result = checkHostedEnv(input);
  assert.equal(result.configuration, 'passed');
  assert.equal(result.liveProductReady, false);
  assert.equal(result.checks.length, 6);
  for (const value of [input.DATABASE_URL, input.SESSION_SECRET, input.STORAGE_SERVICE_KEY, input.CLAMAV_HOST])
    assert.ok(!JSON.stringify(result).includes(value));
});
test('Vercel candidate rejects local dependencies, absent durable storage, scan bypass and unscheduled Worker config', () => {
  for (const changes of [
    { DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1/rentbond' },
    { STORAGE_URL: '', STORAGE_SERVICE_KEY: '' },
    { STORAGE_URL: 'http://storage.example.test' },
    { CLAMAV_HOST: '127.0.0.1' }, { CLAMAV_HOST: 'scanner' },
    { FILE_SCAN_MODE: 'disabled-local' }, { DEPLOYMENT_BLOCK: '' },
    { NEXT_PUBLIC_APP_ENV: 'local' }, { WORKER_EXECUTE: 'true' },
    { STORAGE_BUCKET: 'same', STORAGE_QUARANTINE_BUCKET: 'same' },
    { NEXT_PUBLIC_CHAIN_ID: '1' },
  ]) assert.equal(checkHostedEnv({ ...env(), ...changes }).configuration, 'failed');
});
