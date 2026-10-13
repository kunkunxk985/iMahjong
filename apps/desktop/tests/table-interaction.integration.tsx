import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { makeTile, type ClientView, type GameAction } from '@pizhou/shared';
import { Table } from '../src/views/Table';
import '../src/styles.css';

const root = createRoot(document.getElementById('root')!);
const hand = [1, 2, 3, 4].map((rank) => makeTile('wan', rank, 0));
const players = Array.from({ length: 4 }, (_, seat) => ({
  seat, nickname: `玩家${seat}`, avatar: '茶', ready: true, online: true,
  isHost: seat === 0, isDealer: seat === 0, closed: false, score: 0,
  handCount: seat === 0 ? hand.length : 13, discards: [], melds: [],
  ...(seat === 0 ? { hand } : {}),
}));
let view: ClientView = {
  sequence: 1, roomCode: '123456', mySeat: 0, token: 'fixture', phase: 'playing',
  gamePhase: 'self-turn', dealer: 0, currentSeat: 0, wallCount: 60,
  turnDeadline: null, lastDiscard: null, players, availableActions: [{ kind: 'discard' }, { kind: 'hu' }],
  settlement: null, hostSeat: 0, round: 1,
};
const actions: GameAction[] = [];
const pause = () => new Promise((resolve) => setTimeout(resolve, 50));
const render = async () => {
  flushSync(() => root.render(<Table view={view} onAction={(action) => actions.push(action)} />));
  await pause();
};
const press = async (key: string, options: KeyboardEventInit = {}, target: EventTarget = window) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  await pause();
  return event;
};
const selected = () => document.querySelector('.board-own-hand .tile.selected')?.getAttribute('data-tile-id');
let checks = 0;
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  checks++;
}
async function run() {
  localStorage.setItem('pizhou_render_mode', '2d');
  await render();
  check(!document.querySelector('canvas'), '2D mount eagerly created a 3D scene');
  await press('1');
  check(selected() === hand[0].id, 'numeric shortcut did not select first tile');
  await press('ArrowLeft');
  check(selected() === hand.at(-1)!.id, 'left navigation did not wrap');
  await press('ArrowRight');
  check(selected() === hand[0].id, 'right navigation did not wrap');
  await press('Escape');
  check(!selected(), 'Escape did not clear selection');
  const space = await press(' ');
  check(space.defaultPrevented && actions.length === 0, 'space without selection fell through to hu');
  await press('1', { ctrlKey: true });
  check(!selected(), 'modified shortcut selected a tile');
  const input = document.createElement('input');
  document.body.append(input);
  await press('1', {}, input);
  check(!selected(), 'input shortcut selected a tile');
  input.remove();
  await press('2');
  await press('Enter');
  check(actions.length === 1 && actions[0].kind === 'discard' && actions[0].tileId === hand[1].id, 'Enter did not discard selection');
  await press(' ');
  check(actions.length === 1, 'second confirm auto-submitted hu');
  await press('1');
  view = { ...view, sequence: 2, players: players.map((p) => p.seat === 0 ? { ...p, hand: hand.slice(1) } : p) };
  await render();
  check(!selected() && (document.querySelector('.action-discard') as HTMLButtonElement).disabled, 'removed tile left a dangling selection');
  view = { ...view, sequence: 3, availableActions: [{ kind: 'close-gate', tileIds: [hand[1].id, hand[2].id] }, { kind: 'pass' }] };
  await render();
  await press('2');
  await press('Enter');
  check(actions.at(-1)?.kind === 'close-gate' && actions.at(-1)?.tileId === hand[2].id, 'keyboard close-gate did not use selected candidate');
  await press('Escape');
  await press('Enter');
  check(actions.at(-1)?.tileId === hand[1].id, 'close-gate did not fall back to first candidate');
  await press('Escape');
  check(actions.at(-1)?.kind === 'pass', 'Escape did not pass without selection');
  view = { ...view, sequence: 4, availableActions: [{ kind: 'peng' }, { kind: 'chi' }, { kind: 'pass' }] };
  await render();
  const before = actions.length;
  await press('Enter');
  check(actions.length === before, 'ambiguous claims were auto-picked');
  view = { ...view, sequence: 5, availableActions: [{ kind: 'peng' }, { kind: 'hu' }] };
  await render();
  await press('Enter');
  check(actions.at(-1)?.kind === 'hu', 'explicit confirm did not retain hu priority');
  view = { ...view, sequence: 6, availableActions: [{ kind: 'discard' }], players: players.map((p) => p.seat === 0 ? { ...p, lastDrawnId: hand[3].id } : p) };
  await render();
  check(selected() === hand[3].id, 'drawn tile selection changed');
  check(document.querySelector(`[data-tile-id="${hand[3].id}"]`)?.classList.contains('entering'), 'new draw lost entering animation');
  await new Promise((resolve) => setTimeout(resolve, 240));
  check(!document.querySelector(`[data-tile-id="${hand[3].id}"]`)?.classList.contains('entering'), 'entering class did not expire');
  await press('1');
  await press('Enter');
  view = { ...view, sequence: 7, players: players.map((p) => p.seat === 0 ? { ...p, hand: hand.slice(1), discards: [hand[0]] } : p), lastDiscard: { tile: hand[0], fromSeat: 0 }, availableActions: [] };
  await render();
  check(Boolean(document.querySelector('.discard-flight')), 'accepted local discard did not animate');
  await new Promise((resolve) => setTimeout(resolve, 800));
  check(!document.querySelector('.discard-flight'), 'discard flight did not finish');
  const opponentTile = makeTile('tong', 5, 0);
  view = { ...view, sequence: 8, players: view.players.map((p) => p.seat === 1 ? { ...p, discards: [opponentTile] } : p), lastDiscard: { tile: opponentTile, fromSeat: 1 } };
  await render();
  check(Boolean(document.querySelector('.discard-flight')), 'new opponent discard did not animate');
  await new Promise((resolve) => setTimeout(resolve, 800));
  view = { ...view, sequence: 9 };
  await render();
  check(!document.querySelector('.discard-flight'), 'unchanged opponent discard replayed on a sequence bump');
  root.unmount();
  await press('1');
  check(actions.length === before + 2, 'unmounted keyboard listener submitted an action');
  return { checks, submittedActions: actions.length };
}
Object.assign(window, { runTableInteractionChecks: run });
