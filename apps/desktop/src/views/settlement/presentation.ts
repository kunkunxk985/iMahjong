import { isPrivatePlayerView, type BaoZhuangReason, type ClientView, type PairwiseTransaction, type Settlement } from '@pizhou/shared';

export const SEAT_NAMES = ['东', '南', '西', '北'] as const;

export const WIN_LABEL: Record<string, string> = {
  'ping-hu': '平胡',
  'qidong-gang-hu': '起手杠胡',
  liuju: '流局',
};

export const BAO_LABEL: Record<BaoZhuangReason, string> = {
  four_wait_seq: '四组听顺包庄',
  chow_wait_seq: '吃牌听顺包庄',
  xiang: '香牌包庄',
};

export const BAO_EXPLANATION: Record<BaoZhuangReason, string> = {
  four_wait_seq: '胡家已有四组碰、坎或杠，单张听牌且始终未换张；该点炮牌与手中单张能相连成顺，本局按飘荤结算。',
  chow_wait_seq: '胡家已有四组牌且其中含吃，单张听牌且始终未换张；该点炮牌与手中单张能相连成顺，本局按普通胡结算。',
  xiang: '胡家已有三组碰、坎或杠，手里保留两对但尚未选择两对关门；该点炮牌此前全桌从未打出，属于香牌，由点炮者按飘荤包庄。',
};

export const DRAW_LABEL: Record<string, string> = {
  four_same: '开局四同张流局',
  wall: '牌墙摸完流局',
};

export function getNickname(settlement: Settlement, seat: number) {
  const found = settlement.scores.find((s) => s.seat === seat);
  return found?.nickname || `${SEAT_NAMES[seat]}家`;
}

export function isDealer(settlement: Settlement, seat: number) {
  const found = settlement.scores.find((s) => s.seat === seat);
  return Boolean(found?.isDealer);
}

export function getSettlementPresentation(view: ClientView, settlement: Settlement) {
  const roomRate = view.pointRate ?? 0.1;
  const ratePerPoint = roomRate > 0 ? roomRate : 0.1;
  const bao = settlement.baoZhuang
    ? BAO_LABEL[settlement.baoZhuang.reason]
    : null;
  const drawText = settlement.drawReason ? DRAW_LABEL[settlement.drawReason] ?? settlement.drawReason : null;

  const baoZhuangPayerScore = settlement.baoZhuang
    ? settlement.scores.find((s) => s.seat === settlement.baoZhuang!.payerSeat)
    : null;
  // 包庄者可能同时从高胡玩家处收到正常差胡；展示包庄款应看实际应付总额，不能用净 delta。
  const baoZhuangTotalPoints = baoZhuangPayerScore?.payable ?? 0;
  const baoZhuangTotalMoney = (baoZhuangTotalPoints * ratePerPoint).toFixed(1);
  const hunDiTotalPoints = settlement.hunDi ? 90 : 0;
  const hunDiTotalMoney = (hunDiTotalPoints * ratePerPoint).toFixed(1);
  const hunDiPerPlayerMoney = ((30) * ratePerPoint).toFixed(1);
  const chaHuPoints = Math.max(0, baoZhuangTotalPoints - hunDiTotalPoints);
  const chaHuMoney = (chaHuPoints * ratePerPoint).toFixed(1);

  // Winner data extraction
  const winnerSeat = settlement.winnerSeat;
  const winnerPlayer = winnerSeat !== null ? view.players[winnerSeat] : null;
  const winnerHand = (winnerPlayer && isPrivatePlayerView(winnerPlayer)) ? winnerPlayer.hand : [];
  const winnerMelds = winnerPlayer ? winnerPlayer.melds : [];
  const winningDiscardId = !settlement.selfDraw && winnerSeat !== null ? view.lastDiscard?.tile.id : undefined;

  const sortedScores = [...settlement.scores].sort((a, b) => b.delta - a.delta);
  const maxDelta = Math.max(...settlement.scores.map((s) => s.delta));

  return {
    roomRate, ratePerPoint, bao, drawText, baoZhuangTotalPoints, baoZhuangTotalMoney,
    hunDiTotalPoints, hunDiTotalMoney, hunDiPerPlayerMoney, chaHuPoints, chaHuMoney,
    winnerPlayer, winnerHand, winnerMelds, winningDiscardId, sortedScores, maxDelta,
  };
}

export type SettlementPresentation = ReturnType<typeof getSettlementPresentation>;

export function getTransactionPresentation(settlement: Settlement, tx: PairwiseTransaction) {
  const nameA = getNickname(settlement, tx.seatA);
  const nameB = getNickname(settlement, tx.seatB);
  const isDealerA = isDealer(settlement, tx.seatA);
  const isDealerB = isDealer(settlement, tx.seatB);
  const seatNameA = SEAT_NAMES[tx.seatA];
  const seatNameB = SEAT_NAMES[tx.seatB];
  const isTie = tx.points === 0;
  const winnerName = tx.points > 0 ? nameA : nameB;
  const loserName = tx.points > 0 ? nameB : nameA;
  const winnerSeat = tx.points > 0 ? seatNameA : seatNameB;
  const loserSeat = tx.points > 0 ? seatNameB : seatNameA;
  const absPoints = Math.abs(tx.points);
  const rawDeltaHu = typeof tx.rawDeltaHu === 'number' ? tx.rawDeltaHu : tx.huA - tx.huB;
  const piaoMultiplier = typeof tx.piaoMultiplier === 'number' ? tx.piaoMultiplier : 1;
  const dealerMultiplier = typeof tx.dealerMultiplier === 'number'
    ? tx.dealerMultiplier
    : (tx.isDealerPair ? 2 : 1);
  const settledDeltaHu = rawDeltaHu * piaoMultiplier * dealerMultiplier;
  const deltaYao = typeof tx.deltaYao === 'number' ? tx.deltaYao : tx.yaoA - tx.yaoB;
  return { nameA, nameB, isDealerA, isDealerB, isTie, winnerName, loserName, winnerSeat, loserSeat, absPoints, rawDeltaHu, piaoMultiplier, dealerMultiplier, settledDeltaHu, deltaYao };
}
