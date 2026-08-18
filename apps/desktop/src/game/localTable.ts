import { newActionId, type ClientView, type GameAction, type Settlement } from '@pizhou/shared';
import { nextDealer, PizhouGame, type PlayerMeta } from '@pizhou/rules';

const BOT_NAMES = ['陪练·南', '陪练·西', '陪练·北'];

export class LocalTable {
  private game: PizhouGame | null = null;
  private nickname = '玩家';
  private scores = [0, 0, 0, 0];
  private dealer = 0;
  private round = 0;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private onChange: (view: ClientView) => void;

  constructor(onChange: (view: ClientView) => void) {
    this.onChange = onChange;
  }

  start(nickname: string): void {
    this.nickname = nickname.trim() || '玩家';
    this.scores = [0, 0, 0, 0];
    this.dealer = 0;
    this.round = 0;
    this.nextHand();
  }

  again(): void {
    if (!this.game?.settlement) return;
    this.dealer = nextDealer(
      this.dealer,
      this.game.settlement.winnerSeat,
      this.game.settlement.liuju,
      this.game.settlement.drawReason,
    );
    this.nextHand();
  }

  leave(): void {
    this.clearTimers();
    this.game = null;
  }

  dispose(): void {
    this.clearTimers();
  }

  act(action: GameAction): string | null {
    if (!this.game) return '还没开始';
    const result = this.game.apply(0, action, newActionId(), this.game.sequence);
    if (result.duplicate) return null;
    if (!result.ok) return result.error ?? '操作失败';
    this.afterChange();
    return null;
  }

  view(): ClientView | null {
    if (!this.game) return null;
    return this.game.getClientView({
      mySeat: 0,
      roomCode: '单机',
      token: 'local',
      hostSeat: 0,
      round: this.round,
      metas: this.metas(),
    });
  }

  private nextHand(): void {
    this.round += 1;
    this.game = new PizhouGame({ dealer: this.dealer });
    this.startTick();
    this.afterChange();
  }

  private metas(): PlayerMeta[] {
    const names = [this.nickname, ...BOT_NAMES];
    return [0, 1, 2, 3].map((seat) => ({
      nickname: names[seat]!,
      ready: true,
      online: true,
      isHost: seat === 0,
      isBot: seat !== 0,
      score: this.scores[seat] ?? 0,
    }));
  }

  private afterChange(): void {
    if (this.game?.settlement) {
      this.applyScores();
      this.clearTimers();
    } else {
      this.scheduleBots();
    }
    const view = this.view();
    if (view) this.onChange(view);
  }

  private applyScores(): void {
    const settlement = this.game?.settlement;
    if (!settlement) return;
    const names = [this.nickname, ...BOT_NAMES];
    for (const item of settlement.scores) {
      this.scores[item.seat] = (this.scores[item.seat] ?? 0) + item.delta;
      item.nickname = names[item.seat] ?? '';
      item.total = this.scores[item.seat] ?? 0;
    }
    if (settlement.winnerSeat !== null) {
      settlement.winnerNickname = names[settlement.winnerSeat] ?? null;
    }
  }

  private startTick(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => {
      if (!this.game || this.game.phase === 'settlement') return;
      const result = this.game.tick();
      if (result.changed) this.afterChange();
    }, 400);
  }

  private scheduleBots(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    if (!this.game || this.game.phase === 'settlement') return;
    this.botTimer = setTimeout(() => this.stepBots(), 520);
  }

  private stepBots(): void {
    if (!this.game || this.game.phase === 'settlement') return;
    for (const seat of [1, 2, 3]) {
      const action = this.chooseBot(seat);
      if (!action) continue;
      const result = this.game.apply(seat, action, `bot-${Date.now()}-${seat}`, this.game.sequence);
      if (!result.ok && !result.duplicate) continue;
      this.afterChange();
      return;
    }
  }

  private chooseBot(seat: number): GameAction | null {
    if (!this.game) return null;
    const actions = this.game.availableFor(seat);
    if (actions.length === 0) return null;
    const hu = actions.find((item) => item.kind === 'hu');
    if (hu?.key === 'qidong-gang-hu') {
      return actions.some((item) => item.kind === 'pass') ? { kind: 'pass' } : { kind: 'hu', key: 'qidong-gang-hu' };
    }
    if (hu) return { kind: 'hu' };
    if (actions.some((item) => item.kind === 'discard')) {
      const runtime = this.game.seats[seat]!;
      const tile =
        runtime.hand.find((item) => item.id === runtime.lastDrawnId) ?? runtime.hand[runtime.hand.length - 1];
      if (tile) return { kind: 'discard', tileId: tile.id };
    }
    if (actions.some((item) => item.kind === 'pass')) return { kind: 'pass' };
    return null;
  }

  private clearTimers(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.botTimer = null;
    this.tickTimer = null;
  }
}

export function emptySettlementReady(settlement: Settlement | null): number {
  return settlement ? 4 : 0;
}
