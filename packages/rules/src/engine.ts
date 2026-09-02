import {
  ACTION_TIMEOUT_MS,
  createPizhouDeck,
  shuffleTiles,
  sortTiles,
  type AvailableAction,
  type ClientView,
  DEFAULT_AVATAR,
  DEFAULT_TITLE,
  type GameAction,
  type GamePhase,
  type PublicPlayerView,
  sanitizeProfileTitle,
  type Settlement,
  type Tile,
  type WinType,
} from '@pizhou/shared';
import {
  ACTION_RANK,
  actionMatchesAvailable,
  ziGangActions,
  claimActions,
  concealedAnGangActions,
  isBetterAction,
  maxPossibleRank,
  selfTurnActions,
  takeTiles,
} from './actions.ts';
import { isSpecialBaoZhuangHu, settleChaHu, toSettlement, type SeatScoreInput } from './score.ts';
import { canHuTiles } from './win.ts';
import type { SeatRuntime } from './types.ts';

export interface PlayerMeta {
  nickname: string;
  avatar?: string;
  title?: string;
  ready: boolean;
  online: boolean;
  isHost: boolean;
  isBot?: boolean;
  score: number;
}

export interface ApplyResult {
  ok: boolean;
  duplicate?: boolean;
  error?: string;
  changed: boolean;
}

interface PendingCandidate {
  seat: number;
  actions: AvailableAction[];
}

interface PendingWindow {
  reason: 'discard' | 'qidong';
  tile: Tile;
  fromSeat: number;
  deadline: number;
  candidates: PendingCandidate[];
  responses: Map<number, GameAction>;
}

export interface EngineOptions {
  dealer?: number;
  wall?: Tile[];
  now?: () => number;
  rng?: () => number;
  timeoutMs?: number;
}

export class PizhouGame {
  readonly seats: [SeatRuntime, SeatRuntime, SeatRuntime, SeatRuntime];
  wall: Tile[];
  dealer: number;
  currentSeat: number;
  phase: GamePhase;
  sequence: number;
  lastDiscard: { tile: Tile; fromSeat: number } | null;
  pending: PendingWindow | null;
  settlement: Settlement | null;
  firstDiscardDone: boolean;
  hadOpeningKong: boolean;
  processedActionIds: Set<string>;
  turnDeadline: number;
  readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(options: EngineOptions = {}) {
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? ACTION_TIMEOUT_MS;
    this.dealer = options.dealer ?? 0;
    this.seats = [emptySeat(), emptySeat(), emptySeat(), emptySeat()];
    this.wall = options.wall ? options.wall.slice() : shuffleTiles(createPizhouDeck(), options.rng);
    this.currentSeat = this.dealer;
    this.phase = 'self-turn';
    this.sequence = 1;
    this.lastDiscard = null;
    this.pending = null;
    this.settlement = null;
    this.firstDiscardDone = false;
    this.hadOpeningKong = false;
    this.processedActionIds = new Set();
    this.turnDeadline = this.now() + this.timeoutMs;
    this.deal();
    this.openQidongWindow();
  }

  private openQidongWindow(): void {
    const candidates: PendingCandidate[] = [];
    for (let seat = 0; seat < 4; seat += 1) {
      if (concealedAnGangActions(this.seats[seat]!.hand).length === 0) continue;
      candidates.push({
        seat,
        actions: [
          { kind: 'hu', key: 'qidong-gang-hu' },
          { kind: 'pass' },
        ],
      });
    }
    if (candidates.length === 0) return;
    const firstSeat = candidates[0]!.seat;
    this.phase = 'qidong';
    this.pending = {
      reason: 'qidong',
      tile: this.seats[firstSeat]!.hand[0]!,
      fromSeat: this.dealer,
      deadline: this.now() + this.timeoutMs,
      candidates,
      responses: new Map(),
    };
    this.turnDeadline = this.pending.deadline;
  }

  private deal(): void {
    for (let round = 0; round < 13; round += 1) {
      for (let seat = 0; seat < 4; seat += 1) {
        const tile = this.wall.shift();
        if (!tile) throw new Error('牌墙不足');
        this.seats[seat]!.hand.push(tile);
      }
    }
    const extra = this.wall.shift();
    if (!extra) throw new Error('牌墙不足');
    this.seats[this.dealer]!.hand.push(extra);
    this.seats[this.dealer]!.lastDrawnId = extra.id;
    for (const seat of this.seats) {
      seat.hand = sortTiles(seat.hand);
    }
  }

  availableFor(seat: number): AvailableAction[] {
    if (this.phase === 'settlement') return [];
    if (this.phase === 'self-turn') {
      if (seat !== this.currentSeat) return [];
      return selfTurnActions(this.seats[seat]!);
    }
    if ((this.phase === 'claim-window' || this.phase === 'qidong') && this.pending) {
      if (this.pending.responses.has(seat)) return [];
      const candidate = this.pending.candidates.find((item) => item.seat === seat);
      return candidate?.actions ?? [];
    }
    return [];
  }

  apply(seat: number, action: GameAction, actionId: string, expectedSequence?: number): ApplyResult {
    if (this.processedActionIds.has(actionId)) {
      return { ok: true, duplicate: true, changed: false };
    }
    if (this.phase === 'settlement') {
      return { ok: false, error: '本局已结束', changed: false };
    }
    if (expectedSequence !== undefined && expectedSequence !== this.sequence) {
      return { ok: false, error: '操作已过期', changed: false };
    }
    const available = this.availableFor(seat);
    if (available.length === 0) {
      return { ok: false, error: '当前不能操作', changed: false };
    }
    if (!actionMatchesAvailable(action, available)) {
      return { ok: false, error: '非法操作', changed: false };
    }

    this.processedActionIds.add(actionId);
    if (this.phase === 'self-turn') {
      return this.applySelfTurn(seat, action);
    }
    return this.applyClaim(seat, action);
  }

  tick(now = this.now()): ApplyResult {
    if (this.phase === 'settlement') return { ok: true, changed: false };
    if (now < this.turnDeadline) return { ok: true, changed: false };
    if (this.phase === 'self-turn') {
      const seat = this.currentSeat;
      const auto = this.autoDiscardTile(seat);
      if (!auto) return { ok: false, error: '超时无法出牌', changed: false };
      return this.applySelfTurn(seat, { kind: 'discard', tileId: auto.id });
    }
    if ((this.phase === 'claim-window' || this.phase === 'qidong') && this.pending) {
      for (const candidate of this.pending.candidates) {
        if (!this.pending.responses.has(candidate.seat)) {
          this.pending.responses.set(candidate.seat, { kind: 'pass' });
        }
      }
      this.resolveClaims();
      return { ok: true, changed: true };
    }
    return { ok: true, changed: false };
  }

  getClientView(input: {
    mySeat: number;
    roomCode: string;
    token: string;
    hostSeat: number;
    metas: PlayerMeta[];
    round?: number;
    pointRate?: number;
  }): ClientView {
    const players = [0, 1, 2, 3].map((seat) => {
      const runtime = this.seats[seat]!;
      const meta = input.metas[seat]!;
      const winningTile = this.settlement?.winnerSeat === seat
        && !this.settlement.selfDraw
        && this.lastDiscard
        && this.lastDiscard.fromSeat !== seat
        && !runtime.hand.some((tile) => tile.id === this.lastDiscard!.tile.id)
        ? { ...this.lastDiscard.tile }
        : null;
      const revealedHand = [
        ...runtime.hand.map((tile) => ({ ...tile })),
        ...(winningTile ? [winningTile] : []),
      ];
      const publicView: PublicPlayerView = {
        seat,
        nickname: meta.nickname,
        avatar: meta.avatar ?? DEFAULT_AVATAR,
        title: sanitizeProfileTitle(meta.title, DEFAULT_TITLE),
        ready: meta.ready,
        online: meta.online,
        isHost: meta.isHost,
        isDealer: seat === this.dealer,
        isBot: meta.isBot,
        score: meta.score,
        closed: runtime.closed,
        handCount: this.settlement ? revealedHand.length : runtime.hand.length,
        discards: runtime.discards.map((tile) => ({ ...tile })),
        melds: runtime.melds.map((meld) => {
          const isSecret = meld.type === 'kan' || meld.type === 'an-gang' || meld.type === 'zi-gang';
          if (isSecret && seat !== input.mySeat && !this.settlement) {
            return {
              ...meld,
              tiles: meld.tiles.map((tile) => ({
                id: tile.id,
                suit: 'dragon' as const,
                rank: 0,
                copy: 0,
                key: 'back',
              })),
            };
          }
          return {
            ...meld,
            tiles: meld.tiles.map((tile) => ({ ...tile })),
          };
        }),
      };
      if (seat === input.mySeat || this.settlement) {
        return {
          ...publicView,
          hand: revealedHand,
          ...(seat === input.mySeat ? { lastDrawnId: runtime.lastDrawnId } : {}),
        };
      }
      return publicView;
    });

    return {
      sequence: this.sequence,
      roomCode: input.roomCode,
      mySeat: input.mySeat,
      token: input.token,
      phase: this.settlement ? 'settlement' : 'playing',
      gamePhase: this.phase,
      dealer: this.dealer,
      currentSeat: this.currentSeat,
      wallCount: this.wall.length,
      turnDeadline: this.phase === 'settlement' ? null : this.turnDeadline,
      lastDiscard: this.lastDiscard ? { tile: { ...this.lastDiscard.tile }, fromSeat: this.lastDiscard.fromSeat } : null,
      players,
      availableActions: this.availableFor(input.mySeat).map((action) => ({
        ...action,
        tiles: action.tiles?.map((tile) => ({ ...tile })),
        tileIds: action.tileIds?.slice(),
      })),
      settlement: this.settlement,
      hostSeat: input.hostSeat,
      round: input.round ?? 1,
      pointRate: input.pointRate,
    };
  }

  private bump(deadline = true): void {
    this.sequence += 1;
    if (deadline && this.phase !== 'settlement') {
      this.turnDeadline = this.now() + this.timeoutMs;
    }
  }

  private applySelfTurn(seat: number, action: GameAction): ApplyResult {
    if (seat !== this.currentSeat) {
      return { ok: false, error: '还没轮到你', changed: false };
    }
    const runtime = this.seats[seat]!;
    if (action.kind === 'discard') {
      if (!action.tileId) return { ok: false, error: '请选择要出的牌', changed: false };
      return this.discard(seat, action.tileId);
    }
    if (action.kind === 'hu') {
      return this.declareHu(seat, runtime.hand, true);
    }
    if (action.kind === 'close-gate') {
      return this.closeGate(seat, action.tileId);
    }
    if (action.kind === 'kan') {
      return this.declareKan(seat, action.key);
    }
    if (action.kind === 'an-gang') {
      return this.declareAnGang(seat, action.key);
    }
    if (action.kind === 'zi-gang') {
      return this.declareZiGang(seat, action.key, action.tileId);
    }
    return { ok: false, error: '当前不能这样操作', changed: false };
  }

  private applyClaim(seat: number, action: GameAction): ApplyResult {
    if (!this.pending) return { ok: false, error: '没有待响应的牌', changed: false };
    if (this.pending.responses.has(seat)) {
      return { ok: false, error: '已经响应过了', changed: false };
    }
    this.pending.responses.set(seat, action);
    if (this.canResolveClaims()) {
      this.resolveClaims();
    }
    return { ok: true, changed: true };
  }

  private discard(seat: number, tileId: string): ApplyResult {
    const runtime = this.seats[seat]!;
    const index = runtime.hand.findIndex((tile) => tile.id === tileId);
    if (index < 0) return { ok: false, error: '手牌中没有这张牌', changed: false };
    const [tile] = runtime.hand.splice(index, 1);
    if (!tile) return { ok: false, error: '出牌失败', changed: false };
    runtime.discards.push(tile);
    runtime.lastDrawnId = undefined;
    runtime.hand = sortTiles(runtime.hand);
    if (!runtime.firstDiscardKey) runtime.firstDiscardKey = tile.key;
    this.refreshTwoPairClose(runtime);
    this.refreshWaitFlags(runtime);
    this.lastDiscard = { tile, fromSeat: seat };
    this.firstDiscardDone = true;
    if (this.isFourSameOpening()) {
      this.recordResolvedDiscard(tile);
      return this.finishDraw(true, 'four_same');
    }
    const candidates = this.buildClaimCandidates(tile, seat);
    if (candidates.length === 0) {
      this.recordResolvedDiscard(tile);
      return this.advanceDraw((seat + 1) % 4);
    }
    this.pending = {
      reason: 'discard',
      tile,
      fromSeat: seat,
      deadline: this.now() + this.timeoutMs,
      candidates,
      responses: new Map(),
    };
    this.phase = 'claim-window';
    this.bump();
    return { ok: true, changed: true };
  }

  private declareAnGang(seat: number, key?: string): ApplyResult {
    if (!key) return { ok: false, error: '请选择暗杠', changed: false };
    if (this.wall.length === 0) return { ok: false, error: '牌墙已空，不能杠', changed: false };
    const runtime = this.seats[seat]!;
    const copies = runtime.hand.filter((tile) => tile.key === key);
    if (copies.length < 4) return { ok: false, error: '暗杠需要四张相同牌', changed: false };
    const used = copies.slice(0, 4);
    const usedIds = new Set(used.map((tile) => tile.id));
    runtime.hand = runtime.hand.filter((tile) => !usedIds.has(tile.id));
    runtime.melds.push({ type: 'an-gang', tiles: used });
    runtime.changed = true;
    if (!this.firstDiscardDone) this.hadOpeningKong = true;
    return this.drawReplacement(seat);
  }

  private declareKan(seat: number, key?: string): ApplyResult {
    if (!key) return { ok: false, error: '请选择要坎上的牌', changed: false };
    const runtime = this.seats[seat]!;
    const copies = runtime.hand.filter((tile) => tile.key === key).slice(0, 3);
    if (copies.length < 3) return { ok: false, error: '坎上需要手里三张相同牌', changed: false };
    const usedIds = new Set(copies.map((tile) => tile.id));
    runtime.hand = runtime.hand.filter((tile) => !usedIds.has(tile.id));
    runtime.melds.push({ type: 'kan', tiles: copies });
    if (runtime.lastDrawnId && usedIds.has(runtime.lastDrawnId)) runtime.lastDrawnId = undefined;
    runtime.hand = sortTiles(runtime.hand);
    this.bump();
    return { ok: true, changed: true };
  }

  private declareZiGang(seat: number, key?: string, tileId?: string): ApplyResult {
    if (this.wall.length === 0) return { ok: false, error: '牌墙已空，不能杠', changed: false };
    const runtime = this.seats[seat]!;
    const kanIndex = runtime.melds.findIndex((meld) => meld.type === 'kan' && meld.tiles[0]?.key === key);
    if (kanIndex < 0) return { ok: false, error: '只有坎上的牌可以自杠', changed: false };
    const extra = runtime.hand.find((tile) => tile.id === tileId || tile.key === key);
    if (!extra) return { ok: false, error: '手牌中没有自杠的第四张牌', changed: false };
    const extraIndex = runtime.hand.findIndex((tile) => tile.id === extra.id);
    if (extraIndex < 0) return { ok: false, error: '自杠失败', changed: false };
    const usedExtra = runtime.hand.splice(extraIndex, 1)[0]!;
    const kan = runtime.melds[kanIndex]!;
    runtime.melds[kanIndex] = { type: 'zi-gang', tiles: [...kan.tiles, usedExtra] };
    runtime.changed = true;
    return this.drawReplacement(seat);
  }

  private drawReplacement(seat: number): ApplyResult {
    const tile = this.wall.pop();
    if (!tile) return this.finishDraw(true);
    const runtime = this.seats[seat]!;
    runtime.hand.push(tile);
    runtime.lastDrawnId = tile.id;
    runtime.hand = sortTiles(runtime.hand);
    this.currentSeat = seat;
    this.phase = 'self-turn';
    this.pending = null;
    this.bump();
    return { ok: true, changed: true };
  }

  private advanceDraw(seat: number): ApplyResult {
    const tile = this.wall.shift();
    if (!tile) return this.finishDraw(true);
    const runtime = this.seats[seat]!;
    runtime.hand.push(tile);
    runtime.lastDrawnId = tile.id;
    runtime.hand = sortTiles(runtime.hand);
    this.currentSeat = seat;
    this.phase = 'self-turn';
    this.pending = null;
    this.bump();
    return { ok: true, changed: true };
  }

  private buildClaimCandidates(tile: Tile, fromSeat: number): PendingCandidate[] {
    const candidates: PendingCandidate[] = [];
    for (let seat = 0; seat < 4; seat += 1) {
      if (seat === fromSeat) continue;
      const actions = claimActions({
        seat: this.seats[seat]!,
        discard: tile,
        fromSeat,
        claimerSeat: seat,
      });
      const playable = actions.filter((item) => item.kind !== 'pass');
      if (playable.length > 0) {
        candidates.push({ seat, actions });
      }
    }
    return candidates;
  }

  private canResolveClaims(): boolean {
    if (!this.pending) return true;
    const responded = [...this.pending.responses.entries()]
      .filter(([, action]) => action.kind !== 'pass')
      .map(([seat, action]) => ({ seat, action }));
    const waiting = this.pending.candidates.filter((item) => !this.pending!.responses.has(item.seat));
    if (responded.length === 0) return waiting.length === 0;
    const best = this.pickBest(responded);
    if (!best) return waiting.length === 0;
    return !waiting.some((item) => {
      const maxRank = maxPossibleRank(item.actions);
      const bestRank = ACTION_RANK[best.action.kind] ?? 0;
      if (maxRank > bestRank) return true;
      if (maxRank === bestRank && isBetterAction({ seat: item.seat, action: { kind: item.actions[0]?.kind ?? 'pass' } }, best, this.pending!.fromSeat)) {
        return true;
      }
      if (maxRank === bestRank) {
        const fake = { seat: item.seat, action: { kind: item.actions.find((a) => (ACTION_RANK[a.kind] ?? 0) === maxRank)?.kind ?? 'pass' } };
        return isBetterAction(fake, best, this.pending!.fromSeat);
      }
      return false;
    });
  }

  private pickBest(responded: Array<{ seat: number; action: GameAction }>): { seat: number; action: GameAction } | null {
    if (!this.pending || responded.length === 0) return null;
    return responded.reduce((best, item) => (isBetterAction(item, best, this.pending!.fromSeat) ? item : best));
  }

  private resolveClaims(): void {
    if (!this.pending) return;
    const responded = [...this.pending.responses.entries()]
      .filter(([, action]) => action.kind !== 'pass')
      .map(([seat, action]) => ({ seat, action }));
    const best = this.pickBest(responded);
    const pending = this.pending;
    this.pending = null;
    if (pending.reason === 'qidong') {
      if (best?.action.kind === 'hu') {
        this.declareQidongHu(best.seat);
        return;
      }
      this.phase = 'self-turn';
      this.currentSeat = this.dealer;
      this.bump();
      return;
    }
    if (!best) {
      this.recordResolvedDiscard(pending.tile);
      this.advanceDraw((pending.fromSeat + 1) % 4);
      return;
    }
    if (best.action.kind === 'hu') {
      const winner = this.seats[best.seat]!;
      this.declareHu(best.seat, [...winner.hand, pending.tile], false, pending.tile);
      return;
    }
    this.recordResolvedDiscard(pending.tile);
    this.takeDiscard(pending);
    if (best.action.kind === 'ming-gang') {
      this.applyMingGang(best.seat, pending.tile);
      return;
    }
    if (best.action.kind === 'peng') {
      this.applyPeng(best.seat, pending.tile);
      return;
    }
    if (best.action.kind === 'chi') {
      this.applyChi(best.seat, pending.tile, best.action.tileIds ?? []);
    }
  }

  private takeDiscard(pending: PendingWindow): void {
    const from = this.seats[pending.fromSeat]!;
    const last = from.discards[from.discards.length - 1];
    if (last && last.id === pending.tile.id) {
      from.discards.pop();
    }
    this.lastDiscard = null;
  }

  /**
   * 只有一张弃牌确定没有直接导致胡牌后，才把它写入香/臭牌历史。
   * 否则“刚打出的生张”会先被误记成臭牌，闯香包庄将永远无法成立。
   */
  private recordResolvedDiscard(tile: Tile): void {
    for (const target of this.seats) {
      // “香/臭”只看该玩家报两对关门之前的牌河。关门完成后，
      // 后续才落地的牌不能追溯改变这位玩家已经锁定的牌河快照。
      if (target.closedTwoPair) continue;
      if (!target.discardedBeforeClose.includes(tile.key)) {
        target.discardedBeforeClose.push(tile.key);
      }
    }
  }

  private applyPeng(seat: number, tile: Tile): void {
    const runtime = this.seats[seat]!;
    const copies = runtime.hand.filter((item) => item.key === tile.key).slice(0, 2);
    const taken = takeTiles(runtime.hand, copies.map((item) => item.id));
    if (!taken) return;
    runtime.hand = sortTiles(taken.rest);
    runtime.melds.push({ type: 'peng', tiles: [...taken.taken, tile], fromSeat: this.currentSeat, claimedTileId: tile.id });
    runtime.changed = true;
    runtime.lastDrawnId = undefined;
    this.currentSeat = seat;
    this.phase = 'self-turn';
    this.bump();
  }

  private applyMingGang(seat: number, tile: Tile): void {
    const runtime = this.seats[seat]!;
    const kanIndex = runtime.melds.findIndex((meld) => meld.type === 'kan' && meld.tiles[0]?.key === tile.key);
    if (kanIndex >= 0) {
      const kan = runtime.melds[kanIndex]!;
      runtime.melds[kanIndex] = { type: 'ming-gang', tiles: [...kan.tiles, tile], fromSeat: this.currentSeat, claimedTileId: tile.id };
      runtime.changed = true;
      this.drawReplacement(seat);
      return;
    }
    const copies = runtime.hand.filter((item) => item.key === tile.key).slice(0, 3);
    const taken = takeTiles(runtime.hand, copies.map((item) => item.id));
    if (!taken) return;
    runtime.hand = taken.rest;
    runtime.melds.push({ type: 'ming-gang', tiles: [...taken.taken, tile], fromSeat: this.currentSeat, claimedTileId: tile.id });
    runtime.changed = true;
    this.drawReplacement(seat);
  }

  private applyChi(seat: number, tile: Tile, tileIds: string[]): void {
    const runtime = this.seats[seat]!;
    const taken = takeTiles(runtime.hand, tileIds);
    if (!taken) return;
    runtime.hand = sortTiles(taken.rest);
    runtime.melds.push({
      type: 'chi',
      tiles: sortTiles([...taken.taken, tile]),
      fromSeat: this.currentSeat,
      claimedTileId: tile.id,
    });
    runtime.changed = true;
    runtime.lastDrawnId = undefined;
    this.currentSeat = seat;
    this.phase = 'self-turn';
    this.bump();
  }

  private declareQidongHu(seat: number): ApplyResult {
    return this.finishWin(seat, this.seats[seat]!.hand, 'qidong-gang-hu', true);
  }

  private declareHu(seat: number, concealed: Tile[], selfDraw: boolean, claimedTile?: Tile): ApplyResult {
    const runtime = this.seats[seat]!;
    const specialBaoZhuangHu = !selfDraw && claimedTile
      ? isSpecialBaoZhuangHu({
          hand: concealed,
          exposed: runtime.melds,
          ron: true,
          discardKey: claimedTile.key,
          singleWaitChanged: runtime.singleWaitChanged,
          closedTwoPair: runtime.closedTwoPair,
          discardedBeforeClose: runtime.discardedBeforeClose,
        })
      : false;
    if (!canHuTiles(concealed, runtime.melds.length) && !specialBaoZhuangHu) {
      return { ok: false, error: '还不能胡牌', changed: false };
    }
    const winType: WinType = !this.firstDiscardDone && this.hadOpeningKong ? 'qidong-gang-hu' : 'ping-hu';

    if (!selfDraw && claimedTile) {
      const fromSeat = this.lastDiscard?.fromSeat ?? this.pending?.fromSeat;
      if (fromSeat !== undefined) {
        const from = this.seats[fromSeat]!;
        const last = from.discards[from.discards.length - 1];
        if (last && last.id === claimedTile.id) from.discards.pop();
      }
    }

    return this.finishWin(seat, concealed, winType, selfDraw, claimedTile);
  }

  private closeGate(seat: number, discardTileId?: string): ApplyResult {
    const runtime = this.seats[seat]!;
    if (runtime.closedTwoPair) {
      return { ok: false, error: '本局已经关门', changed: false };
    }
    if (runtime.melds.length !== 3 || runtime.melds.some((meld) => meld.type === 'chi')) {
      return { ok: false, error: '需要先有三组碰、坎或杠才能关门', changed: false };
    }
    const counts: Record<string, number> = {};
    for (const tile of runtime.hand) counts[tile.key] = (counts[tile.key] ?? 0) + 1;
    const alreadyTwoPairs = runtime.hand.length === 4 && Object.values(counts).filter((n) => n === 2).length === 2;

    if (!alreadyTwoPairs) {
      if (!discardTileId) return { ok: false, error: '请先选择关门时要出的牌', changed: false };
      const gateDiscard = runtime.hand.find((tile) => tile.id === discardTileId);
      const remaining = runtime.hand.filter((tile) => tile.id !== discardTileId);
      const remainingCounts: Record<string, number> = {};
      for (const tile of remaining) remainingCounts[tile.key] = (remainingCounts[tile.key] ?? 0) + 1;
      const leavesTwoPairs = remaining.length === 4 && Object.values(remainingCounts).filter((n) => n === 2).length === 2;
      if (!leavesTwoPairs) return { ok: false, error: '打出这张后不是两对，不能关门', changed: false };

      const discarded = this.discard(seat, discardTileId);
      if (!discarded.ok) return discarded;
      // 用户确认：宣布两对关门这一手打出的牌，对关门者自己也算臭牌。
      if (gateDiscard && !runtime.discardedBeforeClose.includes(gateDiscard.key)) {
        runtime.discardedBeforeClose.push(gateDiscard.key);
      }
      runtime.closed = true;
      runtime.closedTwoPair = true;
      runtime.closedTwoPairKeys = this.twoPairKeys(runtime.hand);
      return discarded;
    }

    runtime.closed = true;
    runtime.closedTwoPair = true;
    runtime.closedTwoPairKeys = this.twoPairKeys(runtime.hand);
    this.bump();
    return { ok: true, changed: true };
  }

  private twoPairKeys(hand: Tile[]): string[] {
    const counts: Record<string, number> = {};
    for (const tile of hand) counts[tile.key] = (counts[tile.key] ?? 0) + 1;
    return Object.entries(counts)
      .filter(([, count]) => count === 2)
      .map(([key]) => key)
      .sort();
  }

  private refreshTwoPairClose(seat: SeatRuntime): void {
    if (!seat.closedTwoPair) return;
    const currentKeys = this.twoPairKeys(seat.hand);
    const unchanged = currentKeys.length === 2
      && currentKeys.every((key, index) => key === seat.closedTwoPairKeys[index]);
    if (unchanged) return;
    seat.closed = false;
    seat.closedTwoPair = false;
    seat.closedTwoPairKeys = [];
  }

  private refreshWaitFlags(seat: SeatRuntime): void {
    if (seat.melds.length === 4 && seat.hand.length === 1) {
      const key = seat.hand[0]!.key;
      if (!seat.waitKey) {
        seat.waitKey = key;
        seat.closed = true;
        seat.singleWaitChanged = false;
      } else if (seat.waitKey !== key) {
        // 仍可继续单钓，但已不满足公开规则中包庄要求的“不换张”。
        seat.waitKey = key;
        seat.singleWaitChanged = true;
      }
      return;
    }
    if (seat.closedTwoPair) {
      seat.closed = true;
      return;
    }
    // 既不是4组单钓也不是两对关门，重置关门状态
    seat.closed = false;
    if (seat.waitKey) seat.changed = true;
  }

  private isFourSameOpening(): boolean {
    const firsts = this.seats.map((item) => item.firstDiscardKey);
    return firsts.every(Boolean) && new Set(firsts).size === 1;
  }

  private seatPayload(
    winnerSeat: number | null,
    winnerHand?: Tile[],
    winningDiscardId?: string,
    winningTileId?: string,
  ): SeatScoreInput[] {
    return this.seats.map((seat, index) => ({
      hand: index === winnerSeat && winnerHand ? winnerHand : seat.hand,
      exposed: seat.melds,
      winningDiscardId: index === winnerSeat ? winningDiscardId : undefined,
      winningTileId: index === winnerSeat ? winningTileId : undefined,
      changed: seat.changed,
      singleWaitChanged: seat.singleWaitChanged,
      closedTwoPair: seat.closedTwoPair,
      discardedBeforeClose: seat.discardedBeforeClose.slice(),
    }));
  }

  private finishWin(seat: number, concealed: Tile[], winType: WinType, selfDraw: boolean, claimedTile?: Tile): ApplyResult {
    const winningDiscardId = selfDraw ? undefined : (claimedTile?.id ?? this.lastDiscard?.tile.id);
    const winningTileId = selfDraw ? this.seats[seat]!.lastDrawnId : undefined;
    const discardKey = selfDraw ? null : (claimedTile?.key ?? this.lastDiscard?.tile.key ?? concealed[concealed.length - 1]?.key);
    const discarderSeat = selfDraw ? null : (this.lastDiscard?.fromSeat ?? this.pending?.fromSeat ?? null);

    const result = settleChaHu({
      seats: this.seatPayload(seat, concealed, winningDiscardId, winningTileId),
      winnerSeat: seat,
      dealer: this.dealer,
      ron: !selfDraw,
      discardKey,
      discarderSeat,
      openingGang: winType === 'qidong-gang-hu',
      winType,
    });
    this.settlement = toSettlement(result, { winType, selfDraw });
    this.phase = 'settlement';
    this.pending = null;
    this.bump(false);
    return { ok: true, changed: true };
  }

  private finishDraw(liuju: boolean, reason = 'wall'): ApplyResult {
    if (!liuju) return { ok: true, changed: false };
    const result = settleChaHu({
      seats: this.seatPayload(null),
      winnerSeat: null,
      dealer: this.dealer,
      drawReason: reason,
    });
    this.settlement = toSettlement(result, { winType: 'liuju', selfDraw: false });
    this.phase = 'settlement';
    this.pending = null;
    this.bump(false);
    return { ok: true, changed: true };
  }

  private autoDiscardTile(seat: number): Tile | null {
    const runtime = this.seats[seat]!;
    if (runtime.lastDrawnId) {
      const drawn = runtime.hand.find((tile) => tile.id === runtime.lastDrawnId);
      if (drawn) return drawn;
    }
    return runtime.hand[runtime.hand.length - 1] ?? null;
  }
}

function emptySeat(): SeatRuntime {
  return {
    hand: [],
    discards: [],
    melds: [],
    changed: false,
    closed: false,
    closedTwoPair: false,
    closedTwoPairKeys: [],
    discardedBeforeClose: [],
    singleWaitChanged: false,
  };
}

export function legalZiGangKeys(seat: SeatRuntime): string[] {
  return ziGangActions(seat).map((action) => action.key!).filter(Boolean);
}
