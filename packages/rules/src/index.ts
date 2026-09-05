export {
  PizhouGame,
  serializeGame,
  deserializeGame,
  type EngineOptions,
  type PlayerMeta,
  type ApplyResult,
  type SerializedGameState,
  type SerializedGame,
} from './engine.ts';

export { canHuTiles, findWinDecompositions, isSevenPairs } from './win.ts';
export {
  scoreWin,
  scoreQidongGangHu,
  scoreSeat,
  settleChaHu,
  extractUnits,
  unitValue,
  isPiaoHun,
  detectBaoZhuang,
  canFormSequence,
  hasOpeningKong,
  nextDealer,
  finalPoints,
  type ScoreResult,
} from './score.ts';
export {
  findChiOptions,
  selfTurnActions,
  claimActions,
  ACTION_RANK,
  isBetterAction,
} from './actions.ts';
export {
  chooseCompanionAction,
  pickDiscard,
  discardScore,
  companionThinkMs,
  type CompanionContext,
  type PickDiscardOptions,
  type CompanionTimingContext,
} from './companion.ts';
export { getTenpaiWaits, getDiscardTenpaiOptions, ALL_TILE_KEYS, type DiscardTenpaiOption } from './tenpai.ts';
export {
  calculateShanten,
  calculateTileAcceptance,
  type ShantenResult,
  type DiscardAcceptance,
  type TileAcceptanceResult,
} from './shanten.ts';
export {
  assessDiscardDanger,
  assessHandDefense,
  isTableInHighDefenseState,
  analyzeOpponentThreat,
  type DangerAssessment,
  type OpponentThreat,
} from './defense.ts';
