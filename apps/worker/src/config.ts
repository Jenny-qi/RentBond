import { readConfig } from '../../web/src/server/config.ts';

export function loadWorkerConfig(env = process.env) {
  const normalized = { ...env,
    NEXT_PUBLIC_FACTORY_ADDRESS: env.NEXT_PUBLIC_FACTORY_ADDRESS || env.FACTORY_ADDRESS,
    NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS: env.NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS || env.RESOLVER_REGISTRY_ADDRESS,
  };
  if (env.FACTORY_ADDRESS && env.NEXT_PUBLIC_FACTORY_ADDRESS && env.FACTORY_ADDRESS.toLowerCase() !== env.NEXT_PUBLIC_FACTORY_ADDRESS.toLowerCase()) throw new Error('FACTORY_CONFIG_MISMATCH');
  const config = readConfig(normalized);
  if (![31337, 10143].includes(config.chainId)) throw new Error('WORKER_TEST_CHAIN_REQUIRED');
  if (!config.rpcUrl || !config.factoryAddress || !/^0x[0-9a-fA-F]{40}$/.test(config.factoryAddress) || /^0x0{40}$/.test(config.factoryAddress)) throw new Error('RPC_URL and a nonzero factory address are required');
  const integer = (name: string, fallback: number, max: number, min = 1) => {
    const n = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error('Invalid ' + name);
    return n;
  };
  if (!/^\d+$/.test(env.DEPLOYMENT_BLOCK ?? '')) throw new Error('DEPLOYMENT_BLOCK is required');
  if (!['true', 'false', undefined].includes(env.WORKER_EXECUTE)) throw new Error('WORKER_EXECUTE must be true or false');
  const execute = env.WORKER_EXECUTE === 'true';
  if (execute && (!env.WORKER_PRIVATE_KEY_FILE || !/^0x[0-9a-fA-F]{40}$/.test(env.WORKER_GAS_ACCOUNT ?? ''))) throw new Error('Execution requires WORKER_PRIVATE_KEY_FILE and WORKER_GAS_ACCOUNT');
  const maxFeeWei = BigInt(env.WORKER_MAX_FEE_WEI ?? '50000000000000000');
  if (maxFeeWei <= 0n || maxFeeWei > 1000000000000000000n) throw new Error('Invalid WORKER_MAX_FEE_WEI');
  return { ...config, factoryAddress: config.factoryAddress.toLowerCase(), execute,
    deploymentBlock: BigInt(env.DEPLOYMENT_BLOCK!), batchSize: integer('WORKER_BATCH_SIZE', 1000, 1000),
    pollIntervalMs: integer('WORKER_POLL_INTERVAL_MS', 5000, 300000, 1000),
    keyFile: env.WORKER_PRIVATE_KEY_FILE, workerGasAccount: env.WORKER_GAS_ACCOUNT?.toLowerCase(), maxFeeWei };
}
