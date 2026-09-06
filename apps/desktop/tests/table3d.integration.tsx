import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { makeTile, type ClientView, type GameAction } from '@pizhou/shared';
import { Table } from '../src/views/Table';
import { MahjongScene3D } from '../src/table3d/MahjongScene3D';
import '../src/styles.css';

// This fixture runs in Electron so WebGL, React effects and CSS are real.
const root = createRoot(document.getElementById('root')!);
const hand = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((rank) => makeTile('wan', rank, 0));
hand.push(makeTile('tong', 2, 0), makeTile('tong', 3, 0), makeTile('tiao', 5, 0), makeTile('dragon', 1, 0), makeTile('dragon', 1, 1));
const players = Array.from({ length: 4 }, (_, seat) => ({
  seat, nickname: ['测试玩家', '东家', '南家', '西家'][seat], avatar: '茶',
  ready: true, online: true, isHost: seat === 0, isDealer: seat === 0,
  closed: false, score: 0, handCount: seat === 0 ? 14 : 10,
  discards: [makeTile('tong', seat + 1, 1)], melds: [],
  ...(seat === 0 ? { hand, lastDrawnId: hand.at(-1)!.id } : {}),
}));
let view: ClientView = {
  sequence: 1, roomCode: '123456', mySeat: 0, token: 'fixture', phase: 'playing',
  gamePhase: 'self-turn', dealer: 0, currentSeat: 1, wallCount: 60,
  turnDeadline: null, lastDiscard: null, players, availableActions: [],
  settlement: null, hostSeat: 0, round: 1,
};
const actions: GameAction[] = [];
let scene: any;
const originalUpdate = MahjongScene3D.prototype.update;
MahjongScene3D.prototype.update = function (...args) {
  scene = this;
  return originalUpdate.apply(this, args);
};
const pause = () => new Promise((resolve) => setTimeout(resolve, 80));
let checks = 0;
const check = (condition: unknown, label: string) => {
  if (!condition) throw new Error(label);
  checks++;
};
const render = () => flushSync(() => root.render(<Table view={view} onAction={(action) => actions.push(action)} networkStatus="open" />));
const toggle = () => (document.querySelector('.board-3d-btn') as HTMLButtonElement).click();
const visible = (selector: string) => {
  const element = document.querySelector(selector) as HTMLElement | null;
  return Boolean(element && element.getBoundingClientRect().width && element.getBoundingClientRect().height);
};

async function run() {
  localStorage.setItem('pizhou_render_mode', '2d');
  render();
  await pause();
  toggle();
  await pause();
  check(scene && document.querySelector('canvas'), '3D scene did not mount');
  check(!visible('.board-concealed'), '2D opponent hands overlap the 3D scene');
  check(scene.handsGroup.children.length === 44, 'opponent handCount was ignored');
  const meshes = [...scene.handTileMeshes];
  for (let i = 0; i < 100; i++) scene.update(view, hand[i % hand.length].id);
  check(scene.handTileMeshes.every((mesh: unknown, i: number) => mesh === meshes[i]), 'selection rebuilt meshes');

  // The scene mounted while this player had no discard permission.
  scene.callbacks.onDiscardTile(hand[0].id);
  check(actions.length === 0, 'out-of-turn discard submitted');
  view = { ...view, sequence: 2, currentSeat: 0, availableActions: [{ kind: 'discard' }, { kind: 'hu' }] };
  render();
  await pause();
  check(visible('.action-hu'), '3D claim buttons are hidden');
  check(visible('.action-discard'), '3D discard button is hidden');
  scene.callbacks.onDiscardTile(hand[0].id);
  await pause();
  check(actions.length === 1 && actions[0].tileId === hand[0].id, 'callback used old permission or old selected tile');
  scene.callbacks.onDiscardTile('missing-tile');
  check(actions.length === 1, 'missing hand tile submitted');

  view = { ...view, sequence: 3, currentSeat: 1, availableActions: [] };
  render();
  await pause();
  scene.callbacks.onDiscardTile(hand[1].id);
  check(actions.length === 1, 'callback retained permission after turn ended');

  const retired = scene;
  const counts = new Map<string, number>();
  const originalRemove = window.removeEventListener;
  window.removeEventListener = function (type, ...args) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
    return originalRemove.call(this, type, ...args);
  };
  toggle();
  await pause();
  window.removeEventListener = originalRemove;
  check(!document.querySelector('canvas'), 'canvas leaked after switching to 2D');
  check(counts.get('resize'), 'resize listener was not released');
  check(retired.renderer.info.memory.geometries === 0, 'GPU geometries leaked');
  check(retired.renderer.getContext().isContextLost(), 'retired WebGL context was not released');
  check(visible('.board-own-hand'), '2D hand did not return');

  view = { ...view, sequence: 4, currentSeat: 0, availableActions: [{ kind: 'discard' }, { kind: 'hu' }] };
  render();
  await pause();
  toggle();
  await pause();
  check(scene !== retired && document.querySelectorAll('canvas').length === 1, 'scene did not remount cleanly');
  return { checks, selectionUpdates: 100, rebuiltHandMeshes: 0, retiredGpuGeometries: 0, retiredWebGLContextReleased: true };
}
Object.assign(window, { runTable3DChecks: run, showClassic: async () => { toggle(); await pause(); } });
