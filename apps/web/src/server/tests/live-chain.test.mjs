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

test(
  "real local EVM: service, lease, funding, exact evidence acknowledgement, claims, fallback ACL, export and sponsor transfer",
  { timeout: 180000 },
  async (t) => {
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
    const keys = Array.from({ length: 6 }, () => generatePrivateKey()),
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
    });
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
    const attached = await l.request("/api/leases/" + leaseId + "/deployment", {
      method: "POST",
      json: { transactionHash: tx },
    });
    assert.equal(attached.status, 200, JSON.stringify(attached.data));
    const escrow = attached.data.contractAddress;
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
    const fundingTx = await write(tw, escrow, escrowAbi, "fund", [1000000000n]);
    await syncLease(app, leaseId);
    const funded = await tenant.request("/api/transactions/" + fundingTx);
    assert.equal(funded.status, 200);
    assert.equal(funded.data.status, "confirmed");
    const details = await l.request("/api/leases/" + leaseId);
    assert.equal(details.data.projection.accounting.fundedAmount, "1000000000");
    const photo = await upload(app, l, leaseId, { purpose: "move-in" });
    const bundle = await l.request("/api/inspections", {
      method: "POST",
      json: {
        leaseId,
        stage: "move-in",
        items: [
          {
            roomKey: "kitchen",
            description: "Condition recorded in a fictional photo.",
            documents: [{ documentId: photo.documentId, version: 1 }],
          },
        ],
      },
    });
    assert.equal(bundle.status, 201, JSON.stringify(bundle.data));
    await write(
      lw,
      escrow,
      escrowAbi,
      "recordEvidence",
      bundle.data.transaction.args,
    );
    await write(tw, escrow, escrowAbi, "acknowledgeEvidence", [
      l.wallet,
      1n,
      bundle.data.manifest.bundleId,
      bundle.data.commitment,
      true,
    ]);
    await syncLease(app, leaseId);
    const recorded = await l.request("/api/leases/" + leaseId);
    assert.equal(recorded.data.bundles[0].acknowledged, true);
    assert.equal(recorded.data.bundles[0].agreed, true);
    assert.equal(
      computeTermsCommitment(
        canonicalJson(bundle.data.manifest),
        bundle.data.salt,
      ),
      bundle.data.commitment,
    );
    await publicClient.request({
      method: "evm_setNextBlockTimestamp",
      params: [prepare.data.terms.leaseEndAt],
    });
    await write(lw, escrow, escrowAbi, "startScheduledSettlement");
    const claim = await l.request("/api/claims/draft", {
      method: "POST",
      json: {
        leaseId,
        items: [
          {
            category: "cleaning",
            amount: "200000000",
            reason: "Fictional cleaning work for the automated case.",
            clause: "Clause 1",
            documents: [{ documentId: photo.documentId, version: 1 }],
          },
        ],
      },
    });
    assert.equal(claim.status, 201, JSON.stringify(claim.data));
    await write(
      lw,
      escrow,
      escrowAbi,
      "submitClaims",
      claim.data.transaction.args,
    );
    let live = await app.chain.lease(escrow);
    assert.equal(live.claims[0].id, "1");
    await publicClient.request({
      method: "evm_setNextBlockTimestamp",
      params: [Number(live.schedule.claimDeadline)],
    });
    await write(lw, escrow, escrowAbi, "closeClaims");
    await publicClient.request({
      method: "evm_setNextBlockTimestamp",
      params: [Number(live.schedule.responseDeadline)],
    });
    await write(lw, escrow, escrowAbi, "openClaimCase");
    await syncLease(app, leaseId);
    const [caseRow] = await app.db.query(
      "SELECT * FROM cases WHERE lease_id=$1",
      [leaseId],
    );
    const evidence = await l.request("/api/cases/" + caseRow.id + "/evidence", {
      method: "POST",
      json: {
        leaseId,
        stage: "case",
        items: [
          {
            roomKey: "kitchen",
            description: "Previously submitted photo.",
            documents: [{ documentId: photo.documentId, version: 1 }],
          },
        ],
      },
    });
    assert.equal(evidence.status, 201, JSON.stringify(evidence.data));
    assert.equal(
      (await fallback.request("/api/cases/" + caseRow.id)).status,
      403,
    );
    live = await app.chain.lease(escrow);
    await publicClient.request({
      method: "evm_setNextBlockTimestamp",
      params: [Number(live.activeCase.primaryDeadline)],
    });
    await write(lw, escrow, escrowAbi, "escalateTimeout", [
      BigInt(live.activeCase.caseId),
    ]);
    await syncLease(app, leaseId);
    assert.equal(
      (await fallback.request("/api/cases/" + caseRow.id)).status,
      200,
    );
    const access = await fallback.request(
      "/api/documents/" +
        photo.documentId +
        "/access?version=1&caseId=" +
        caseRow.id,
    );
    assert.equal(access.status, 200);
    assert.equal((await fallback.request(access.data.url)).status, 200);
    const decisionBody = {
      reason: "Fictional final reasoning based on supplied materials.",
      documents: [],
      reasons: [
        {
          claimId: "1",
          landlordAmount: "50000000",
          reason: "Fictional partial responsibility for cleaning.",
        },
      ],
    };
    assert.equal(
      (
        await fallback.request("/api/cases/" + caseRow.id + "/decisions", {
          method: "POST",
          json: decisionBody,
        })
      ).status,
      409,
    );
    live = await app.chain.lease(escrow);
    await publicClient.request({
      method: "evm_setNextBlockTimestamp",
      params: [Number(live.activeCase.fallbackStartAt) + 30],
    });
    await publicClient.request({ method: "evm_mine", params: [] });
    const decision = await fallback.request(
      "/api/cases/" + caseRow.id + "/decisions",
      { method: "POST", json: decisionBody },
    );
    assert.equal(decision.status, 201, JSON.stringify(decision.data));
    await write(
      fw,
      escrow,
      escrowAbi,
      "resolveFallback",
      decision.data.transaction.args,
    );
    await syncLease(app, leaseId);
    assert.equal((await fallback.request(access.data.url)).status, 403);
    const exp = await tenant.request("/api/exports", {
      method: "POST",
      json: { leaseId },
    });
    await runExportJob(app);
    assert.equal(
      (await tenant.request("/api/exports/" + exp.data.id)).data.state,
      "ready",
    );
    const gas = await tenant.request("/api/test-gas/request", {
      method: "POST",
      json: { leaseId },
    });
    assert.equal(gas.status, 202, JSON.stringify(gas.data));
    const balance = await publicClient.getBalance({
      address: tenant.account.address,
    });
    await runGasJob(app);
    f.advance(10000);
    await runGasJob(app);
    const gasStatus = await tenant.request(
      "/api/test-gas/requests/" + gas.data.id,
    );
    assert.equal(
      gasStatus.data.state,
      "confirmed",
      JSON.stringify(gasStatus.data),
    );
    assert.equal(
      await publicClient.getBalance({ address: tenant.account.address }),
      balance + app.config.gasAmount,
    );
    await write(wallets[0], escrow, escrowAbi, "withdrawFor", [
      tenant.account.address,
    ]);
    await write(wallets[0], escrow, escrowAbi, "withdrawFor", [
      l.account.address,
    ]);
    assert.equal(
      await publicClient.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "balanceOf",
        args: [tenant.account.address],
      }),
      950000000n,
    );
    assert.equal(
      await publicClient.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "balanceOf",
        args: [l.account.address],
      }),
      50000000n,
    );
    await syncLease(app, leaseId);
    const finished = await tenant.request("/api/leases/" + leaseId);
    assert.equal(
      finished.data.projection.accounting.tenantWithdrawn,
      "950000000",
    );
    assert.equal(
      finished.data.projection.accounting.landlordWithdrawn,
      "50000000",
    );
    // A mismatched fallback disables reads even when the primary endpoint is healthy.
    app.config.chainId = 31337;
    await assert.rejects(
      createChain(app.config).health(),
      (error) => error.code === "RPC_CHAIN_MISMATCH",
    );
    t.diagnostic(
      "Executed real local EVM transactions; no public testnet deployment is claimed.",
    );
  },
);
