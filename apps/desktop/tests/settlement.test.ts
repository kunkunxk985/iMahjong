import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildSync } from 'esbuild';

const require = createRequire(import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), 'settlement-test-'));

// `require('electron')` returns the `.app` bundle path, but spawning a `.app`
// directory is rejected with EACCES on current macOS — only the inner Mach-O
// binary is directly executable. Resolve to that binary for the headless run.
function electronBinary(): string {
  const electronPath = require('electron') as string;
  return process.platform === 'darwin' && electronPath.endsWith('.app')
    ? join(electronPath, 'Contents', 'MacOS', 'Electron')
    : electronPath;
}
const snapshotPath = new URL('./settlement.snapshots.json', import.meta.url);
const resultPath = join(scratch, 'result.json');
const htmlPath = join(scratch, 'index.html');

buildSync({
  entryPoints: [fileURLToPath(new URL('./helpers/settlementBrowser.tsx', import.meta.url))],
  bundle: true, outfile: join(scratch, 'browser.js'), platform: 'browser',
  format: 'iife', globalName: 'SettlementTests', jsx: 'automatic',
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url)), loader: { '.css': 'empty' },
});
writeFileSync(htmlPath, '<div id="root"></div><script src="browser.js"></script><script>window.runSettlementBrowser=SettlementTests.runSettlementBrowser</script>');
const env = { ...process.env, SETTLEMENT_TEST_HTML: htmlPath, SETTLEMENT_TEST_RESULT: resultPath, SETTLEMENT_TEST_USER_DATA: join(scratch, 'electron-data') };
delete env.ELECTRON_RUN_AS_NODE;
const run = spawnSync(electronBinary(), [fileURLToPath(new URL('./helpers/settlementElectron.cjs', import.meta.url))], { env, encoding: 'utf8', timeout: 30000 });
assert.equal(run.status, 0, run.stderr || run.stdout);
const result = JSON.parse(readFileSync(resultPath, 'utf8'));
const hashes = Object.fromEntries(Object.entries(result.snapshots).map(([key, html]) => [key, createHash('sha256').update(String(html)).digest('hex')]));
if (process.env.UPDATE_SETTLEMENT_SNAPSHOTS === '1') writeFileSync(snapshotPath, JSON.stringify(hashes, null, 2) + '\n');
const expected = JSON.parse(readFileSync(snapshotPath, 'utf8'));
rmSync(scratch, { recursive: true, force: true });

for (const [key, hash] of Object.entries(hashes)) {
  test(`settlement ${key} preserves DOM, classes, text and inline styles`, () => assert.equal(hash, expected[key]));
}
test('settlement stable id and savedKeyRef prevent repeated saves during broadcast and UI changes', () => {
  assert.deepEqual(result.saveResult, { writes: 1, uploads: 1, ids: ['123456-7-0-ping-hu-hu'],
    uploadId: '123456-7-0-ping-hu-hu', again: 1, leave: 1, profile: 1, delta: 120, score: 320 });
});
test('settlement saves a new round once after a new broadcast', () => {
  assert.deepEqual(result.nextResult, { writes: 2, uploads: 2,
    ids: ['123456-8-0-ping-hu-hu', '123456-7-0-ping-hu-hu'] });
});
