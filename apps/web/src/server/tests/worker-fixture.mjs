import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { network } from "hardhat";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { fixture, client, draft, upload, hash } from "./helpers.mjs";
import { createChain, escrowAbi, registryAbi, factoryAbi } from "../chain.ts";
import {
  newCommitment,
  canonicalJson,
  computeTermsCommitment,
} from "../crypto.ts";
import { TIMEOUT_POLICY, checkedProfile } from "../leases.ts";
import { syncLease } from "../projections.ts";
import { runGasJob, runExportJob } from "../jobs.ts";
import { readLease as readFrontendLease } from "../../features/live/client.ts";

export async function liveWorkerFixture(t, { persistent = false, beforeAttach } = {}) {
    const server = await network.createServer(
      { network: "default", override: { chainId: 10143 } },
      "127.0.0.1",
      0,
    );
    const listen = await server.listen();
    t.after(() => server.close());
    const rpc = "http://127.0.0.1:" + listen.port;
    const chain = defineChain({
      id: 10143,
      name: "Local EVM only (not Monad testnet)",
      nativeCurrency: { name: "Test MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
    });
    const publicClient = createPublicClient({
      chain,
      transport: http(rpc),
      cacheTime: 0,
    });
    const keys = Array.from({ length: 7 }, () => generatePrivateKey()),
      accounts = keys.map(privateKeyToAccount);
    for (const account of accounts)
      await publicClient.request({
        method: "hardhat_setBalance",
        params: [account.address, "0x56bc75e2d63100000"],
      });
    const wallets = accounts.map((account) =>
      createWalletClient({ account, chain, transport: http(rpc) }),
    );
    const compiled = JSON.parse(
      await readFile(
        new URL("../../../.rentbond/compiled-contracts.json", import.meta.url),
        "utf8",
      ),
    );
    const deploy = async (name, args = []) => {
      const artifact = compiled["src/" + name + ".sol"][name];
      const tx = await wallets[0].deployContract({
        abi: artifact.abi,
        bytecode: "0x" + artifact.evm.bytecode.object,
        args,
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });
      assert.equal(receipt.status, "success");
      return receipt.contractAddress;
    };
    const write = async (wallet, address, abi, functionName, args = []) => {
      const tx = await wallet.writeContract({
        address,
        abi,
        functionName,
        args,
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });
      assert.equal(receipt.status, "success");
      return tx;
    };
    const token = await deploy("MockUSD", [accounts[0].address]),
      registry = await deploy("ResolverRegistry");
    const deployer = await deploy("DepositEscrowDeployer"),
      factory = await deploy("LeaseFactory", [registry, deployer]);
    const f = await fixture(t, {
      mode: "testnet",
      chainId: 10143,
      rpcUrl: rpc,
      rpcFallbackUrl: rpc,
      factoryAddress: factory.toLowerCase(),
      registryAddress: registry.toLowerCase(),
      sponsorKey: keys[5],
    }, !persistent);
    const { app } = f;
    app.chain = createChain(app.config);
    const [l, tenant, r, fallback] = accounts
      .slice(1, 5)
      .map((account) => client(app, account));
    const [lw, tw, rw, fw] = wallets.slice(1, 5);
    const block = await publicClient.getBlock(),
      now = Number(block.timestamp);
    f.setNow(now * 1000);
    for (const actor of [l, tenant, r, fallback]) await actor.login();
    const timing = {
      checkoutResponse: "60",
      claim: "60",
      response: "60",
      evidence: "60",
      primary: "60",
      challenge: "60",
      fallbackEvidence: "30",
      fallbackResolver: "60",
      exitNotice: "60",
    };
    const timingProfileId = await publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "computeTimingProfileId",
      args: [timing, TIMEOUT_POLICY],
    });
    const parameters = {
      ruleVersion: "1",
      primaryResolver: r.account.address,
      fallbackResolver: fallback.account.address,
      token,
      maxDeposit: "10000000000",
      maxLeaseEnd: String(now + 2000000),
      acceptUntil: String(now + 1000000),
      timingProfileId,
      timeoutPolicy: TIMEOUT_POLICY,
      timing,
    };
    const manifest = {
      schemaVersion: "1.0.0",
      text: "Fictional service for local EVM verification.",
      parameters,
    };
    const committed = newCommitment(manifest);
    const profile = {
      ...parameters,
      profileId: hash(0),
      serviceTermsHash: committed.commitment,
    };
    profile.profileId = await publicClient.readContract({
      address: registry,
      abi: registryAbi,
      functionName: "computeProfileId",
      args: [profile],
    });
    await write(wallets[0], registry, registryAbi, "createProfile", [profile]);
    await write(rw, registry, registryAbi, "acceptProfile", [
      profile.profileId,
    ]);
    await write(fw, registry, registryAbi, "acceptProfile", [
      profile.profileId,
    ]);
    const profileKey = registry.toLowerCase() + ":" + profile.profileId;
    await app.db.query(
      "INSERT INTO service_profiles(id,chain_id,registry_address,profile_id,manifest,salt,commitment,reviewed,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,true,$8)",
      [
        profileKey,
        10143,
        registry.toLowerCase(),
        profile.profileId,
        JSON.stringify(manifest),
        committed.salt,
        committed.commitment,
        app.now(),
      ],
    );
    const available = await l.request("/api/resolver/profiles");
    await checkedProfile(
      {
        app,
        sql: app.db,
        session: { wallet: l.wallet },
        now: app.now(),
        requestId: "live-chain",
      },
      profileKey,
    );
    assert.equal(available.status, 200, JSON.stringify(available.data));
    assert.equal(available.data.items.length, 1);
    const leaseId = await draft(app, l, tenant, {
      serviceProfileId: profileKey,
    });
    const prepare = await l.request(
      "/api/leases/drafts/" + leaseId + "/prepare",
      { method: "POST", json: { version: 2 } },
    );
    assert.equal(prepare.status, 200, JSON.stringify(prepare.data));
    const tx = await write(
      lw,
      factory,
      factoryAbi,
      "createLease",
      prepare.data.args,
    );
    if (beforeAttach) await beforeAttach(app);
    const attached = await l.request("/api/leases/" + leaseId + "/deployment", {
      method: "POST",
      json: { transactionHash: tx },
    });
    assert.equal(attached.status, 200, JSON.stringify(attached.data));
    const escrow = attached.data.contractAddress;
    const frontendConfig = { mode: 'local', chainId: 10143, rpcUrl: rpc, factory, confirmations: 1 };
    const frontendBefore = await readFrontendLease(frontendConfig, escrow, prepare.data.commitment);
    assert.equal(frontendBefore.accounting.fundedAmount, '0');
    await assert.rejects(readFrontendLease(frontendConfig, escrow, hash(999)), /terms commitment mismatch/);
    const tokenAbi = compiled["src/MockUSD.sol"].MockUSD.abi;
    await write(tw, escrow, escrowAbi, "acceptTerms", [
      prepare.data.commitment,
    ]);
    await write(wallets[0], token, tokenAbi, "mint", [
      tenant.account.address,
      1000000000n,
    ]);
    await write(tw, token, tokenAbi, "approve", [escrow, 1000000000n]);
    const before = await app.chain.lease(escrow);
    assert.equal(before.accounting.fundedAmount, "0", "approve is not funding");
    const frontendApproved = await readFrontendLease(frontendConfig, escrow, prepare.data.commitment);
    assert.equal(frontendApproved.allowance, '1000000000');
    assert.equal(frontendApproved.accounting.fundedAmount, '0');
    const beforeFunding = await publicClient.request({ method: "evm_snapshot", params: [] });
    const fundingTx = await write(tw, escrow, escrowAbi, "fund", [1000000000n]);
    await syncLease(app, leaseId);
    const funded = await tenant.request("/api/transactions/" + fundingTx);
    assert.equal(funded.status, 200);
    assert.equal(funded.data.status, "confirmed");
    const details = await l.request("/api/leases/" + leaseId);
    assert.equal(details.data.projection.accounting.fundedAmount, "1000000000");

    const config = { ...app.config, deploymentBlock: 0n, batchSize: 1000, execute: true,
      maxFeeWei: 1000000000000000000n, pollIntervalMs: 1000 };
    return { app, config, f, accounts, keys, wallets, publicClient, l, tenant, r, fallback,
      lw, tw, rw, fw, escrow, leaseId, prepare, write, tokenAbi, token,
      fundingTx, creationTx: tx, beforeFunding };
}
