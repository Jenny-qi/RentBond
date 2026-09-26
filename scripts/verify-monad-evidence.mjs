#!/usr/bin/env node

// Read-only check of manually recorded testnet addresses and transaction IDs.
// It deliberately does not infer source-code identity or the escrow's business state.
import { readFile } from "node:fs/promises";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const CONTRACT_NAMES = [
  "MockUSD", "ResolverRegistry", "DepositEscrowDeployer", "LeaseFactory", "DepositEscrow",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameAddress(a, b) {
  return typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
}

function validate(record) {
  assert(record?.chainId === 10143, "record chainId must be 10143");
  assert(record.contracts && typeof record.contracts === "object", "contracts are required");
  for (const name of CONTRACT_NAMES) {
    assert(ADDRESS.test(record.contracts[name]), `invalid ${name} address`);
  }
  assert(Array.isArray(record.transactions) && record.transactions.length > 0, "transactions are required");
  for (const [index, tx] of record.transactions.entries()) {
    assert(HASH.test(tx?.hash), `invalid transaction hash at index ${index}`);
    for (const field of ["expectedFrom", "expectedTo"]) {
      if (tx[field] !== undefined) assert(ADDRESS.test(tx[field]), `invalid ${field} at index ${index}`);
    }
  }
}

async function main() {
  assert(process.argv.length === 3, "usage: node scripts/verify-monad-evidence.mjs <record.json>");
  const record = JSON.parse(await readFile(process.argv[2], "utf8"));
  validate(record);
  const url = process.env.RENTBOND_READONLY_RPC_URL;
  assert(url, "RENTBOND_READONLY_RPC_URL is required");
  const parsed = new URL(url);
  assert(["http:", "https:"].includes(parsed.protocol), "RPC must use HTTP(S)");
  let id = 0;
  async function rpc(method, params) {
    const response = await fetch(parsed, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    assert(response.ok, `${method} returned HTTP ${response.status}`);
    const data = await response.json();
    assert(!data.error && data.result !== undefined, `${method} failed or returned no result`);
    return data.result;
  }

  assert(BigInt(await rpc("eth_chainId", [])) === 10143n, "RPC chainId is not Monad Testnet (10143)");
  for (const name of CONTRACT_NAMES) {
    const code = await rpc("eth_getCode", [record.contracts[name], "latest"]);
    assert(typeof code === "string" && /^0x(?:[0-9a-fA-F]{2})+$/.test(code) && code !== "0x00",
      `${name} has no contract bytecode at the recorded address`);
    console.log(`${name}: contract bytecode present`);
  }
  for (const tx of record.transactions) {
    const [transaction, receipt] = await Promise.all([
      rpc("eth_getTransactionByHash", [tx.hash]),
      rpc("eth_getTransactionReceipt", [tx.hash]),
    ]);
    assert(transaction && receipt, `missing transaction or receipt for ${tx.hash}`);
    assert(sameAddress(transaction.hash, tx.hash) && sameAddress(receipt.transactionHash, tx.hash),
      `transaction hash mismatch for ${tx.hash}`);
    assert(receipt.status === "0x1", `transaction did not succeed: ${tx.hash}`);
    assert(receipt.blockHash && receipt.blockHash === transaction.blockHash,
      `transaction and receipt disagree on block: ${tx.hash}`);
    if (tx.expectedFrom) assert(sameAddress(transaction.from, tx.expectedFrom), `sender mismatch: ${tx.hash}`);
    if (tx.expectedTo) assert(sameAddress(transaction.to, tx.expectedTo), `recipient mismatch: ${tx.hash}`);
    console.log(`${tx.hash}: successful receipt, block ${receipt.blockNumber}`);
  }
  console.log("Read-only RPC checks passed. Source identity, event semantics and escrow phase remain unverified.");
}

main().catch((error) => {
  console.error(`Evidence check failed: ${error.message}`);
  process.exitCode = 1;
});
