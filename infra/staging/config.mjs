// Offline staging checks. Passing is configuration evidence, never chain acceptance.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readConfig } from '../../apps/web/src/server/config.ts';
import { loadWorkerConfig } from '../../apps/worker/src/config.ts';

export const publicKeys = [
  'NEXT_PUBLIC_APP_ENV', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_CHAIN_ID',
  'NEXT_PUBLIC_RPC_URL', 'NEXT_PUBLIC_FACTORY_ADDRESS',
  'NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS', 'CHAIN_CONFIRMATIONS',
];
const address = /^0x[0-9a-fA-F]{40}$/;
export function publicConfig(env) {
  const config = Object.fromEntries(publicKeys.map(key => [key, env[key] ?? '']));
  if (config.NEXT_PUBLIC_APP_ENV !== 'testnet' || config.NEXT_PUBLIC_CHAIN_ID !== '10143')
    throw new Error('Staging requires explicit Monad testnet configuration.');
  for (const key of ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_RPC_URL']) {
    let url;
    try { url = new URL(config[key]); } catch { throw new Error(`Invalid ${key}.`); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      throw new Error(`${key} requires credential-free HTTPS without query or fragment.`);
    if (key === 'NEXT_PUBLIC_APP_URL' && url.pathname !== '/')
      throw new Error('NEXT_PUBLIC_APP_URL must be an origin.');
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.invalid'))
      throw new Error(`${key} requires an actual staging host.`);
  }
  for (const key of ['NEXT_PUBLIC_FACTORY_ADDRESS', 'NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS'])
    if (!address.test(config[key]) || /^0x0{40}$/i.test(config[key]))
      throw new Error(`Set a nonzero ${key} from verified deployment evidence.`);
  if (!/^\d+$/.test(config.CHAIN_CONFIRMATIONS) || Number(config.CHAIN_CONFIRMATIONS) < 1 ||
      !Number.isSafeInteger(Number(config.CHAIN_CONFIRMATIONS)))
    throw new Error('Set explicit CHAIN_CONFIRMATIONS; this check does not establish finality.');
  return config;
}
export function validateRuntime(env, built) {
  const current = publicConfig(env);
  if (!built || publicKeys.some(key => built[key] !== current[key]))
    throw new Error('Public configuration changed since build; rebuild the staging image.');
  try { readConfig(env); loadWorkerConfig(env); }
  catch { throw new Error('Invalid server/Worker configuration; see staging README.'); }
  if (env.CHAIN_ID !== '10143' || !env.RPC_URL || !env.DATABASE_URL)
    throw new Error('Set server CHAIN_ID, RPC_URL and PostgreSQL DATABASE_URL.');
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { throw new Error('Invalid DATABASE_URL.'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol))
    throw new Error('DATABASE_URL must use PostgreSQL.');
  if (env.FILE_SCAN_MODE !== 'clamav' || env.STORAGE_URL || env.STORAGE_SERVICE_KEY)
    throw new Error('This bundle requires real ClamAV and shared local private storage.');
  if (env.RENTBOND_DATA_DIR !== '/data' || env.CLAMAV_HOST !== 'scanner')
    throw new Error('Use the shared /data volume and private scanner service.');
  if (env.TRUST_PROXY !== 'false')
    throw new Error('Keep TRUST_PROXY=false until the chosen proxy is separately verified.');
  if (env.RENTBOND_SITE_HOST !== new URL(current.NEXT_PUBLIC_APP_URL).host)
    throw new Error('TLS host must match the configured application origin.');
  return current;
}

async function main() {
  const [mode, file] = process.argv.slice(2);
  if (!file || !['record-build', 'check'].includes(mode))
    throw new Error('Usage: node infra/staging/config.mjs record-build|check FILE');
  if (mode === 'record-build') {
    await writeFile(file, JSON.stringify(publicConfig(process.env), null, 2) + '\n');
    console.log('Recorded public build configuration. No server secrets included.');
  } else {
    validateRuntime(process.env, JSON.parse(await readFile(file, 'utf8')));
    console.log('Staging configuration matches build. RPC/database/chain acceptance not checked.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error('Staging configuration failed. Check required fields and build consistency; values are not logged.');
    process.exitCode = 1;
  });
