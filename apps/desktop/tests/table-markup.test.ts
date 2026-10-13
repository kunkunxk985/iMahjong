import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { makeTile, type ClientView } from '@pizhou/shared';
import { Table } from '../src/views/Table';

const hand = [1, 2, 3, 4].map((rank) => makeTile('wan', rank, 0));
const players = Array.from({ length: 4 }, (_, seat) => ({
  seat, nickname: `玩家${seat}`, avatar: '茶', ready: true, online: true,
  isHost: seat === 0, isDealer: seat === 0, closed: seat === 1, score: 0,
  handCount: seat === 0 ? hand.length : 13, discards: [makeTile('tong', seat + 1, 0)], melds: [],
  ...(seat === 0 ? { hand } : {}),
}));
const view: ClientView = {
  sequence: 1, roomCode: '123456', mySeat: 0, token: 'fixture', phase: 'playing',
  gamePhase: 'self-turn', dealer: 0, currentSeat: 0, wallCount: 60, pointRate: 2,
  turnDeadline: null, lastDiscard: null, players, availableActions: [{ kind: 'discard' }, { kind: 'close-gate', tileIds: [hand[0].id] }],
  settlement: null, hostSeat: 0, round: 1,
};
const variants = {
  full: { view, onAction() {}, onRules() {}, onSettings() {}, onLeave() {}, onOpenProfile() {}, networkStatus: 'connecting' as const },
  practice: { view: { ...view, currentSeat: 1, availableActions: [], gamePhase: 'claim-window' as const }, onAction() {}, practice: true, networkStatus: 'closed' as const },
};
for (const [name, props] of Object.entries(variants)) {
  test(`table ${name} preserves DOM, classes, text and inline styles`, (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 13, 8) });
    // Desktop-only layout effects intentionally do not execute in markup parity tests.
    const originalError = console.error;
    t.mock.method(console, 'error', (...args: unknown[]) => {
      if (String(args[0]).startsWith('Warning: useLayoutEffect does nothing on the server')) return;
      originalError(...args);
    });
    const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
    t.after(() => {
      if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    });
    const output = renderToStaticMarkup(React.createElement(Table, props));
    const path = new URL(`./fixtures/table-${name}.html`, import.meta.url);
    if (process.env.UPDATE_TABLE_SNAPSHOTS === '1') {
      mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true });
      writeFileSync(path, output);
    }
    else assert.equal(output, readFileSync(path, 'utf8'));
  });
}
