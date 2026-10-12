// Public writes are opt-in and limited to one explicitly named HTTPS origin.
export function smokeTarget(env, args = []) {
  const origin = env.RENTBOND_TEST_BASE_URL;
  if (!origin) throw new Error('Set RENTBOND_TEST_BASE_URL.');
  const url = new URL(origin);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('Use a bare origin without credentials, path, query or fragment.');
  const publicTest = args.includes('--public-testnet');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (publicTest) {
    if (local || url.protocol !== 'https:' || origin !== url.origin ||
        env.RENTBOND_TEST_PUBLIC_ORIGIN !== origin)
      throw new Error('Public smoke requires HTTPS and the exact RENTBOND_TEST_PUBLIC_ORIGIN acknowledgement.');
  } else if (!local || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Public smoke is disabled by default.');
  }
  return { origin, publicTest };
}
