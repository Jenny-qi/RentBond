// Offline check for the existing Vercel web + external service deployment.
// Does not provision, connect, migrate, sign, broadcast or print env values.
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { readConfig } from '../../apps/web/src/server/config.ts';
import { loadWorkerConfig } from '../../apps/worker/src/config.ts';
import { publicConfig } from './config.mjs';

const loopback = host => ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'].includes(host.toLowerCase());
const remoteHttps = value => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || loopback(url.hostname))
    throw new Error('External HTTPS endpoint required.');
};
export function checkHostedEnv(env) {
  const checks = [];
  const check = (id, action) => {
    try { action(); checks.push({ id, status: 'passed' }); }
    catch { checks.push({ id, status: 'failed' }); }
  };
  check('public-build-configuration', () => publicConfig(env));
  check('server-configuration', () => {
    readConfig(env);
    if (env.NEXT_PUBLIC_APP_ENV !== 'testnet' || env.CHAIN_ID !== '10143') throw new Error();
    if (!env.RPC_URL || env.FILE_SCAN_MODE !== 'clamav') throw new Error();
  });
  check('external-postgresql', () => {
    const url = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || loopback(url.hostname)) throw new Error();
  });
  check('durable-private-object-storage', () => {
    if (!env.STORAGE_URL || !env.STORAGE_SERVICE_KEY) throw new Error();
    remoteHttps(env.STORAGE_URL);
    if ((env.STORAGE_BUCKET || 'rentbond-private') === (env.STORAGE_QUARANTINE_BUCKET || 'rentbond-quarantine')) throw new Error();
  });
  check('restricted-external-scanner', () => {
    // A Docker-only service name or a function's own loopback cannot reach
    // the external scanner. Network reachability must still be verified.
    if (!env.CLAMAV_HOST || loopback(env.CLAMAV_HOST) || env.CLAMAV_HOST === 'scanner') throw new Error();
    if (env.FILE_SCAN_MODE !== 'clamav') throw new Error();
  });
  check('independent-worker-configuration', () => {
    // This file checks the shared configuration for an independently hosted
    // Worker; the function itself must not start one. Candidate is read-only.
    if (env.WORKER_EXECUTE !== 'false') throw new Error();
    loadWorkerConfig(env);
  });
  return {
    mode: 'vercel-web-with-external-services',
    configuration: checks.every(check => check.status === 'passed') ? 'passed' : 'failed',
    checks,
    liveProductReady: false,
    boundary: 'Offline environment shape only. Build values, DB migrations, storage policies, scanner connectivity, Worker liveness and Monad funds flows require separate verification.',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error();
    const result = checkHostedEnv(parseEnv(await readFile(process.argv[2], 'utf8')));
    console.log(JSON.stringify(result));
    if (result.configuration !== 'passed') process.exitCode = 1;
  } catch {
    console.error('Hosted preflight failed. Pass an operator-owned env file; private values are never printed.');
    process.exitCode = 1;
  }
}
