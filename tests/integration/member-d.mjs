import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function runNodeTest(file, pattern, cwd) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--test", ...(pattern ? ["--test-name-pattern=" + pattern] : []), file],
      {
        cwd,
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
    child.on("close", (code) => {
      const match = output.match(/^(?:#|ℹ)\s*pass\s+(\d+)\s*$/m);
      resolve({ passed: code === 0 && match !== null && Number(match[1]) > 0, output });
    });
  });
}

export function memberDTest(file, pattern) {
  return runNodeTest("src/server/tests/" + file, pattern, fileURLToPath(new URL("../../apps/web/", import.meta.url)));
}

export function workerSchedulerTest() {
  return runNodeTest("tests/integration/scheduler.test.mjs", null, fileURLToPath(new URL("../../", import.meta.url)));
}
