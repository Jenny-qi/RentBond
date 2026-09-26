#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "deployments", "abi");
const contracts = [
  ["MockUSD", "contracts/out/MockUSD.sol/MockUSD.json"],
  ["ResolverRegistry", "contracts/out/ResolverRegistry.sol/ResolverRegistry.json"],
  ["DepositEscrowDeployer", "contracts/out/DepositEscrowDeployer.sol/DepositEscrowDeployer.json"],
  ["LeaseFactory", "contracts/out/LeaseFactory.sol/LeaseFactory.json"],
  ["DepositEscrow", "contracts/out/DepositEscrow.sol/DepositEscrow.json"],
];
const guardedPaths = [
  ":(glob)contracts/src/**/*.sol",
  ":(glob)contracts/script/**/*.sol",
  "contracts/foundry.toml",
  "contracts/remappings.txt",
];

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const dirty = git(["status", "--porcelain", "--", ...guardedPaths]);
if (dirty) {
  throw new Error("Refusing ABI export: contract source, deployment Solidity, or Foundry config is uncommitted");
}

mkdirSync(outputDir, { recursive: true });
const sourceCommit = git(["rev-parse", "HEAD"]);
const entries = [];

for (const [name, artifactPath] of contracts) {
  const artifact = JSON.parse(readFileSync(join(root, artifactPath), "utf8"));
  if (!Array.isArray(artifact.abi)) throw new Error(`${artifactPath} does not contain an ABI array`);
  const filename = `${name}.json`;
  const serialized = `${JSON.stringify(artifact.abi, null, 2)}\n`;
  writeFileSync(join(outputDir, filename), serialized);
  entries.push({
    contract: name,
    file: filename,
    artifact: artifactPath,
    sha256: createHash("sha256").update(serialized).digest("hex"),
  });
}

const bundleInput = entries.map(({ contract, sha256 }) => `${contract}:${sha256}`).join("\n") + "\n";
const bundleSha256 = createHash("sha256").update(bundleInput).digest("hex");
const manifest = {
  schemaVersion: 1,
  sourceCommit,
  compiler: "solc 0.8.24",
  forgePackage: "@foundry-rs/forge@1.7.1",
  bundleSha256,
  contracts: entries,
};
writeFileSync(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const readme = `# Generated contract ABIs

These ABI files are generated from the fixed Foundry artifacts under \`contracts/out\` by running \`npm run contracts:export:abi\`. Do not hand-edit them.

- Source commit: \`${sourceCommit}\`
- Bundle SHA-256: \`${bundleSha256}\`
- Deployment status: no address is implied by an ABI export; consult the network deployment record.

The manifest records every artifact path and per-file digest so frontend and Worker consumers can verify the exact interface bundle.
`;
writeFileSync(join(outputDir, "README.md"), readme);

console.log(`Exported ${entries.length} ABIs to deployments/abi`);
console.log(`Bundle SHA-256: ${bundleSha256}`);
