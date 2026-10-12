import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareDemoShort } from './demo-short.mjs';
import { checkStagingChain } from './chain-preflight.mjs';

const addr = n => '0x' + String(n).repeat(40), hash = n => '0x' + String(n).repeat(64);
const env = { RPC_URL: 'https://server.test', NEXT_PUBLIC_RPC_URL: 'https://browser.test', RPC_FALLBACK_URL: 'https://fallback.test',
  NEXT_PUBLIC_FACTORY_ADDRESS: addr(1), NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS: addr(2), DEPLOYMENT_BLOCK: '10', CHAIN_CONFIRMATIONS: '2' };
const draft = prepareDemoShort({ chainId: 10143, registryAddress: addr(2), primaryResolver: addr(4),
  fallbackResolver: addr(5), token: addr(6), maxDeposit: '1000000000', maxLeaseEnd: '2000000000',
  acceptUntil: '1999999999', serviceText: 'Fictional terms exclusively for isolated automated configuration tests.' }, { now: 1900000000 }).publicDraft;
function fixture(changes = {}) {
  const calls = [];
  const status = { exists: true, primaryAccepted: true, fallbackAccepted: true, closedForNewFunding: false, ...changes.status };
  const profile = { ...draft.profile, ...changes.profile };
  const clientFor = url => ({
    async getChainId() { calls.push([url, 'chain']); return url === changes.wrongChain ? 1 : 10143; },
    async getBlock(args) { calls.push([url, 'block', args]); return { number: args?.blockNumber ?? 100n, timestamp: 1900000000n,
      hash: url === changes.wrongBlock || (changes.reorg && calls.filter(c => c[1] === 'block').length > 5) ? hash(8) : hash(7) }; },
    async getCode(args) { calls.push([url, 'code', args]); return args.address === changes.noCode ? '0x' : '0x6001'; },
    async readContract(args) {
      calls.push([url, 'read', args]);
      assert.ok(args.abi?.some(item => item.type === 'function' && item.name === args.functionName), 'Use a generated function ABI for every read');
      if (args.functionName === 'registry') return changes.registry ?? addr(2);
      if (args.functionName === 'escrowDeployer') return addr(3);
      if (args.functionName === 'getProfile') return [profile, status];
      if (args.functionName === 'decimals') return changes.decimals ?? 6;
      throw new Error('Unexpected method');
    },
  });
  return { clientFor, calls };
}

test('accepted service is checked at one confirmed block, without claiming a live product', async () => {
  const f = fixture(), result = await checkStagingChain(env, draft, f);
  assert.equal(result.blockNumber, '99');
  assert.equal(result.demoShort, 'passed');
  assert.equal(result.liveProductReady, false);
  assert.deepEqual(result.blockers, []);
  assert.ok(f.calls.filter(c => c[1] === 'read').every(c => c[2].blockNumber === 99n));
  assert.ok(f.calls.some(c => c[1] === 'code' && c[2].blockNumber === 10n));
  assert.deepEqual([...new Set(f.calls.filter(c => c[1] === 'chain').map(c => c[0]))].sort(),
    [env.RPC_URL, env.NEXT_PUBLIC_RPC_URL, env.RPC_FALLBACK_URL].sort());
});

test('missing, unaccepted, closed and expired profiles remain blocked', async () => {
  assert.deepEqual((await checkStagingChain(env, undefined, fixture())).blockers, ['DEMO_SHORT_SERVICE_NOT_SUPPLIED']);
  for (const [status, code] of [[{primaryAccepted:false}, 'PRIMARY_NOT_ACCEPTED'], [{fallbackAccepted:false}, 'FALLBACK_NOT_ACCEPTED'],
    [{closedForNewFunding:true}, 'SERVICE_CLOSED'], [{exists:false}, 'SERVICE_NOT_CREATED']])
    assert.ok((await checkStagingChain(env, draft, fixture({status}))).blockers.includes(code));
  const expired = {...draft, profile:{...draft.profile,acceptUntil:'1900000000'}};
  assert.ok((await checkStagingChain(env, expired, fixture({profile:expired.profile}))).blockers.includes('SERVICE_EXPIRED'));
});

test('wrong endpoint chain, mismatched block, missing code and Factory pointer fail closed', async () => {
  for (const [changes, code] of [[{wrongChain:env.NEXT_PUBLIC_RPC_URL}, 'RPC_CHAIN_MISMATCH'],
    [{wrongChain:env.RPC_FALLBACK_URL}, 'RPC_CHAIN_MISMATCH'], [{wrongBlock:env.NEXT_PUBLIC_RPC_URL}, 'RPC_BLOCK_MISMATCH'],
    [{noCode:addr(3)}, 'CONTRACT_CODE_MISSING'], [{registry:addr(9)}, 'FACTORY_REGISTRY_MISMATCH'],
    [{reorg:true}, 'BLOCK_CHANGED_DURING_READ']])
    await assert.rejects(checkStagingChain(env, draft, fixture(changes)), new RegExp(code));
  await assert.rejects(checkStagingChain({...env,DEPLOYMENT_BLOCK:'100'}, draft, fixture()), /DEPLOYMENT_NOT_CONFIRMED/);
});

test('wrong service parameters, timing, environment and token decimals are rejected', async () => {
  await assert.rejects(checkStagingChain(env, draft, fixture({profile:{maxDeposit:'2000000000'}})), /SERVICE_PARAMETER_MISMATCH/);
  await assert.rejects(checkStagingChain(env, {...draft,registryAddress:addr(9)}, fixture()), /SERVICE_ENVIRONMENT_MISMATCH/);
  await assert.rejects(checkStagingChain(env, {...draft,profile:{...draft.profile,timing:{...draft.profile.timing,claim:'601'}}}, fixture()), /NOT_DEMO_SHORT/);
  await assert.rejects(checkStagingChain(env, draft, fixture({decimals:18})), /TOKEN_DECIMALS_MISMATCH/);
});

test('CLI failure is nonzero and cannot expose credentials from malformed operator input', async t => {
  const dir = await mkdtemp(join(tmpdir(),'rentbond-chain-preflight-'));
  t.after(() => rm(dir,{recursive:true,force:true}));
  const file = join(dir,'operator.env'), marker = 'PRIVATE_MARKER_NEVER_PRINT';
  await writeFile(file,`SESSION_SECRET=${marker}\nRPC_URL=https://user:${marker}@rpc.test\n`,{mode:0o600});
  const result = spawnSync(process.execPath,['infra/staging/chain-preflight.mjs',file],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.ok(!(result.stdout+result.stderr).includes(marker));
});
