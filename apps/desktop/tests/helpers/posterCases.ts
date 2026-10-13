import type { PosterData } from '../../src/utils/canvasPoster.ts';

const base: PosterData = {
  roomCode: '123456', gameMode: 'online', timestamp: 1700000000000,
  dateStr: '2023/11/14 22:13', pointRate: 2, winnerSeat: 1,
  winnerNickname: '南家', winType: '自摸', isDraw: false,
  dealerMultiplier: 2, hunDi: false,
  players: [
    { seat: 0, nickname: '东家', scoreDelta: -40, totalScore: 100, hu: 3, yao: 2, isDealer: true, isWinner: false, isMvp: true, closed: true },
    { seat: 1, nickname: '南家', title: '雀圣', scoreDelta: 80, totalScore: 220, hu: 8, yao: 4, isDealer: false, isWinner: true, isMvp: false, piaoHun: true, notes: ['七对', '暗刻', '幺对', '不显示'], avatar: 'https://example.invalid/avatar.png' },
    { seat: 2, nickname: '西家', scoreDelta: 0, totalScore: 0, hu: 1, yao: 0, isDealer: false, isWinner: false, isMvp: false },
    { seat: 3, nickname: '北家', scoreDelta: -40, totalScore: -80, hu: 2, yao: 1, isDealer: false, isWinner: false, isMvp: false },
  ],
  winningMelds: [{ type: 'peng', tiles: [1, 2, 3].map((rank) => ({ suit: 'dragon', rank })) }],
  winningHand: [{ suit: 'wan', rank: 5, id: 'win' }, { suit: 'tong', rank: 9 }, { suit: 'tiao', rank: 1 }],
  winningTileId: 'win',
};

export const posterCases: Record<string, PosterData> = {
  winner: base,
  hunDi: { ...base, hunDi: true, baoZhuang: { payerSeat: 0, reason: '包庄' } },
  draw: { ...base, isDraw: true, drawReason: '四风连打', winningHand: [], winningMelds: [] },
  defaults: { ...base, gameMode: 'local', roomCode: '', dateStr: '', pointRate: undefined, winnerNickname: null, winType: '', winningHand: undefined, winningMelds: undefined, players: [] },
  ties: { ...base, players: base.players.map((player, i) => ({ ...player, scoreDelta: i < 2 ? 10 : -10, notes: [], title: undefined })) },
  tiles: {
    ...base, winningMelds: undefined,
    winningHand: [
      ...['wan', 'tong', 'tiao'].flatMap((suit) => Array.from({ length: 9 }, (_, i) => ({ suit, rank: i + 1 }))),
      { suit: 'wan', rank: 12 }, { suit: 'dragon', rank: 1 }, { suit: 'dragon', rank: 2 },
      { suit: 'dragon', rank: 3 }, { suit: 'dragon', rank: 4 }, { suit: 'unknown', rank: 1 },
    ],
  },
};
