// Read every inclusive range before returning. A failed subrequest must never
// look like an empty range and allow the database checkpoint to skip events.
export async function readLogRanges(client, request, rangeSize, concurrency = 4) {
  if (!Number.isSafeInteger(rangeSize) || rangeSize < 1 ||
      !Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error('INVALID_LOG_RANGE_CONFIG');
  }
  const from = BigInt(request.fromBlock), to = BigInt(request.toBlock);
  if (from < 0n || to < from) throw new Error('INVALID_LOG_RANGE');
  const ranges = [];
  for (let start = from; start <= to; start += BigInt(rangeSize)) {
    const end = start + BigInt(rangeSize) - 1n;
    ranges.push({ ...request, fromBlock: start, toBlock: end < to ? end : to });
  }
  const results = new Array(ranges.length);
  let next = 0, failure;
  const readers = Array.from({ length: Math.min(concurrency, ranges.length) }, async () => {
    while (!failure && next < ranges.length) {
      const index = next++;
      try { results[index] = await client.getLogs(ranges[index]); }
      catch (error) { failure = error instanceof Error ? error : new Error('LOG_RANGE_FAILED'); }
    }
  });
  // Drain in-flight reads even on failure; do not start a new cycle alongside them.
  await Promise.all(readers);
  if (failure) throw failure;
  return results.flat();
}
