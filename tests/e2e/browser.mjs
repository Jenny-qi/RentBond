import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// One isolated browser/chain/server session per runner invocation. Selected
// slices retain explicit test IDs; no stale report may count as a new success.
let batch;
export function browserTest(id) {
  batch ??= (async () => {
    const reportUrl = new URL('../../test-results/e2e-local/results.json', import.meta.url);
    await rm(reportUrl, { force: true });
    return new Promise(resolve => {
      const selected = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',').filter(id => id.startsWith('E2E-')).sort();
      const cwd = fileURLToPath(new URL('../../apps/web/', import.meta.url));
      const child = spawn(process.execPath, ['src/server/tests/browser.e2e.mjs', ...(selected ? [selected.join(',')] : [])], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { output += chunk; });
      const timer = setTimeout(() => child.kill('SIGTERM'), 15 * 60 * 1000);
      child.on('error', error => { clearTimeout(timer); resolve({ output: error.message, results: [] }); });
      child.on('close', async code => {
        clearTimeout(timer);
        try {
          const report = JSON.parse(await readFile(reportUrl, 'utf8'));
          resolve({ ...report, output, code });
        } catch (error) { resolve({ output: output + '\n' + error.message, results: [] }); }
      });
    });
  })();
  return batch.then(report => {
    const result = report.results.find(result => result.id === id);
    if (result?.passed && report.code !== 0 && report.results.every(result => result.passed)) return { passed: false, output: 'Browser harness exited nonzero after reporting success: ' + report.output };
    return result ? { ...result, evidence: { ...result.evidence, sourceCommit: report.sourceCommit,
      workingTreeDirty: report.workingTreeDirty } } : { passed: false, output: report.output || 'Missing browser result: ' + id };
  });
}
