#!/usr/bin/env node

// Read-only, reproducible evidence for the manually deployed Monad Testnet lease.
// Run after the three pinned compiler profiles in deployments/README.md.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const observedPath = resolve(process.argv[2] ?? join(root, "deployments/monad-testnet-2026-09-24.observed.json"));
const outputPath = process.argv[3] ? resolve(process.argv[3]) : null;
const names = ["MockUSD", "ResolverRegistry", "DepositEscrowDeployer", "LeaseFactory", "DepositEscrow"];
const buildProfiles = {
  MockUSD: ["out-noir", "optimizer runs 1, viaIR false"],
  ResolverRegistry: ["out-noir200", "optimizer runs 200, viaIR false"],
  DepositEscrowDeployer: ["out", "optimizer runs 1, viaIR true"],
  LeaseFactory: ["out", "optimizer runs 1, viaIR true"],
  DepositEscrow: ["out", "optimizer runs 1, viaIR true"],
};
const topic = {
  EscrowDeployed: "0xa1245e1edc7ca4a2c5379f2483084e765c47dfd642751551d236a7776e33eb6e",
  LeaseCreated: "0x8395f016eced85d8f0ecacd36940460db95be11443d34ba380a5c57735bbb38a",
  Funded: "0xcb0f0b7a0a8a4096549164bb3829fbca6e2f2aa883396beac3c9343ed53b6137",
  Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
};
const selectors = {
  terms: "0x4173b417", accounting: "0x36cfd8ba", phase: "0xb1c9fe6e",
  tenantAccepted: "0xd5b478f9", claimCount: "0xba4611d9", profile: "0xb50991b4",
  balanceOf: "0x70a08231", decimals: "0x313ce567", mintOperator: "0x767fb441", factory: "0xc45a0155",
  registry: "0x7b103999", deployer: "0xebd5d58c", owner: "0x8da5cb5b",
};
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const same = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
const insist = (test, reason) => { if (!test) throw new Error(reason); };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const asBytes = (hex) => { insist(/^0x(?:[0-9a-fA-F]{2})*$/.test(hex), "invalid byte string"); return Buffer.from(hex.slice(2), "hex"); };
const uint = (hex) => BigInt(hex).toString();
const word = (data, n) => {
  insist(/^0x[0-9a-fA-F]*$/.test(data) && data.length >= 2 + (n + 1) * 64, `missing ABI word ${n}`);
  return `0x${data.slice(2 + n * 64, 2 + (n + 1) * 64)}`;
};
const addr = (w) => `0x${w.slice(-40)}`.toLowerCase();
const arg = (address) => address.toLowerCase().slice(2).padStart(64, "0");
const event = (receipt, address, signature) => {
  const found = receipt.logs.filter((log) => same(log.address, address) && same(log.topics?.[0], signature));
  insist(found.length === 1, `expected one matching event at ${address}: ${signature}`);
  return found[0];
};

function withoutMetadata(bytes) {
  insist(bytes.length > 2, "empty runtime code");
  const size = bytes.readUInt16BE(bytes.length - 2) + 2;
  insist(size >= 2 && size <= 128 && bytes.length > size, "invalid Solidity metadata trailer");
  return Buffer.from(bytes.subarray(0, bytes.length - size));
}

// Solidity embeds the child's CBOR/IPFS digest in the deployer's own code.
// Mask only the 32 digest bytes between the exact Solidity IPFS prefix/suffix.
function maskEmbeddedIpfs(bytes) {
  const prefix = Buffer.from("a2646970667358221220", "hex");
  const suffix = Buffer.from("64736f6c63430008180033", "hex");
  let count = 0;
  for (let i = 0; i <= bytes.length - prefix.length - 32 - suffix.length; i++) {
    if (!bytes.subarray(i, i + prefix.length).equals(prefix)) continue;
    const from = i + prefix.length;
    if (!bytes.subarray(from + 32, from + 32 + suffix.length).equals(suffix)) continue;
    bytes.fill(0, from, from + 32);
    count++;
    i = from + 32 + suffix.length - 1;
  }
  return count;
}

export function compareRuntime(chainCode, compiled) {
  const onChain = withoutMetadata(asBytes(chainCode));
  const artifact = withoutMetadata(asBytes(compiled.object));
  insist(onChain.length === artifact.length, `runtime executable length differs: ${onChain.length} vs ${artifact.length}`);
  for (const references of Object.values(compiled.immutableReferences ?? {})) {
    for (const { start, length } of references) {
      insist(start + length <= onChain.length, "immutable reference outside code");
      onChain.fill(0, start, start + length);
      artifact.fill(0, start, start + length);
    }
  }
  const chainIpfs = maskEmbeddedIpfs(onChain);
  const compiledIpfs = maskEmbeddedIpfs(artifact);
  insist(chainIpfs === compiledIpfs, "embedded metadata layout differs");
  insist(onChain.equals(artifact), "executable runtime differs after immutable and CBOR/IPFS masking");
  return { executableBytes: onChain.length, maskedEmbeddedIpfsDigests: chainIpfs };
}

async function attest() {
  const url = process.env.RENTBOND_READONLY_RPC_URL;
  insist(url && /^https?:\/\//.test(url), "set RENTBOND_READONLY_RPC_URL to an HTTP(S) RPC");
  const observed = JSON.parse(await readFile(observedPath, "utf8"));
  const creation = JSON.parse(await readFile(join(root, "deployments/monad-testnet-2026-09-26.deployment-txs.json"), "utf8"));
  insist(observed.chainId === 10143 && observed.transactions?.length === 2, "invalid observed record");
  insist(creation.chainId === observed.chainId, "deployment record chain mismatch");
  for (const name of names) insist(addressPattern.test(observed.contracts?.[name]), `bad ${name} address`);
  for (const tx of observed.transactions) insist(hashPattern.test(tx.hash), `bad ${tx.label} hash`);
  const manifest = JSON.parse(await readFile(join(root, "deployments/abi/manifest.json"), "utf8"));
  insist(manifest.compiler === "solc 0.8.24", "unexpected compiler");
  const dirtySource = execFileSync("git", ["status", "--porcelain", "--", "contracts/src", "contracts/lib", "contracts/foundry.toml", "deployments/abi"], { cwd: root, encoding: "utf8" }).trim();
  insist(!dirtySource, `source or ABI files are uncommitted: ${dirtySource}`);
  const sourceDiff = execFileSync("git", ["diff", "--name-only", manifest.sourceCommit, "HEAD", "--", "contracts/src", "contracts/lib", "contracts/foundry.toml"], { cwd: root, encoding: "utf8" }).trim();
  insist(!sourceDiff, `ABI source commit differs from this checkout: ${sourceDiff}`);
  const checks = [];
  for (const entry of manifest.contracts) {
    const data = await readFile(join(root, "deployments/abi", entry.file));
    insist(sha256(data) === entry.sha256, `ABI digest mismatch: ${entry.contract}`);
    checks.push(`${entry.contract}:${entry.sha256}`);
  }
  insist(sha256(`${checks.join("\n")}\n`) === manifest.bundleSha256, "ABI bundle digest mismatch");
  let rpcId = 0;
  async function rpc(method, params) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }), signal: AbortSignal.timeout(25_000) });
        insist(response.ok, `${method}: HTTP ${response.status}`);
        const json = await response.json();
        insist(!json.error && json.result !== undefined && json.result !== null, `${method}: ${JSON.stringify(json.error ?? "no result")}`);
        return json.result;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
  }
  insist(BigInt(await rpc("eth_chainId", [])) === 10143n, "wrong RPC chain");
  const block = await rpc("eth_getBlockByNumber", ["latest", false]);
  const blockTag = block.number;
  const call = async (to, data) => rpc("eth_call", [{ to, data }, blockTag]);
  const evidence = { schemaVersion: 1, status: "read-only-on-chain-evidence; independent review and full TS01/TS02 pending",
    readyForFrontend: false, chainId: 10143, observedAtBlock: blockTag, observedAtBlockHash: block.hash, observedAtUnix: uint(block.timestamp),
    sourceCommit: manifest.sourceCommit, abiBundleSha256: manifest.bundleSha256,
    comparison: "executable runtime matches pinned local compiler profiles after masking constructor immutables and Solidity CBOR/IPFS digests; metadata hashes are not asserted identical",
    contracts: {}, transactions: {}, lease: {} };
  await Promise.all(names.map(async (name) => {
    const [folder, compilerProfile] = buildProfiles[name];
    const artifact = JSON.parse(await readFile(join(root, "contracts", folder, `${name}.sol`, `${name}.json`), "utf8"));
    const abi = manifest.contracts.find((entry) => entry.contract === name);
    insist(abi && sha256(`${JSON.stringify(artifact.abi, null, 2)}\n`) === abi.sha256, `${name} build ABI differs from exported ABI`);
    const chainCode = await rpc("eth_getCode", [observed.contracts[name], blockTag]);
    insist(chainCode !== "0x" && chainCode !== "0x00", `${name} has no code`);
    const result = compareRuntime(chainCode, artifact.deployedBytecode);
    evidence.contracts[name] = { address: observed.contracts[name], runtimeSha256: sha256(asBytes(chainCode)),
      runtimeBytes: asBytes(chainCode).length, compilerProfile, ...result };
  }));

  await Promise.all(names.map(async (name) => {
    const deploy = creation.contracts[name];
    insist(Number.isSafeInteger(deploy?.blockNumber) && deploy.blockNumber > 0 && hashPattern.test(deploy.transactionHash), `invalid deployment entry: ${name}`);
    const at = `0x${deploy.blockNumber.toString(16)}`;
    const before = `0x${(deploy.blockNumber - 1).toString(16)}`;
    const [earlierCode, creationCode, receipt, txBlock] = await Promise.all([
      rpc("eth_getCode", [observed.contracts[name], before]), rpc("eth_getCode", [observed.contracts[name], at]),
      rpc("eth_getTransactionReceipt", [deploy.transactionHash]), rpc("eth_getBlockByNumber", [at, false]),
    ]);
    insist(earlierCode === "0x" && creationCode !== "0x" && creationCode !== "0x00", `${name}: creation block does not bracket first code`);
    insist(same(receipt.transactionHash, deploy.transactionHash) && receipt.status === "0x1"
      && BigInt(receipt.blockNumber) === BigInt(at) && same(receipt.blockHash, txBlock.hash), `${name}: deployment receipt differs`);
    if (name !== "DepositEscrow") insist(same(receipt.contractAddress, observed.contracts[name]), `${name}: top-level creation address differs`);
    else insist(!receipt.contractAddress && same(receipt.to, observed.contracts.LeaseFactory), "escrow must be internally created by Factory");
    evidence.contracts[name].deployment = { blockNumber: at, transactionHash: deploy.transactionHash,
      blockHash: receipt.blockHash, status: receipt.status, createdInternally: name === "DepositEscrow" };
  }));

  const [create, fund] = await Promise.all(observed.transactions.map(async (entry) => {
    const [tx, receipt] = await Promise.all([rpc("eth_getTransactionByHash", [entry.hash]), rpc("eth_getTransactionReceipt", [entry.hash])]);
    insist(same(tx.hash, entry.hash) && same(receipt.transactionHash, entry.hash), `${entry.label}: hash mismatch`);
    insist(receipt.status === "0x1" && same(tx.blockHash, receipt.blockHash), `${entry.label}: receipt not confirmed`);
    insist(same(tx.from, entry.expectedFrom) && same(tx.to, entry.expectedTo), `${entry.label}: sender or recipient differs`);
    evidence.transactions[entry.label] = { hash: entry.hash, from: tx.from, to: tx.to,
      blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, status: receipt.status };
    return receipt;
  }));
  const d = event(create, observed.contracts.DepositEscrowDeployer, topic.EscrowDeployed);
  const c = event(create, observed.contracts.LeaseFactory, topic.LeaseCreated);
  insist(d.topics.length === 4 && c.topics.length === 4, "unexpected creation event topics");
  const leaseId = c.topics[1];
  insist(same(d.topics[1], leaseId) && same(addr(d.topics[2]), observed.contracts.LeaseFactory)
    && same(addr(d.topics[3]), observed.contracts.DepositEscrow), "EscrowDeployed does not match LeaseCreated");
  insist(same(addr(c.topics[2]), observed.contracts.DepositEscrow) && same(addr(c.topics[3]), observed.transactions[0].expectedFrom), "LeaseCreated address mismatch");
  const tenant = addr(word(c.data, 0));
  const profileId = word(c.data, 1);
  const termsHash = word(c.data, 2);
  const hardEndAt = uint(word(c.data, 3));
  const f = event(fund, observed.contracts.DepositEscrow, topic.Funded);
  const transfer = event(fund, observed.contracts.MockUSD, topic.Transfer);
  insist(f.topics.length === 4 && transfer.topics.length === 3, "unexpected funding event topics");
  const amount = uint(word(f.data, 0));
  insist(same(f.topics[1], leaseId) && same(addr(f.topics[2]), tenant) && same(f.topics[3], profileId)
    && same(addr(transfer.topics[1]), tenant) && same(addr(transfer.topics[2]), observed.contracts.DepositEscrow)
    && uint(word(transfer.data, 0)) === amount && same(tenant, observed.transactions[1].expectedFrom), "funding events disagree");
  const escrow = observed.contracts.DepositEscrow, factory = observed.contracts.LeaseFactory;
  const [terms, accounting, phase, accepted, claimCount, tokenBalance, decimals, mintOperator, factoryRef, registryRef, deployerRef, ownerRef, profile] = await Promise.all([
    call(escrow, selectors.terms), call(escrow, selectors.accounting), call(escrow, selectors.phase),
    call(escrow, selectors.tenantAccepted), call(escrow, selectors.claimCount),
    call(observed.contracts.MockUSD, selectors.balanceOf + arg(escrow)), call(observed.contracts.MockUSD, selectors.decimals), call(observed.contracts.MockUSD, selectors.mintOperator),
    call(escrow, selectors.factory), call(factory, selectors.registry), call(factory, selectors.deployer),
    call(factory, selectors.owner), call(observed.contracts.ResolverRegistry, selectors.profile + profileId.slice(2)),
  ]);
  const t = { leaseId: word(terms, 0), tenant: addr(word(terms, 1)), landlord: addr(word(terms, 2)),
    primaryResolver: addr(word(terms, 3)), fallbackResolver: addr(word(terms, 4)), token: addr(word(terms, 5)),
    depositAmount: uint(word(terms, 6)), leaseEndAt: uint(word(terms, 7)), hardEndAt: uint(word(terms, 8)),
    timeoutPolicy: word(terms, 9), termsHash: word(terms, 10), ruleVersion: uint(word(terms, 11)),
    timingProfileId: word(terms, 12), serviceProfileId: word(terms, 13), serviceTermsHash: word(terms, 14),
    registryAddress: addr(word(terms, 15)), acceptDeadline: uint(word(terms, 16)),
    timingSeconds: Array.from({ length: 9 }, (_, i) => uint(word(terms, 17 + i))) };
  insist(same(t.leaseId, leaseId) && same(t.tenant, tenant) && same(t.landlord, observed.transactions[0].expectedFrom)
    && same(t.token, observed.contracts.MockUSD) && same(t.registryAddress, observed.contracts.ResolverRegistry)
    && same(t.serviceProfileId, profileId) && same(t.termsHash, termsHash) && t.hardEndAt === hardEndAt
    && t.depositAmount === amount, "lease terms disagree with events");
  insist(same(addr(word(factoryRef, 0)), factory) && same(addr(word(registryRef, 0)), observed.contracts.ResolverRegistry)
    && same(addr(word(deployerRef, 0)), observed.contracts.DepositEscrowDeployer)
    && same(addr(word(ownerRef, 0)), observed.transactions[0].expectedFrom), "contract pointers disagree");
  insist(same(word(profile, 0), profileId) && same(word(profile, 1), t.serviceTermsHash)
    && same(addr(word(profile, 3)), t.primaryResolver) && same(addr(word(profile, 4)), t.fallbackResolver)
    && same(addr(word(profile, 5)), t.token) && same(word(profile, 9), t.timingProfileId)
    && same(word(profile, 10), t.timeoutPolicy) && uint(word(profile, 2)) === t.ruleVersion
    && BigInt(word(profile, 6)) >= BigInt(t.depositAmount) && BigInt(word(profile, 7)) >= BigInt(t.leaseEndAt)
    && BigInt(word(profile, 8)) >= BigInt(t.acceptDeadline)
    && Array.from({ length: 9 }, (_, i) => uint(word(profile, 11 + i))).every((v, i) => v === t.timingSeconds[i]), "registry profile differs from escrow snapshot");
  const hardEndOffset = [1, 2, 3, 4, 5, 7, 8].reduce((sum, i) => sum + BigInt(t.timingSeconds[i]), 0n);
  insist(BigInt(t.leaseEndAt) + hardEndOffset === BigInt(t.hardEndAt), "hard end does not follow timing policy");
  insist(Number(BigInt(word(decimals, 0))) === 6 && same(addr(word(mintOperator, 0)), observed.transactions[0].expectedFrom), "test token settings differ");
  const status = Array.from({ length: 4 }, (_, i) => BigInt(word(profile, 20 + i)) !== 0n);
  insist(status[0] && status[1] && status[2] && !status[3], "profile is not currently eligible");
  const a = Array.from({ length: 7 }, (_, i) => uint(word(accounting, i)));
  const tokenUnits = uint(word(tokenBalance, 0));
  insist(a[0] === amount && BigInt(a[1]) + BigInt(a[2]) + BigInt(a[3]) + BigInt(a[4]) + BigInt(a[5]) === BigInt(amount), "accounting conservation mismatch");
  insist(BigInt(tokenUnits) >= BigInt(a[1]) + BigInt(a[2]) + BigInt(a[3]), "escrow token balance is below claimable and unallocated funds");
  evidence.lease = { ...t, phase: Number(BigInt(word(phase, 0))), tenantAccepted: BigInt(word(accepted, 0)) !== 0n,
    claimCount: uint(word(claimCount, 0)), profileStatus: { exists: status[0], primaryAccepted: status[1], fallbackAccepted: status[2], closedForNewFunding: status[3] },
    accounting: { funded: a[0], unallocated: a[1], tenantCredit: a[2], landlordCredit: a[3], tenantWithdrawn: a[4], landlordWithdrawn: a[5], revision: a[6] },
    tokenBalanceBaseUnits: tokenUnits, tokenDecimals: Number(BigInt(word(decimals, 0))), mintOperator: addr(word(mintOperator, 0)) };
  const stableBlock = await rpc("eth_getBlockByNumber", [blockTag, false]);
  insist(same(stableBlock.hash, block.hash), "observation block changed during read");
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  attest().catch((error) => { console.error(`Attestation failed: ${error.message}`); process.exitCode = 1; });
}
