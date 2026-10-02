import { createConnection } from "node:net";
import { once } from "node:events";
import type { Config } from "./config.ts";
import { unavailable } from "./errors.ts";

export interface ScanResult {
  clean: boolean;
  engine: string;
}
export interface FileScanner {
  scan(bytes: Uint8Array): Promise<ScanResult>;
  health(): Promise<{ ready: boolean; engine: string }>;
}

export function createScanner(config: Config): FileScanner {
  if (config.scanMode === "disabled-local") {
    if (
      config.mode !== "local" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(config.origin).hostname,
      )
    )
      throw new Error(
        "Scan bypass is allowed only for local loopback development.",
      );
    return {
      scan: async () => ({ clean: true, engine: "disabled-local" }),
      health: async () => ({ ready: false, engine: "disabled-local" }),
    };
  }
  async function command(name: string, bytes?: Uint8Array): Promise<string> {
    const socket = createConnection({
      host: config.clamavHost,
      port: config.clamavPort,
    });
    let output = Buffer.alloc(0);
    const response = new Promise<string>((resolve, reject) => {
      const fail = () => reject(unavailable("File scanner is unavailable."));
      socket.on("error", fail);
      socket.on("close", () => {
        if (!output.includes(0)) fail();
      });
      socket.on("data", (chunk: Buffer) => {
        output = Buffer.concat([output, chunk]);
        if (output.length > 4096) {
          fail();
          socket.destroy();
          return;
        }
        const end = output.indexOf(0);
        if (end >= 0) resolve(output.subarray(0, end).toString("utf8"));
      });
    });
    // A response can fail while the producer is waiting for drain.
    void response.catch(() => {});
    const timer = setTimeout(
      () => socket.destroy(new Error("scan timeout")),
      config.scanTimeoutMs,
    );
    try {
      await Promise.race([
        once(socket, "connect"),
        response.then(() => {
          throw unavailable("Premature scanner response.");
        }),
      ]);
      socket.write("z" + name + "\0");
      if (bytes) {
        if (bytes.length > 10485760)
          throw unavailable("File exceeds scanner limit.");
        for (let offset = 0; offset < bytes.length; offset += 65536) {
          const part = bytes.subarray(offset, offset + 65536),
            size = Buffer.alloc(4);
          size.writeUInt32BE(part.length);
          socket.write(size);
          // The entire payload is bounded to 10 MiB. Buffering writes avoids
          // an unresolvable drain wait if the peer closes during upload.
          socket.write(part);
        }
        socket.write(Buffer.alloc(4));
      }
      return await response;
    } catch {
      throw unavailable("File scanner is unavailable.");
    } finally {
      clearTimeout(timer);
      socket.destroy();
    }
  }
  async function health() {
    const engine = await command("VERSION");
    const parts = engine.split("/");
    const date = parts.slice(2).join("/");
    const signatureAt = Date.parse(
      /(?:GMT|UTC|[+-]\d{4})$/.test(date) ? date : date + " UTC",
    );
    const age = Date.now() - signatureAt;
    return {
      engine: engine.slice(0, 200),
      ready:
        /^ClamAV [\d.]+/.test(engine) &&
        Number.isFinite(signatureAt) &&
        age >= -3600000 &&
        age <= config.scanMaxAgeHours * 3600000,
    };
  }
  return {
    health,
    async scan(bytes) {
      const status = await health();
      if (!status.ready)
        throw unavailable("Scanner signatures are stale or unavailable.");
      const result = await command("INSTREAM", bytes);
      if (result === "stream: OK")
        return { clean: true, engine: status.engine };
      if (result.startsWith("stream: ") && result.endsWith(" FOUND"))
        return { clean: false, engine: status.engine };
      throw unavailable("File scan did not complete.");
    },
  };
}
