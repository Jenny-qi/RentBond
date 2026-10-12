// Validate the operator's env file before Compose consumes it. Offline only.
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { publicConfig, validateRuntime } from './config.mjs';

export function checkOperatorEnv(input) {
  // These are fixed by compose.yaml, not editable network selections.
  const env = { ...input, NEXT_PUBLIC_APP_ENV: 'testnet', NEXT_PUBLIC_CHAIN_ID: '10143',
    CHAIN_ID: '10143', FILE_SCAN_MODE: 'clamav', CLAMAV_HOST: 'scanner', CLAMAV_PORT: '3310',
    RENTBOND_DATA_DIR: '/data', TRUST_PROXY: 'false', WORKER_EXECUTE: 'false' };
  for (const name of ['RENTBOND_DB_PASSWORD', 'RENTBOND_APP_DB_PASSWORD', 'SESSION_SECRET']) {
    if (!/^[a-f0-9]{64}$/i.test(input[name] ?? ''))
      throw new Error(`Set ${name} to an independently generated 32-byte hex value.`);
  }
  if (new Set(['RENTBOND_DB_PASSWORD', 'RENTBOND_APP_DB_PASSWORD', 'SESSION_SECRET'].map(key => input[key].toLowerCase())).size !== 3)
    throw new Error('Database passwords and session secret must be independently generated.');
  // Compose interpolates the app password directly into the URL; hex avoids
  // reserved delimiters changing the password, hostname or database path.
  env.DATABASE_URL = `postgresql://rentbond:${input.RENTBOND_APP_DB_PASSWORD}@database:5432/rentbond`;
  validateRuntime(env, publicConfig(env));
  const app = new URL(env.NEXT_PUBLIC_APP_URL);
  if (app.port || !/^[a-z0-9.-]+$/i.test(input.RENTBOND_SITE_HOST))
    throw new Error('This HTTPS bundle requires a DNS hostname and standard port 443.');
  return { configuration: 'passed', chainId: 10143,
    boundary: 'Offline configuration only; host, DNS, images, RPC, contracts and wallet flows are not verified.' };
}

export async function checkEnvFile(file) {
  return checkOperatorEnv(parseEnv(await readFile(file, 'utf8')));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkEnvFile(process.argv[2] ?? 'infra/staging/.env.staging')
    .then(result => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error('Staging preflight failed. Check env file, independent hex secrets, HTTPS origin, verified addresses and deployment block. Values are not logged.');
      process.exitCode = 1;
    });
}
