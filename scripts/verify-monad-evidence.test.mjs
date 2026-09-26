import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const recordPath = new URL("../deployments/monad-testnet-2026-09-24.observed.json", import.meta.url);
const scriptPath = new URL("./verify-monad-evidence.mjs", import.meta.url);
const record = JSON.parse(await readFile(recordPath, "utf8"));

async function check(overrides = {}) {
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const { id, method, params } = JSON.parse(Buffer.concat(chunks).toString());
    const tx = record.transactions.find((item) => item.hash === params?.[0]);
    let result;
    if (method === "eth_chainId") result = overrides.chainId ?? "0x279f";
    if (method === "eth_getCode") result = overrides.code ?? "0x6000";
    if (method === "eth_getTransactionByHash") {
      result = tx && {
        hash: tx.hash, from: tx.expectedFrom, to: overrides.to ?? tx.expectedTo, blockHash: "0xabc",
      };
    }
    if (method === "eth_getTransactionReceipt") {
      result = tx && {
        transactionHash: tx.hash, status: overrides.status ?? "0x1", blockHash: "0xabc", blockNumber: "0x123",
      };
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id, result: result ?? null }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const child = spawn(process.execPath, [fileURLToPath(scriptPath), fileURLToPath(recordPath)], {
      windowsHide: true,
      env: { ...process.env, RENTBOND_READONLY_RPC_URL: `http://127.0.0.1:${server.address().port}` },
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (data) => { output += data; });
    const exitCode = await new Promise((resolve) => child.on("close", resolve));
    return { exitCode, output };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("valid receipt, chain and deployed code pass the read-only checks", async () => {
  const { exitCode, output } = await check();
  assert.equal(exitCode, 0, output);
  assert.match(output, /Source identity, event semantics and escrow phase remain unverified/);
});

test("wrong chain fails closed", async () => {
  const { exitCode, output } = await check({ chainId: "0x1" });
  assert.equal(exitCode, 1);
  assert.match(output, /not Monad Testnet/);
});

test("no code fails closed", async () => {
  const { exitCode, output } = await check({ code: "0x" });
  assert.equal(exitCode, 1);
  assert.match(output, /has no contract bytecode/);
});

test("failed receipt fails closed", async () => {
  const { exitCode, output } = await check({ status: "0x0" });
  assert.equal(exitCode, 1);
  assert.match(output, /did not succeed/);
});

test("unexpected destination fails closed", async () => {
  const { exitCode, output } = await check({ to: "0x0000000000000000000000000000000000000001" });
  assert.equal(exitCode, 1);
  assert.match(output, /recipient mismatch/);
});
