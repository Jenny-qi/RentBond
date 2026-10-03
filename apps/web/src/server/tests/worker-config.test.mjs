import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadWorkerConfig } from '../../../../worker/src/config.ts';
const config = {
  NEXT_PUBLIC_APP_ENV: 'local', NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  SESSION_SECRET: 'test-only-session-secret-32-characters', CHAIN_ID: '31337',
  RPC_URL: 'http://localhost:8545/private-test-token',
  NEXT_PUBLIC_FACTORY_ADDRESS: '0x' + '12'.repeat(20), DEPLOYMENT_BLOCK: '0',
};

test('Worker configuration rejects non-test chain, unsafe intervals and incomplete signing configuration', () => {
  assert.equal(loadWorkerConfig(config).execute, false);
  assert.equal(loadWorkerConfig({...config, CHAIN_ID:'10143'}).chainId, 10143);
  for (const chain of ['1','56','137']) assert.throws(() => loadWorkerConfig({...config,CHAIN_ID:chain}), /WORKER_TEST_CHAIN_REQUIRED/);
  for (const interval of ['0','1','999','300001','1.5']) assert.throws(() => loadWorkerConfig({...config,WORKER_POLL_INTERVAL_MS:interval}));
  assert.throws(() => loadWorkerConfig({...config,WORKER_EXECUTE:'true'}));
  assert.throws(() => loadWorkerConfig({...config,WORKER_MAX_FEE_WEI:'0'}));
  assert.throws(() => loadWorkerConfig({...config,FACTORY_ADDRESS:'0x'+'34'.repeat(20)}), /FACTORY_CONFIG_MISMATCH/);
});

test('Worker health uses runtime configuration and never prints private environment values', () => {
  const root = fileURLToPath(new URL('../../../../../',import.meta.url));
  const probe = (overrides={}) => spawnSync(process.execPath,['scripts/worker-health.mjs'],{cwd:root,env:{PATH:process.env.PATH,...config,...overrides},encoding:'utf8'});
  let result = probe();
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/configuration valid/);
  assert.match(result.stdout,/connectivity not checked/);
  assert.doesNotMatch(result.stdout+result.stderr,/private-test-token|test-only-session-secret/);
  result = probe({CHAIN_ID:'1',WORKER_PRIVATE_KEY_FILE:'secret-key-path'});
  assert.equal(result.status,1);
  assert.doesNotMatch(result.stdout+result.stderr,/private-test-token|secret-key-path|test-only-session-secret/);
});
