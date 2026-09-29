import assert from "node:assert/strict";
import { test } from "node:test";
import { compareRuntime } from "./attest-monad-deployment.mjs";

const trailer = (digest) => Buffer.from(`a2646970667358221220${digest}64736f6c63430008180033`, "hex");
const runtime = (body, digest) => {
  const meta = trailer(digest);
  const size = Buffer.alloc(2); size.writeUInt16BE(meta.length);
  return `0x${Buffer.concat([body, meta, size]).toString("hex")}`;
};
const digestA = "12".repeat(32);
const digestB = "34".repeat(32);

test("different compiler IPFS metadata and constructor immutable pass while executable code matches", () => {
  const body = Buffer.from(`6001600055${"00".repeat(32)}602a`, "hex");
  const actual = Buffer.from(body); actual.fill(0xab, 5, 37);
  const compared = compareRuntime(runtime(actual, digestA), {
    object: runtime(body, digestB), immutableReferences: { factory: [{ start: 5, length: 32 }] },
  });
  assert.equal(compared.executableBytes, 39);
});

test("changed opcode still fails after metadata and immutable masking", () => {
  const body = Buffer.from("6001600055", "hex");
  assert.throws(() => compareRuntime(runtime(body, digestA), {
    object: runtime(Buffer.from("6002600055", "hex"), digestB),
  }), /executable runtime differs/);
});

test("only exact embedded Solidity IPFS digests are masked", () => {
  const embedded = (digest) => Buffer.concat([Buffer.from("6001", "hex"), trailer(digest), Buffer.from("6002", "hex")]);
  assert.equal(compareRuntime(runtime(embedded(digestA), digestB), {
    object: runtime(embedded(digestB), digestA),
  }).maskedEmbeddedIpfsDigests, 1);
  const modified = embedded(digestB); modified[0] = 0x61;
  assert.throws(() => compareRuntime(runtime(embedded(digestA), digestB), {
    object: runtime(modified, digestA),
  }), /executable runtime differs/);
});
