import { resolve } from "node:path";

export interface Config {
  mode: "local" | "testnet";
  origin: string;
  chainId: number;
  dataDir: string;
  databaseUrl?: string;
  storageUrl?: string;
  storageKey?: string;
  storageBucket: string;
  sessionSecret: string;
  rpcUrl?: string;
  rpcFallbackUrl?: string;
  factoryAddress?: string;
  registryAddress?: string;
  confirmations: number;
  sponsorKey?: string;
  gasAmount: bigint;
  gasAccountDaily: number;
  gasLeaseDaily: number;
  gasGlobalDaily: number;
  gasCooldownMs: number;
  trustProxy: boolean;
  gasOrganizers: string[];
}

export function readConfig(env = process.env): Config {
  const mode = env.NEXT_PUBLIC_APP_ENV ?? "local";
  if (mode !== "local" && mode !== "testnet")
    throw new Error("Only local and testnet are supported.");
  const origin = new URL(env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    origin.hostname,
  );
  if (
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  )
    throw new Error("APP_URL must be an origin.");
  if (
    origin.protocol !== "https:" &&
    !(mode === "local" && loopback && origin.protocol === "http:")
  )
    throw new Error("HTTPS is required outside local loopback.");
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "SESSION_SECRET must contain at least 32 characters. Run backend:init for local setup.",
    );
  const chainId = Number(
    env.CHAIN_ID ||
      env.NEXT_PUBLIC_CHAIN_ID ||
      (mode === "local" ? "31337" : ""),
  );
  if (
    !Number.isSafeInteger(chainId) ||
    chainId <= 0 ||
    (mode === "testnet" && chainId !== 10143)
  )
    throw new Error("Set a supported chain ID (Monad testnet 10143).");
  if (env.NEXT_PUBLIC_CHAIN_ID && Number(env.NEXT_PUBLIC_CHAIN_ID) !== chainId)
    throw new Error("Client/server chain IDs disagree.");
  const positive = (name: string, fallback: number) => {
    const n = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(n) || n < 1)
      throw new Error("Invalid positive configuration: " + name);
    return n;
  };
  const storageUrl = env.STORAGE_URL || undefined;
  const storageKey = env.STORAGE_SERVICE_KEY || undefined;
  if (!!storageUrl !== !!storageKey)
    throw new Error("Storage URL and service key must be configured together.");
  if (mode === "testnet" && !env.DATABASE_URL)
    throw new Error("Testnet requires a shared PostgreSQL database.");
  const gasAmount = BigInt(env.TEST_GAS_AMOUNT_WEI ?? "10000000000000000");
  if (gasAmount <= 0n || gasAmount > 100000000000000000n)
    throw new Error(
      "Test gas amount exceeds the 0.1 MON per-transfer ceiling.",
    );
  const gasOrganizers = (env.TEST_GAS_ORGANIZERS ?? "")
    .split(",")
    .filter(Boolean)
    .map((v) => v.trim().toLowerCase());
  if (
    gasOrganizers.some(
      (v) => !/^0x[0-9a-f]{40}$/.test(v) || /^0x0{40}$/.test(v),
    )
  )
    throw new Error("Invalid test-gas organizer address.");
  return {
    mode,
    origin: origin.origin,
    chainId,
    sessionSecret: secret,
    dataDir: resolve(env.RENTBOND_DATA_DIR ?? ".rentbond"),
    databaseUrl: env.DATABASE_URL || undefined,
    storageUrl,
    storageKey,
    storageBucket: env.STORAGE_BUCKET || "rentbond-private",
    rpcUrl: env.RPC_URL || undefined,
    rpcFallbackUrl: env.RPC_FALLBACK_URL || undefined,
    factoryAddress: env.NEXT_PUBLIC_FACTORY_ADDRESS || undefined,
    registryAddress:
      env.NEXT_PUBLIC_RESOLVER_REGISTRY_ADDRESS ||
      env.REGISTRY_ADDRESS ||
      undefined,
    confirmations: positive("CHAIN_CONFIRMATIONS", 1),
    sponsorKey: env.TEST_GAS_SPONSOR_PRIVATE_KEY || undefined,
    gasAmount,
    gasAccountDaily: positive("TEST_GAS_ACCOUNT_DAILY", 3),
    gasLeaseDaily: positive("TEST_GAS_LEASE_DAILY", 8),
    gasGlobalDaily: positive("TEST_GAS_GLOBAL_DAILY", 100),
    gasCooldownMs: positive("TEST_GAS_COOLDOWN_SECONDS", 3600) * 1000,
    trustProxy: env.TRUST_PROXY === "true",
    gasOrganizers,
  };
}
