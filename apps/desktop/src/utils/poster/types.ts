export interface PosterPlayerData {
  seat: number;
  nickname: string;
  avatar?: string;
  title?: string;
  scoreDelta: number;
  totalScore: number;
  hu: number;
  yao: number;
  isDealer: boolean;
  isWinner: boolean;
  isMvp: boolean;
  piaoHun?: boolean;
  closed?: boolean;
  notes?: string[];
}

export interface PosterTile {
  suit: string;
  rank: number;
  id?: string;
}

export interface PosterMeld {
  type: string;
  tiles: PosterTile[];
}

export interface PosterData {
  roomCode: string;
  gameMode: 'online' | 'local';
  timestamp: number;
  dateStr: string;
  pointRate?: number;
  winnerSeat: number | null;
  winnerNickname?: string | null;
  winType: string;
  isDraw: boolean;
  drawReason?: string | null;
  dealerMultiplier: number;
  hunDi: boolean;
  baoZhuang?: { payerSeat: number; reason: string } | null;
  winningHand?: PosterTile[];
  winningMelds?: PosterMeld[];
  winningTileId?: string;
  players: PosterPlayerData[];
}
