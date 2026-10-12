// Read-only HTTP smoke: never signs, creates records or sends chain transactions.
import { pathToFileURL } from 'node:url';
export async function checkSite(origin, request = fetch) {
  const url = new URL(origin);
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))))
    throw new Error('Pass an HTTPS origin, or loopback HTTP for local smoke only.');
  const home = await request(new URL('/', url), { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!home.ok || !(home.headers.get('content-type') ?? '').includes('text/html'))
    throw new Error('Homepage did not return HTML successfully.');
  const health = await request(new URL('/api/health', url), { signal: AbortSignal.timeout(15000), redirect: 'error' });
  const data = await health.json();
  if (!health.ok || !data || ['database', 'storage', 'quarantine', 'scanner', 'rpc'].some(key => data[key] !== true))
    throw new Error('API dependencies are not all healthy; this is not a usable staging backend.');
  return { homepage: 'passed', dependencies: 'passed', boundary: 'HTTP health only; Worker liveness, wallet, role ACL, chain receipts and device recovery remain separate acceptance.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkSite(process.argv[2]).then(result => console.log(JSON.stringify(result)))
    .catch(() => { console.error('Staging HTTP smoke failed. Check origin and service health; no credentials are logged.'); process.exitCode = 1; });
}
