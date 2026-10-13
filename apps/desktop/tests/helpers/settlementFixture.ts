import type { ClientView, PairwiseTransaction, Settlement } from '@pizhou/shared';

export function settlementFixture(kind = 'bao', pointRate = 0.2) {
  const scores = [120, -110, -10, 0].map((delta, seat) => ({
    seat, nickname: ['胡家', '包庄家', '西家', '北家'][seat], hu: 8 - seat,
    yao: seat, fen: 8, delta, total: 200 + delta, receivable: seat === 1 ? 10 : Math.max(0, delta),
    payable: seat === 1 ? 120 : Math.max(0, -delta), isDealer: seat === 1,
    isWinner: seat === 0, piaoHun: seat === 0,
  }));
  const tile = { id: 'winning-tile', suit: 'wan', rank: 3, key: 'wan-3' } as const;
  const transactions = [12, -4, 0].map((points, index) => ({
    seatA: 0, seatB: index + 1, huA: 8, huB: 5, yaoA: 0, yaoB: 1,
    isDealerPair: index === 0, points,
    ...(index === 0 ? { rawDeltaHu: 3, piaoMultiplier: 2, dealerMultiplier: 2, deltaYao: -1 } : {}),
  })) as PairwiseTransaction[];
  const settlement: Settlement = {
    liuju: kind === 'draw', winnerSeat: kind === 'draw' ? null : 0,
    winnerNickname: kind === 'draw' ? null : '胡家', winType: kind === 'draw' ? 'liuju' : 'ping-hu',
    hu: 8, huBeforeDealer: 8, yao: 0, dealerMultiplier: 1, selfDraw: kind === 'self',
    breakdown: [{ label: '基本胡', hu: 8, yao: 1 }], scores, transactions,
    hunDi: kind === 'bao', baoZhuang: kind === 'bao' ? { reason: 'xiang', payerSeat: 1, winnerSeat: 0 } : null,
    drawReason: kind === 'draw' ? 'wall' : null,
  };
  const view: ClientView = {
    sequence: 1, roomCode: '123456', mySeat: 0, token: '', phase: 'settlement',
    gamePhase: null, dealer: 1, currentSeat: null, wallCount: 0, turnDeadline: null,
    lastDiscard: { tile, fromSeat: 1 }, availableActions: [], settlement, hostSeat: 0, round: 7, pointRate,
    players: scores.map((score) => ({
      seat: score.seat, nickname: score.nickname, avatar: '🀄', title: '雀友',
      ready: false, online: true, isHost: score.seat === 0, isDealer: !!score.isDealer,
      closed: score.seat === 0, score: score.total, handCount: 1,
      discards: [tile], melds: [], ...(score.seat === 3 ? {} : { hand: [tile] }),
    })),
  };
  return { view, settlement };
}
