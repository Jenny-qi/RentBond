// Offline preparation only. No RPC, account, signing or broadcasting capability.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalJson, computeTermsCommitment } from '../../packages/shared/src/commitments/index.ts';
import artifacts from '../../apps/web/src/server/contracts.generated.json' with { type: 'json' };

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { encodeAbiParameters, encodeFunctionData, keccak256, stringToHex, isAddress } = require('viem');
const abi = artifacts.ResolverRegistry;
const zero = '0x' + '00'.repeat(32);
const timeoutPolicy = keccak256(stringToHex('TIMEOUT_RETURN_UNAWARDED_TO_TENANT'));
export const DEMO_SHORT_TIMING = Object.freeze({ checkoutResponse: '300', claim: '600', response: '600',
  evidence: '300', primary: '600', challenge: '300', fallbackEvidence: '300', fallbackResolver: '900', exitNotice: '300' });
const functionAbi = name => abi.find(item => item.type === 'function' && item.name === name);
const digest = (types, values) => keccak256(encodeAbiParameters(types, values));
function address(value, field) {
  if (typeof value !== 'string' || !isAddress(value, { strict: false }) || /^0x0{40}$/i.test(value))
    throw new Error('Provide a nonzero ' + field + ' address.');
  return value.toLowerCase();
}
function integer(value, field) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Provide ' + field + ' as a safe unsigned decimal string.');
  return value;
}

export function prepareDemoShort(input, { now = Math.floor(Date.now() / 1000), salt = '0x' + randomBytes(32).toString('hex') } = {}) {
  if (!input || input.chainId !== 10143) throw new Error('Only Monad Testnet chainId 10143 is supported.');
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid preparation time.');
  const registryAddress = address(input.registryAddress, 'Registry');
  const primaryResolver = address(input.primaryResolver, 'primary resolver');
  const fallbackResolver = address(input.fallbackResolver, 'fallback resolver');
  const token = address(input.token, 'MockUSD');
  if (primaryResolver === fallbackResolver) throw new Error('R and F must be different accounts.');
  const maxDeposit = integer(input.maxDeposit, 'maxDeposit');
  if (BigInt(maxDeposit) < 1000000n || BigInt(maxDeposit) > 10000000000n || BigInt(maxDeposit) % 10000n !== 0n)
    throw new Error('Deposit must be 1–10,000 MockUSD in 0.01 units (6 decimals).');
  const maxLeaseEnd = integer(input.maxLeaseEnd, 'maxLeaseEnd');
  const acceptUntil = integer(input.acceptUntil, 'acceptUntil');
  if (Number(acceptUntil) <= now || Number(maxLeaseEnd) <= now || Number(acceptUntil) > Number(maxLeaseEnd))
    throw new Error('Use future expiry timestamps with acceptUntil <= maxLeaseEnd.');
  if (typeof input.serviceText !== 'string' || input.serviceText.trim().length < 20)
    throw new Error('Supply the actual service terms for R/F review.');
  const timing = { ...DEMO_SHORT_TIMING };
  const timingProfileId = digest(functionAbi('computeTimingProfileId').inputs, [timing, timeoutPolicy]);
  const parameters = { ruleVersion: '1', primaryResolver, fallbackResolver, token, maxDeposit,
    maxLeaseEnd, acceptUntil, timingProfileId, timeoutPolicy, timing };
  const manifest = { schemaVersion: '1.0.0',
    text: '[DEMO_SHORT: Monad Testnet only; test assets; shortened deadlines.]\n' + input.serviceText,
    parameters };
  const serviceTermsHash = computeTermsCommitment(canonicalJson(manifest), salt);
  const components = functionAbi('computeProfileId').inputs[0].components.filter(item => item.name !== 'profileId');
  const profile = { profileId: zero, serviceTermsHash, ...parameters };
  profile.profileId = digest(components, components.map(item => profile[item.name]));
  const unsigned = (functionName, args, role, expectedSigner = null) => ({ chainId: 10143,
    to: registryAddress, value: '0', data: encodeFunctionData({ abi, functionName, args }),
    functionName, role, expectedSigner });
  return {
    // Explicit review is still required; this draft cannot be imported as reviewed.
    privateDraft: { profileId: profile.profileId, reviewed: false, manifest, salt },
    publicDraft: { status: 'draft-not-deployed', chainId: 10143, registryAddress, profile,
      hardEndOffsetSeconds: ['claim', 'response', 'evidence', 'primary', 'challenge', 'fallbackResolver', 'exitNotice']
        .reduce((sum, field) => sum + Number(timing[field]), 0), checkoutRetrySeconds: 86400,
      transactions: [unsigned('createProfile', [profile], 'profile creator'),
        unsigned('acceptProfile', [profile.profileId], 'R', primaryResolver),
        unsigned('acceptProfile', [profile.profileId], 'F', fallbackResolver)] },
    deploymentEnv: ['CHAIN_ID=10143', 'REGISTRY_ADDRESS=' + registryAddress,
      'DEMO_SHORT_SERVICE_TERMS_HASH=' + serviceTermsHash, 'PRIMARY_RESOLVER=' + primaryResolver,
      'FALLBACK_RESOLVER=' + fallbackResolver, 'MOCK_USD_ADDRESS=' + token,
      'MAX_DEPOSIT_BASE_UNITS=' + maxDeposit, 'MAX_LEASE_END_TIMESTAMP=' + maxLeaseEnd,
      'PROFILE_ACCEPT_UNTIL_TIMESTAMP=' + acceptUntil, ''].join('\n'),
  };
}

export async function writeDemoShort(input, directory) {
  const output = resolve(directory);
  if (!output.split(sep).includes('private')) throw new Error('Output must be inside an ignored private directory.');
  const prepared = prepareDemoShort(input);
  // No recursive creation, reuse or overwrite of a teammate/operator directory.
  await mkdir(output, { mode: 0o700 });
  for (const [name, content] of [
    ['service.draft.json', JSON.stringify(prepared.privateDraft, null, 2) + '\n'],
    ['unsigned-transactions.json', JSON.stringify(prepared.publicDraft, null, 2) + '\n'],
    ['deployment.env', prepared.deploymentEnv],
  ]) await writeFile(resolve(output, name), content, { flag: 'wx', mode: 0o600 });
  return { status: 'draft-not-deployed', profileId: prepared.publicDraft.profile.profileId,
    reviewed: false, filesWritten: 3 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node infra/staging/demo-short.mjs INPUT.json private/NEW_DIRECTORY');
    const input = JSON.parse(await readFile(resolve(process.argv[2]), 'utf8'));
    console.log(JSON.stringify(await writeDemoShort(input, process.argv[3])));
  } catch (error) {
    // No operator input, document, salt, credential or transaction bytes in logs.
    console.error(error instanceof SyntaxError ? 'Invalid input JSON.' : error.code ? 'Could not create a new private output directory/files.' : error.message);
    process.exitCode = 1;
  }
}
