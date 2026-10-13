import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { downloadBattleReportPoster, exportBattleReportPoster, renderBattleReportCanvas } from '../src/utils/canvasPoster.ts';
import { posterCases } from './helpers/posterCases.ts';
import { recordPoster } from './helpers/posterRecording.ts';

// Baselines are captured from the original 910-line renderer, not pixel comparisons.
for (const [name, data] of Object.entries(posterCases)) {
  test(`poster draw-command parity: ${name}`, async (t) => {
    t.mock.method(Date.prototype, 'toLocaleString', () => 'fixed local time');
    const { calls, canvas } = recordPoster(t);
    const playersBefore = structuredClone(data.players);
    assert.equal(await renderBattleReportCanvas(data), canvas);
    assert.deepEqual(data.players, playersBefore, 'standings must not reorder input');
    assert.equal(canvas.width, 1200);
    assert.equal(canvas.height, 1600);
    const actual = { count: calls.length, sha256: createHash('sha256').update(JSON.stringify(calls)).digest('hex') };
    const baselines = JSON.parse(readFileSync(new URL('./fixtures/posterCommands.json', import.meta.url), 'utf8'));
    assert.deepEqual(actual, baselines[name]);
  });
}

test('waits for fonts before creating the canvas', async (t) => {
  let resolve!: () => void;
  const ready = new Promise<void>((done) => { resolve = done; });
  const { calls, canvas } = recordPoster(t, { fonts: { ready } });
  const result = renderBattleReportCanvas(posterCases.winner);
  assert.deepEqual(calls, []);
  resolve();
  assert.equal(await result, canvas);
});

test('rejected font readiness falls back to drawing', async (t) => {
  const { canvas } = recordPoster(t, { fonts: { ready: Promise.reject(new Error('font load')) } });
  assert.equal(await renderBattleReportCanvas(posterCases.winner), canvas);
});

test('missing 2d context rejects with the existing error', async (t) => {
  recordPoster(t, { missingContext: true });
  await assert.rejects(renderBattleReportCanvas(posterCases.winner), { message: 'Failed to get 2d canvas context' });
});

test('drawing exceptions reject the asynchronous public APIs unchanged', async (t) => {
  const error = new Error('canvas drawing failed');
  recordPoster(t, { drawError: error });
  await assert.rejects(renderBattleReportCanvas(posterCases.winner), (actual) => actual === error);
  await assert.rejects(exportBattleReportPoster(posterCases.winner), (actual) => actual === error);
});

test('PNG export preserves return value, format and quality', async (t) => {
  const { calls } = recordPoster(t);
  assert.equal(await exportBattleReportPoster(posterCases.winner), 'data:image/png;base64,recorded');
  assert.deepEqual(calls.at(-1), ['toDataURL', 'image/png', 1]);
});

test('PNG serialization errors propagate unchanged', async (t) => {
  const error = new Error('tainted canvas');
  recordPoster(t, { exportError: error });
  await assert.rejects(exportBattleReportPoster(posterCases.winner), (actual) => actual === error);
});

test('download uses the supplied filename and removes its temporary link', (t) => {
  const { calls, link } = recordPoster(t);
  assert.equal(downloadBattleReportPoster('data:image/png;base64,payload', 'report.png'), undefined);
  assert.equal(link.href, 'data:image/png;base64,payload');
  assert.equal(link.download, 'report.png');
  assert.deepEqual(calls, [['createElement', 'a'], ['appendChild', true], ['click'], ['removeChild', true]]);
});

test('download defaults to the timestamp filename for absent or empty names', (t) => {
  t.mock.method(Date, 'now', () => 123456);
  const { link } = recordPoster(t);
  downloadBattleReportPoster('url');
  assert.equal(link.download, 'pizhou-battle-report-123456.png');
  downloadBattleReportPoster('url', '');
  assert.equal(link.download, 'pizhou-battle-report-123456.png');
});
