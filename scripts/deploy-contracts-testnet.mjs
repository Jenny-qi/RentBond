#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const EXPECTED_NETWORK = "monad-testnet";
const EXPECTED_CHAIN_ID = 10143n;
const ZERO_ADDRESS = /^0x0{40}$/i;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const SOURCE_PATHS = [
  ":(glob)contracts/src/**/*.sol",
  ":(glob)contracts/script/**/*.sol",
  "contracts/foundry.toml",
  "contracts/remappings.txt",
];

function fail(message) {
  console.error(`Deployment preflight failed: ${message}`);
  process.exit(1);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required`);
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: process.env,
  });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    fail(`${command} exited with status ${result.status}`);
  }
  return options.capture ? result.stdout.trim() : "";
}

async function readChainId(rpcUrl) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: attempt, method: "eth_chainId", params: [] }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error("response was not JSON");
      }
      if (payload.error || typeof payload.result !== "string") {
        throw new Error("invalid eth_chainId response");
      }
      try {
        return BigInt(payload.result);
      } catch {
        throw new Error(`invalid chain ID ${payload.result}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt === 1) console.warn(`RPC check attempt 1 failed; retrying once: ${error.message}`);
    }
  }
  fail(`RPC eth_chainId request failed after two attempts: ${lastError.message}`);
}

const args = new Set(process.argv.slice(2));
for (const arg of args) {
  if (arg !== "--check") fail(`unknown argument: ${arg}`);
}
const checkOnly = args.has("--check");

if (required("RENTBOND_DEPLOYMENT_NETWORK") !== EXPECTED_NETWORK) {
  fail(`RENTBOND_DEPLOYMENT_NETWORK must equal ${EXPECTED_NETWORK}`);
}
let configuredChainId;
try {
  configuredChainId = BigInt(required("CHAIN_ID"));
} catch {
  fail("CHAIN_ID must be an integer");
}
if (configuredChainId !== EXPECTED_CHAIN_ID) {
  fail(`CHAIN_ID must equal ${EXPECTED_CHAIN_ID}`);
}
const rpcUrl = required("RPC_URL");
let parsedRpc;
try {
  parsedRpc = new URL(rpcUrl);
} catch {
  fail("RPC_URL must be a valid URL");
}
if (!new Set(["http:", "https:"]).has(parsedRpc.protocol)) {
  fail("RPC_URL must use http or https");
}
const mintOperator = required("MOCK_USD_MINT_OPERATOR");
if (!ADDRESS.test(mintOperator) || ZERO_ADDRESS.test(mintOperator)) {
  fail("MOCK_USD_MINT_OPERATOR must be a nonzero EVM address");
}
if (process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY) {
  fail("raw private-key environment variables are not accepted; use a Forge keystore account");
}

const dirty = run("git", ["status", "--porcelain", "--", ...SOURCE_PATHS], { capture: true });
if (dirty) fail("contract source, deployment Solidity, or Foundry config has uncommitted changes");

const rpcChainId = await readChainId(rpcUrl);
if (rpcChainId !== EXPECTED_CHAIN_ID) {
  fail(`RPC reports chainId ${rpcChainId}; expected ${EXPECTED_CHAIN_ID}`);
}

console.log(`Preflight passed: ${EXPECTED_NETWORK}, chainId ${rpcChainId}, mint operator ${mintOperator}`);
if (checkOnly) {
  console.log("Read-only check complete; no transaction was signed or broadcast.");
  process.exit(0);
}

const deployerAccount = required("DEPLOYER_ACCOUNT");
if (/^(0x)?[0-9a-f]{64}$/i.test(deployerAccount)) {
  fail("DEPLOYER_ACCOUNT must be a Forge keystore name, not a raw private key");
}
if (required("RENTBOND_BROADCAST_CONFIRMATION") !== "MONAD_TESTNET_ONLY") {
  fail("set RENTBOND_BROADCAST_CONFIRMATION=MONAD_TESTNET_ONLY to authorize broadcast");
}

run("npx", [
  "--yes",
  "@foundry-rs/forge@1.7.1",
  "script",
  "--root",
  "contracts",
  "script/DeployCore.s.sol:DeployCore",
  "--rpc-url",
  rpcUrl,
  "--account",
  deployerAccount,
  "--broadcast",
]);
