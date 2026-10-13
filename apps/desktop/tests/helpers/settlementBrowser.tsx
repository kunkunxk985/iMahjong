import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SettlementModal } from '../../src/views/Settlement';
import { settlementFixture } from './settlementFixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

export async function runSettlementBrowser() {
  const snapshots: Record<string, string> = {};
  const uploads: any[] = [];
  let writes = 0;
  let again = 0;
  let leave = 0;
  let profile = 0;
  const originalSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key.startsWith('pizhou_match_history')) writes++;
    return originalSet.call(this, key, value);
  };
  globalThis.fetch = (async (_url: string, options: RequestInit) => {
    uploads.push(JSON.parse(String(options.body)));
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  const render = async (view: any, settlement: any, extra = {}) => {
    await act(async () => root.render(<SettlementModal view={view} settlement={settlement}
      readyCount={2} onAgain={() => again++} onLeave={() => leave++}
      onOpenProfile={() => profile++} token="fixture-token" serverUrl="https://fixture.invalid" {...extra} />));
  };
  const click = async (text: string) => {
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    if (!button) throw new Error(`Missing button: ${text}`);
    await act(async () => button.click());
  };
  const capture = (key: string) => { snapshots[key] = container.innerHTML; };
  for (const kind of ['bao', 'plain', 'self', 'draw']) {
    const { view, settlement } = settlementFixture(kind);
    await act(async () => root.render(null));
    await render(view, settlement);
    capture(`${kind}:podium`);
    await click('四家牌面'); capture(`${kind}:replay`);
    if (kind !== 'draw') {
      for (const tab of ['收付明细', kind === 'bao' ? '包庄前流水' : '两两流水', '胡数明细']) {
        await click(tab); capture(`${kind}:${tab}:money`);
        await click('只看分数'); capture(`${kind}:${tab}:points`);
        await click('显示金额');
      }
    }
  }
  await act(async () => root.render(null));
  localStorage.clear(); writes = 0; uploads.length = 0;
  const { view, settlement } = settlementFixture();
  await render(view, settlement);
  await render(structuredClone(view), structuredClone(settlement));
  await click('收付明细');
  await click('只看分数');
  await click('查看牌桌'); capture('minimized');
  await click('再来一局'); await click('回大厅');
  await click('📊 展开对账结算单');
  await act(async () => container.querySelector<HTMLButtonElement>('.settlement-profile-button')!.click());
  await render(view, settlement, { alreadyReady: true }); capture('ready');
  await click('已准备，等朋友');
  const history = JSON.parse(localStorage.getItem('pizhou_match_history_v2_guest')!);
  const saveResult = { writes, uploads: uploads.length, ids: history.map((r: any) => r.id),
    uploadId: uploads[0].record?.id ?? uploads[0].id, again, leave, profile,
    delta: history[0].myDeltaScore, score: history[0].scores[0].score };
  const next = structuredClone(view); next.round++;
  await render(next, structuredClone(settlement));
  const nextResult = { writes, uploads: uploads.length,
    ids: JSON.parse(localStorage.getItem('pizhou_match_history_v2_guest')!).map((r: any) => r.id) };
  await act(async () => root.unmount());
  return { snapshots, saveResult, nextResult };
}
