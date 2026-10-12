// Read-only live configuration probe. Never creates a wallet or sends transactions.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalJson } from '../../packages/shared/src/commitments/index.ts';
import { checkOperatorEnv } from './preflight.mjs';
import { DEMO_SHORT_TIMING } from './demo-short.mjs';
import artifacts from '../../apps/web/src/server/contracts.generated.json' with { type: 'json' };
import tokenAbi from '../../deployments/abi/MockUSD.json' with { type: 'json' };

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { createPublicClient, http, keccak256, stringToHex } = require('viem');
const address = /^0x[0-9a-fA-F]{40}$/;
const hash = /^0x[0-9a-fA-F]{64}$/;
const policy = keccak256(stringToHex('TIMEOUT_RETURN_UNAWARDED_TO_TENANT'));
const serialize = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));
const sameAddress = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
function need(ok, code) { if (!ok) throw new Error(code); }
function hasCode(code) { return typeof code === 'string' && /^0x(?:[0-9a-fA-F]{2})+$/.test(code) && !/^0x(?:00)+$/.test(code); }
function normalize(profile) {
  const result = serialize(profile);
  for (const name of ['primaryResolver', 'fallbackResolver', 'token']) result[name] = String(result[name]).toLowerCase();
  return result;
}

export async function checkStagingChain(env, expectedService, {
  clientFor = url => createPublicClient({ cacheTime: 0, transport: http(url, { timeout: 8000, retryCount: 0 }) }),
} = {}) {
  for (const key of ['NEXT_PUBLIC_FACTORY_ADDRESS', 'NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS'])
    need(address.test(env[key] ?? '') && !/^0x0{40}$/i.test(env[key]), 'INVALID_CONTRACT_ADDRESS');
  need(/^\d+$/.test(env.DEPLOYMENT_BLOCK ?? ''), 'INVALID_DEPLOYMENT_BLOCK');
  need(/^\d+$/.test(env.CHAIN_CONFIRMATIONS ?? '') && BigInt(env.CHAIN_CONFIRMATIONS) > 0n, 'INVALID_CONFIRMATIONS');
  need(env.RPC_URL && env.NEXT_PUBLIC_RPC_URL, 'RPC_REQUIRED');
  const endpoints = [...new Set([env.RPC_URL, env.NEXT_PUBLIC_RPC_URL, env.RPC_FALLBACK_URL].filter(Boolean))];
  const clients = endpoints.map(clientFor);
  // Every configured endpoint must respond on the same network; no silent fallback.
  for (const client of clients) need(await client.getChainId() === 10143, 'RPC_CHAIN_MISMATCH');
  const client = clientFor(env.RPC_URL);
  const latest = await client.getBlock();
  const blockNumber = latest.number - BigInt(env.CHAIN_CONFIRMATIONS) + 1n;
  need(blockNumber >= 0n && BigInt(env.DEPLOYMENT_BLOCK) <= blockNumber, 'DEPLOYMENT_NOT_CONFIRMED');
  const block = await client.getBlock({ blockNumber });
  need(hash.test(block.hash ?? ''), 'INVALID_BLOCK');
  const at = { blockNumber };
  const factory = env.NEXT_PUBLIC_FACTORY_ADDRESS, registry = env.NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS;
  const read = (target, abi, functionName, args = []) => client.readContract({ address: target, abi, functionName, args, ...at });
  const actualRegistry = await read(factory, artifacts.LeaseFactory, 'registry');
  need(sameAddress(actualRegistry, registry), 'FACTORY_REGISTRY_MISMATCH');
  const deployer = await read(factory, artifacts.LeaseFactory, 'escrowDeployer');
  need(address.test(deployer) && !/^0x0{40}$/i.test(deployer), 'INVALID_ESCROW_DEPLOYER');
  for (const c of clients) {
    need((await c.getBlock(at)).hash === block.hash, 'RPC_BLOCK_MISMATCH');
    for (const target of [factory, registry, deployer]) need(hasCode(await c.getCode({ address: target, ...at })), 'CONTRACT_CODE_MISSING');
  }
  need(hasCode(await client.getCode({ address: factory, blockNumber: BigInt(env.DEPLOYMENT_BLOCK) })), 'FACTORY_MISSING_AT_RECORDED_BLOCK');
  const blockers = [];
  if (!expectedService) blockers.push('DEMO_SHORT_SERVICE_NOT_SUPPLIED');
  else {
    need(expectedService.chainId === 10143 && sameAddress(expectedService.registryAddress, registry), 'SERVICE_ENVIRONMENT_MISMATCH');
    const expected = expectedService.profile;
    need(expected && hash.test(expected.profileId ?? '') && !/^0x0{64}$/i.test(expected.profileId), 'INVALID_PROFILE_ID');
    need(expected.timeoutPolicy === policy && canonicalJson(expected.timing) === canonicalJson(DEMO_SHORT_TIMING), 'NOT_DEMO_SHORT');
    const [profileRaw, status] = await read(registry, artifacts.ResolverRegistry, 'getProfile', [expected.profileId]);
    const profile = serialize(profileRaw);
    need(canonicalJson(normalize(profile)) === canonicalJson(normalize(expected)), 'SERVICE_PARAMETER_MISMATCH');
    need(hasCode(await client.getCode({ address: profile.token, ...at })), 'TOKEN_CODE_MISSING');
    need(Number(await read(profile.token, tokenAbi, 'decimals')) === 6, 'TOKEN_DECIMALS_MISMATCH');
    if (!status.exists) blockers.push('SERVICE_NOT_CREATED');
    if (!status.primaryAccepted) blockers.push('PRIMARY_NOT_ACCEPTED');
    if (!status.fallbackAccepted) blockers.push('FALLBACK_NOT_ACCEPTED');
    if (status.closedForNewFunding) blockers.push('SERVICE_CLOSED');
    if (BigInt(profile.acceptUntil) <= block.timestamp || BigInt(profile.maxLeaseEnd) <= block.timestamp) blockers.push('SERVICE_EXPIRED');
  }
  need((await client.getBlock(at)).hash === block.hash, 'BLOCK_CHANGED_DURING_READ');
  return { chainId: 10143, blockNumber: blockNumber.toString(), blockHash: block.hash,
    contractConnectivity: 'passed', demoShort: blockers.length ? 'blocked' : 'passed', blockers,
    liveProductReady: false,
    boundary: 'Read-only configuration snapshot. No source attestation, exact deployment-block proof, private manifest import, browser CORS, HTTPS, database, scanner, Worker, device or funds-flow acceptance.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [file, profileFile] = process.argv.slice(2);
    need(file && process.argv.length <= 4, 'USAGE');
    const env = parseEnv(await readFile(file, 'utf8'));
    checkOperatorEnv(env);
    const service = profileFile ? JSON.parse(await readFile(profileFile, 'utf8')) : undefined;
    const result = await checkStagingChain(env, service);
    console.log(JSON.stringify(result, null, 2));
    if (result.blockers.length) process.exitCode = 2;
  } catch {
    // RPC/viem errors may contain credentialed URLs and call data. Never echo them.
    console.error('Read-only chain preflight failed. Check env, RPC connectivity, Factory/Registry, deployment block and the exact DEMO_SHORT profile. Private values are not logged.');
    process.exitCode = 1;
  }
}
