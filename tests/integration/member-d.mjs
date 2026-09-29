import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export function memberDTest(file, pattern) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--test", "--test-name-pattern=" + pattern, "src/server/tests/" + file],
      {
        cwd: fileURLToPath(new URL("../../apps/web/", import.meta.url)),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", (error) =>
      resolve({ passed: false, output: error.message }),
    );
    child.on("close", (code) => resolve({ passed: code === 0, output }));
  });
}
