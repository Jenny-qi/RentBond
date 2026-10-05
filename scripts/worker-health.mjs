#!/usr/bin/env node
// Configuration validation only: does not probe RPC/database or read a signer key.
import { loadWorkerConfig } from '../apps/worker/src/config.ts';
try {
  const config = loadWorkerConfig();
  console.log(`[worker] configuration valid; chain=${config.chainId}; execution=${config.execute}; RPC/database connectivity not checked`);
} catch {
  // Never echo env values or provider URLs: they may contain credentials.
  console.error('[worker] invalid configuration; check apps/worker/README.md');
  process.exitCode = 1;
}
