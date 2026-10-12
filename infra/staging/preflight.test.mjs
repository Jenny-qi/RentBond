import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkOperatorEnv, checkEnvFile } from './preflight.mjs';

const fixture = () => ({
  NEXT_PUBLIC_APP_URL: 'https://staging.rentbond.test', RENTBOND_SITE_HOST: 'staging.rentbond.test',
  NEXT_PUBLIC_RPC_URL: 'https://rpc.rentbond.test', RPC_URL: 'https://rpc.rentbond.test',
  NEXT_PUBLIC_FACTORY_ADDRESS: '0x' + '1'.repeat(40),
  NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS: '0x' + '2'.repeat(40),
  CHAIN_CONFIRMATIONS: '2', DEPLOYMENT_BLOCK: '10',
  RENTBOND_DB_PASSWORD: 'a'.repeat(64), RENTBOND_APP_DB_PASSWORD: 'b'.repeat(64), SESSION_SECRET: 'c'.repeat(64),
});

test('operator env file loads without exposing credentials in success output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rentbond-preflight-'));
  try {
    const env = fixture(), path = join(dir, '.env.staging');
    await writeFile(path, Object.entries(env).map(([k,v]) => `${k}=${v}`).join('\n'), {mode:0o600});
    assert.equal((await checkEnvFile(path)).configuration, 'passed');
    const result = spawnSync(process.execPath, ['infra/staging/preflight.mjs', path], {encoding:'utf8'});
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).chainId, 10143);
    for (const key of ['RENTBOND_DB_PASSWORD', 'RENTBOND_APP_DB_PASSWORD', 'SESSION_SECRET'])
      assert.ok(!(result.stdout + result.stderr).includes(env[key]));
  } finally { await rm(dir, {recursive:true,force:true}); }
});

test('URL-delimiter passwords, reused secrets and unsupported HTTPS port block deployment', () => {
  const env = fixture();
  for (const changes of [
    {RENTBOND_APP_DB_PASSWORD: 'password@wrong-db/path'},
    {RENTBOND_DB_PASSWORD: env.RENTBOND_APP_DB_PASSWORD},
    {SESSION_SECRET: env.RENTBOND_DB_PASSWORD},
    {NEXT_PUBLIC_APP_URL: 'https://staging.rentbond.test:8443', RENTBOND_SITE_HOST: 'staging.rentbond.test:8443'},
    {DEPLOYMENT_BLOCK: ''}, {RPC_URL: ''},
  ]) assert.throws(() => checkOperatorEnv({...env,...changes}));
});

test('malformed env input fails nonzero and never echoes its private contents', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rentbond-preflight-'));
  try {
    const marker = 'PRIVATE_VALUE_DO_NOT_PRINT', path = join(dir, '.env.staging');
    await writeFile(path, `SESSION_SECRET=${marker}\n`, {mode:0o600});
    const result = spawnSync(process.execPath, ['infra/staging/preflight.mjs', path], {encoding:'utf8'});
    assert.equal(result.status, 1);
    assert.ok(!(result.stdout + result.stderr).includes(marker));
  } finally { await rm(dir, {recursive:true,force:true}); }
});
