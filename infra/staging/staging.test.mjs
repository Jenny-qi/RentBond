import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { publicConfig, validateRuntime } from './config.mjs';
import { checkSite } from './smoke.mjs';

function env() {
  return {
    NEXT_PUBLIC_APP_ENV: 'testnet', NEXT_PUBLIC_CHAIN_ID: '10143',
    NEXT_PUBLIC_APP_URL: 'https://staging.rentbond.test', RENTBOND_SITE_HOST: 'staging.rentbond.test',
    NEXT_PUBLIC_RPC_URL: 'https://rpc.rentbond.test', RPC_URL: 'https://private-rpc.rentbond.test',
    NEXT_PUBLIC_FACTORY_ADDRESS: '0x' + '1'.repeat(40),
    NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS: '0x' + '2'.repeat(40),
    CHAIN_CONFIRMATIONS: '2', CHAIN_ID: '10143', DEPLOYMENT_BLOCK: '10',
    SESSION_SECRET: 'fixture-session-'.repeat(4), DATABASE_URL: 'postgresql://fixture:fixture@database/rentbond',
    FILE_SCAN_MODE: 'clamav', CLAMAV_HOST: 'scanner', RENTBOND_DATA_DIR: '/data',
    TRUST_PROXY: 'false', WORKER_EXECUTE: 'false',
  };
}
test('server secrets are excluded from public build record', () => {
  const runtime = env(), built = publicConfig(runtime);
  assert.ok(!JSON.stringify(built).includes(runtime.SESSION_SECRET));
  assert.ok(!JSON.stringify(built).includes(runtime.DATABASE_URL));
  assert.deepEqual(validateRuntime(runtime, built), built);
});
test('changing browser network, contract, origin or confirmation policy requires rebuilding', () => {
  const runtime = env(), built = publicConfig(runtime);
  for (const changes of [
    {NEXT_PUBLIC_CHAIN_ID: '1'}, {NEXT_PUBLIC_FACTORY_ADDRESS: '0x' + '3'.repeat(40)},
    {NEXT_PUBLIC_APP_URL: 'https://other.rentbond.test'}, {CHAIN_CONFIRMATIONS: '3'},
  ]) assert.throws(() => validateRuntime({...runtime, ...changes}, built));
});
test('server-only mistakes, wrong TLS host, scan bypass and embedded DB block startup', () => {
  const runtime = env(), built = publicConfig(runtime);
  for (const changes of [
    {CHAIN_ID:'1'}, {DATABASE_URL:''}, {DATABASE_URL:'https://database.test'},
    {SESSION_SECRET:'short'}, {FILE_SCAN_MODE:'disabled-local'}, {TRUST_PROXY:'true'},
    {DEPLOYMENT_BLOCK:''}, {RENTBOND_SITE_HOST:'other.rentbond.test'},
    {STORAGE_URL:'https://storage.test',STORAGE_SERVICE_KEY:'fixture'},
    {WORKER_EXECUTE:'true'},
  ]) assert.throws(() => validateRuntime({...runtime,...changes}, built));
});
test('browser RPC credentials and template origins are rejected', () => {
  for (const url of ['https://user:private@rpc.test', 'https://rpc.test/?key=private', 'http://rpc.test'])
    assert.throws(() => publicConfig({...env(), NEXT_PUBLIC_RPC_URL:url}));
  assert.throws(() => publicConfig({...env(), NEXT_PUBLIC_APP_URL:'https://example.invalid'}));
});
test('CLI fails nonzero without disclosing secret values or malformed file contents', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rentbond-staging-'));
  try {
    const file = join(directory, 'public.json'), privateMarker = 'PRIVATE_VALUE_DO_NOT_PRINT';
    await writeFile(file, privateMarker);
    const result = spawnSync(process.execPath, ['infra/staging/config.mjs', 'check', file], {
      env:{...process.env,...env(),SESSION_SECRET:privateMarker}, encoding:'utf8',
    });
    assert.equal(result.status, 1);
    assert.ok(!result.stderr.includes(privateMarker));
    assert.ok(!result.stdout.includes(privateMarker));
  } finally { await rm(directory, {recursive:true,force:true}); }
});
test('real HTTP smoke refuses incomplete dependencies and unexpected redirects', async () => {
  let healthy = true, redirect = false;
  const server = createServer((request,response) => {
    if (redirect) { response.writeHead(302,{location:'/login'}); response.end(); return; }
    if (request.url === '/') {
      response.writeHead(200, {'content-type':'text/html'}); response.end('<html>fixture</html>');
    } else {
      response.writeHead(200, {'content-type':'application/json'});
      response.end(JSON.stringify({database:true,storage:true,quarantine:true,scanner:true,rpc:healthy ? true : 'not_configured'}));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server,'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await checkSite(origin)).dependencies,'passed');
    healthy = false; await assert.rejects(checkSite(origin), /dependencies/);
    redirect = true; await assert.rejects(checkSite(origin));
    await assert.rejects(checkSite('http://public.rentbond.test'));
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
