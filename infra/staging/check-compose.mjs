// Validate both deployment configurations using generated, non-secret fixtures.
// Requires Docker Compose CLI, but no daemon, cloud account or RPC access.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'rentbond-compose-'));
try {
  const file = join(directory, '.env.fixture'), key = join(directory, 'worker.key');
  await writeFile(key, 'fixture-not-a-signing-key', {mode:0o600});
  await writeFile(file, [
    'NEXT_PUBLIC_APP_URL=https://staging.rentbond.test', 'RENTBOND_SITE_HOST=staging.rentbond.test',
    'NEXT_PUBLIC_RPC_URL=https://rpc.rentbond.test', 'RPC_URL=https://rpc.rentbond.test',
    'NEXT_PUBLIC_FACTORY_ADDRESS=0x'+'1'.repeat(40),
    'NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS=0x'+'2'.repeat(40),
    'CHAIN_CONFIRMATIONS=2', 'DEPLOYMENT_BLOCK=10',
    'RENTBOND_DB_PASSWORD=admin-fixture', 'RENTBOND_APP_DB_PASSWORD=app-fixture',
    'SESSION_SECRET=fixture-session-'.padEnd(64,'x'),
    'WORKER_GAS_ACCOUNT=0x'+'3'.repeat(40), 'RENTBOND_WORKER_KEY_PATH='+key,
  ].join('\n'), {mode:0o600});
  const binary = process.argv[2] ?? 'docker', prefix = process.argv[2] ? [] : ['compose'];
  for (const execute of [false,true]) {
    const args = [...prefix,'--env-file',file,'-f','infra/staging/compose.yaml'];
    if (execute) args.push('-f','infra/staging/compose.execute.yaml');
    args.push('--profile','public','config','--format','json');
    const result = spawnSync(binary,args,{encoding:'utf8',maxBuffer:2*1024*1024});
    if (result.error || result.status !== 0) throw new Error('Compose config validation failed.');
    const {services} = JSON.parse(result.stdout);
    for (const name of ['database','scanner','migrate','api-worker','chain-worker'])
      assert.ok(!services[name].ports?.length, `${name} must not publish host ports`);
    assert.equal(services.web.ports[0].host_ip,'127.0.0.1');
    for (const name of ['web','api-worker','chain-worker']) {
      assert.equal(services[name].depends_on.migrate.condition,'service_completed_successfully');
      assert.equal(services[name].depends_on.scanner.condition,'service_healthy');
      assert.equal(services[name].environment.CHAIN_ID,'10143');
      assert.equal(services[name].environment.FILE_SCAN_MODE,'clamav');
    }
    assert.equal(services.migrate.depends_on.database.condition,'service_healthy');
    assert.equal(services['chain-worker'].environment.WORKER_EXECUTE, String(execute));
    assert.equal(services.web.environment.WORKER_EXECUTE,'false');
    assert.equal(services['api-worker'].environment.WORKER_EXECUTE,'false');
    assert.equal(services.https.depends_on.web.condition,'service_healthy');
    const build = services.web.build.args;
    assert.ok(!('SESSION_SECRET' in build)); assert.ok(!('DATABASE_URL' in build));
    assert.ok(!('TEST_GAS_SPONSOR_PRIVATE_KEY' in build));
    console.log(`Compose ${execute ? 'explicit executor overlay' : 'read-only staging'} validated; container runtime not exercised.`);
  }
} catch {
  console.error('Staging Compose validation failed; no resolved environment values are logged.');
  process.exitCode = 1;
} finally { await rm(directory,{recursive:true,force:true}); }
