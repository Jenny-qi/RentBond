import { mkdir, readFile, writeFile, unlink, access } from "node:fs/promises";
import { join, dirname, resolve, sep } from "node:path";
import type { Config } from "./config.ts";
import { ApiFailure, requireThat, unavailable } from "./errors.ts";

export interface ObjectStorage {
  put(key: string, body: Uint8Array, mime: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
  health(): Promise<boolean>;
}
const safeKey = (key: string) => {
  requireThat(
    /^[a-z0-9-]+\/[a-z0-9-]+$/.test(key),
    422,
    "INVALID_INPUT",
    "Invalid storage key.",
  );
  return key;
};
export function createStorage(config: Config): ObjectStorage {
  if (config.storageUrl && config.storageKey) {
    const base = config.storageUrl.replace(/\/$/, "") + "/storage/v1";
    const bucket = encodeURIComponent(config.storageBucket);
    const headers = {
      authorization: "Bearer " + config.storageKey,
      apikey: config.storageKey,
    };
    const call = async (url: string, init: RequestInit = {}) => {
      let response: Response;
      try {
        response = await fetch(base + url, {
          ...init,
          headers: { ...headers, ...init.headers },
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        throw unavailable("Private storage is unavailable.");
      }
      return response;
    };
    return {
      async put(key, body, mime) {
        const response = await call("/object/" + bucket + "/" + safeKey(key), {
          method: "POST",
          headers: { "content-type": mime, "x-upsert": "false" },
          body: Buffer.from(body),
        });
        if (!response.ok) throw unavailable("Private upload failed.");
      },
      async get(key) {
        const response = await call("/object/" + bucket + "/" + safeKey(key));
        if (!response.ok) throw unavailable("Private file is unavailable.");
        return new Uint8Array(await response.arrayBuffer());
      },
      async remove(key) {
        const response = await call("/object/" + bucket, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prefixes: [safeKey(key)] }),
        });
        if (!response.ok) throw unavailable("Private file deletion failed.");
      },
      async health() {
        const response = await call("/bucket/" + bucket);
        if (!response.ok) return false;
        const info = await response.json();
        return (
          info.public === false &&
          Number(info.file_size_limit) >= 115343360 &&
          Number(info.file_size_limit) <= 157286400 &&
          [
            "image/jpeg",
            "image/png",
            "application/pdf",
            "application/zip",
          ].every((mime) => info.allowed_mime_types?.includes(mime))
        );
      },
    };
  }
  const base = resolve(config.dataDir, "objects");
  const path = (key: string) => {
    const result = resolve(base, safeKey(key));
    requireThat(
      result.startsWith(base + sep),
      422,
      "INVALID_INPUT",
      "Invalid storage path.",
    );
    return result;
  };
  return {
    async put(key, body) {
      const target = path(key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body, { flag: "wx", mode: 0o600 });
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(path(key)));
      } catch {
        throw unavailable("Private file is unavailable.");
      }
    },
    async remove(key) {
      try {
        await unlink(path(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
    async health() {
      await mkdir(base, { recursive: true });
      await access(base);
      return true;
    },
  };
}

export function detectMime(bytes: Uint8Array): string {
  if (
    bytes.length >= 8 &&
    Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-")
    return "application/pdf";
  throw new ApiFailure(
    422,
    "UNSUPPORTED_FILE",
    "Only JPEG, PNG and PDF files are accepted.",
  );
}
export async function boundedBody(
  request: Request,
  max: number,
): Promise<Uint8Array> {
  const announced = request.headers.get("content-length");
  if (announced && Number(announced) > max)
    throw new ApiFailure(413, "BODY_TOO_LARGE", "Request body is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel().catch(() => {});
      reject(new ApiFailure(408, "UPLOAD_TIMEOUT", "Request body timed out."));
    }, 30000);
  });
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > max) {
        await reader.cancel();
        throw new ApiFailure(
          413,
          "BODY_TOO_LARGE",
          "Request body is too large.",
        );
      }
      parts.push(chunk.value);
    }
  } finally {
    clearTimeout(timer!);
    reader.releaseLock();
  }
  return new Uint8Array(Buffer.concat(parts));
}
