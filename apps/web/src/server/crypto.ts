import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import {
  canonicalJson,
  computeTermsCommitment,
  verifyTermsCommitment,
} from "../../../../packages/shared/src/commitments/index.ts";
export { canonicalJson, computeTermsCommitment, verifyTermsCommitment };
export const randomToken = () => randomBytes(32).toString("hex");
export const sha256 = (input: string | Uint8Array) =>
  createHash("sha256").update(input).digest("hex");
export const newCommitment = (value: unknown) => {
  const salt = "0x" + randomToken();
  return {
    salt,
    commitment: computeTermsCommitment(canonicalJson(value), salt),
  };
};
export function seal(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret).digest(),
    iv,
  );
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function unseal<T>(value: string, secret: string): T {
  const data = Buffer.from(value, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret).digest(),
    data.subarray(0, 12),
  );
  cipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  ) as T;
}
