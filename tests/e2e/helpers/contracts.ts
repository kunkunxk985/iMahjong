import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Tile, Meld, PublicPlayerView } from '@pizhou/shared';
import { PizhouGame, getTenpaiWaits } from '@pizhou/rules';

/**
 * Required SFX keys per Feature 1 & R1 Survey
 */
export const REQUIRED_SFX_KEYS = [
  'discard',
  'draw',
  'shuffle',
  'peng',
  'chi',
  'kan',
  'gang',
  'guanmen',
  'hu',
  'qidong_hu',
  'baozhuang',
  'liuju',
  'my_turn',
  'tick',
  'reject',
  'button_hover',
] as const;

/**
 * Required Action Voice keys per Feature 2 & R1 Survey
 */
export const REQUIRED_ACTION_VOICE_KEYS = [
  'peng',
  'chi',
  'kan',
  'gang',
  'an_gang',
  'close_gate',
  'hu',
  'qidong_gang_hu',
  'baozhuang',
] as const;

/**
 * Required Tile Voice keys per Feature 2 & R1 Survey
 */
export const REQUIRED_TILE_VOICE_KEYS = [
  ...Array.from({ length: 9 }, (_, i) => `wan_${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `tiao_${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `tong_${i + 1}`),
  'dragon_1',
  'dragon_2',
  'dragon_3',
] as const;

export const ALL_39_VOICE_KEYS = [...REQUIRED_ACTION_VOICE_KEYS, ...REQUIRED_TILE_VOICE_KEYS] as const;

export interface WavHeaderInfo {
  isValid: boolean;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataByteLength: number;
  error?: string;
}

/**
 * Parses and validates a standard RIFF/WAVE PCM buffer
 */
export function parseWavHeader(buffer: Buffer): WavHeaderInfo {
  if (buffer.length < 44) {
    return { isValid: false, channels: 0, sampleRate: 0, bitsPerSample: 0, dataByteLength: 0, error: 'Buffer too small (<44 bytes)' };
  }

  const riff = buffer.toString('ascii', 0, 4);
  if (riff !== 'RIFF') {
    return { isValid: false, channels: 0, sampleRate: 0, bitsPerSample: 0, dataByteLength: 0, error: `Invalid RIFF header: ${riff}` };
  }

  const wave = buffer.toString('ascii', 8, 12);
  if (wave !== 'WAVE') {
    return { isValid: false, channels: 0, sampleRate: 0, bitsPerSample: 0, dataByteLength: 0, error: `Invalid WAVE tag: ${wave}` };
  }

  // Find 'fmt ' chunk
  let offset = 12;
  let fmtFound = false;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      fmtFound = true;
      audioFormat = buffer.readUInt16LE(offset + 8);
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
      offset += 8 + chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }

  if (!fmtFound) {
    return { isValid: false, channels: 0, sampleRate: 0, bitsPerSample: 0, dataByteLength: 0, error: "Missing 'fmt ' chunk" };
  }

  // Find 'data' chunk
  let dataByteLength = 0;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      dataByteLength = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }

  return {
    isValid: (audioFormat === 1 || audioFormat === 0xfffe) && channels > 0 && sampleRate > 0 && bitsPerSample >= 8 && dataByteLength > 0,
    channels,
    sampleRate,
    bitsPerSample,
    dataByteLength,
  };
}

/**
 * AudioSettings Interface specification
 */
export interface AudioSettings {
  masterVolume: number; // 0.0 ~ 1.0
  sfxVolume: number;    // 0.0 ~ 1.0
  voiceVolume: number;  // 0.0 ~ 1.0
  muted: boolean;
  voiceMode: 'pizhou' | 'mandarin' | 'off';
}

export function validateAudioSettings(settings: Partial<AudioSettings>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof settings.masterVolume === 'number' && (settings.masterVolume < 0 || settings.masterVolume > 1)) {
    errors.push(`masterVolume out of range [0, 1]: ${settings.masterVolume}`);
  }
  if (typeof settings.sfxVolume === 'number' && (settings.sfxVolume < 0 || settings.sfxVolume > 1)) {
    errors.push(`sfxVolume out of range [0, 1]: ${settings.sfxVolume}`);
  }
  if (typeof settings.voiceVolume === 'number' && (settings.voiceVolume < 0 || settings.voiceVolume > 1)) {
    errors.push(`voiceVolume out of range [0, 1]: ${settings.voiceVolume}`);
  }
  if (typeof settings.muted !== 'undefined' && typeof settings.muted !== 'boolean') {
    errors.push(`muted must be a boolean`);
  }
  if (typeof settings.voiceMode !== 'undefined' && !['pizhou', 'mandarin', 'off'].includes(settings.voiceMode)) {
    errors.push(`Invalid voiceMode: ${settings.voiceMode}`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Mathematical reference oracle for Shanten Search in Pizhou Mahjong
 */
export function referenceShantenSearch(hand: Tile[], melds: Meld[] = []): { shanten: number; waits: string[] } {
  const meldsCount = melds.length;
  // If player has 4 melds, remaining 1 tile is single wait (shanten 0)
  if (meldsCount === 4 && hand.length === 1) {
    return { shanten: 0, waits: [hand[0]!.key] };
  }

  // If player has 3 melds and hand is 4 tiles with 2 pairs (Guanmen 2-pair formation)
  if (meldsCount === 3 && hand.length === 4) {
    const counts = new Map<string, number>();
    for (const t of hand) counts.set(t.key, (counts.get(t.key) ?? 0) + 1);
    const pairs = Array.from(counts.entries()).filter(([, c]) => c === 2);
    if (pairs.length === 2) {
      // 2 pairs waiting on either pair to become a meld or single pair
      return { shanten: 0, waits: pairs.map(([key]) => key) };
    }
  }

  // Use existing tenpai wait oracle from rules engine
  const tenpaiWaits = getTenpaiWaits(hand, meldsCount);
  if (tenpaiWaits.length > 0) {
    return { shanten: 0, waits: tenpaiWaits };
  }

  // Standard recursive shanten calculation
  const targetMelds = 4 - meldsCount;
  const countMap = new Map<string, number>();
  for (const t of hand) countMap.set(t.key, (countMap.get(t.key) ?? 0) + 1);

  // Approximate general shanten
  let meldCandidates = 0;
  let pairCandidates = 0;
  for (const [, count] of countMap.entries()) {
    if (count >= 3) meldCandidates += 1;
    else if (count === 2) pairCandidates += 1;
  }

  const shanten = Math.max(0, 2 * (targetMelds - meldCandidates) - pairCandidates);
  return { shanten, waits: [] };
}

/**
 * Mathematical reference oracle for Discard Threat Assessment
 */
export function referenceAssessDanger(
  tile: Tile,
  opponents: Array<{ closed: boolean; melds: Meld[]; discards: Tile[]; discardedBeforeClose?: string[] }>,
  allDiscards: Tile[],
): { dangerScore: number; isGenbutsu: boolean; isXiangPai: boolean } {
  let maxScore = 0;
  let isGenbutsu = false;
  let isXiangPai = false;

  const fourSeen = allDiscards.filter((t) => t.key === tile.key).length >= 4;
  if (fourSeen) {
    return { dangerScore: 0, isGenbutsu: false, isXiangPai: false };
  }

  for (const opp of opponents) {
    // Genbutsu: opponent discarded this tile
    const oppDiscarded = opp.discards.some((d) => d.key === tile.key);
    if (oppDiscarded) {
      isGenbutsu = true;
      continue;
    }

    // Closed gate opponent: unseen tiles are dangerous
    if (opp.closed) {
      const isChouPai = opp.discardedBeforeClose?.includes(tile.key) ?? false;
      if (!isChouPai) {
        const seenInRiver = allDiscards.some((d) => d.key === tile.key);
        if (!seenInRiver) {
          isXiangPai = true;
          maxScore = Math.max(maxScore, 90);
        } else {
          maxScore = Math.max(maxScore, 40);
        }
      }
    }

    // Opponent with 3 pungs waiting for incense (Bao Xiang threat)
    const pungs = opp.melds.filter((m) => m.type === 'peng' || m.type === 'kan' || m.type === 'an-gang' || m.type === 'ming-gang' || m.type === 'zi-gang');
    if (pungs.length >= 3 && !opp.closed) {
      const seen = allDiscards.some((d) => d.key === tile.key);
      if (!seen) {
        isXiangPai = true;
        maxScore = Math.max(maxScore, 95);
      }
    }
  }

  return { dangerScore: isGenbutsu ? 0 : maxScore, isGenbutsu, isXiangPai };
}

/**
 * Pure state serializer and deserializer validator for PizhouGame
 */
export function serializeGameToPureState(game: PizhouGame): Record<string, unknown> {
  const raw = game as unknown as {
    seats: Array<{
      seat: number;
      hand: Tile[];
      discards: Tile[];
      melds: Meld[];
      closed: boolean;
      closedTwoPair: boolean;
      closedTwoPairKeys: string[];
      discardedBeforeClose: string[];
      singleWaitChanged: boolean;
      lastDrawnId: string | null;
      firstDiscardKey: string | null;
    }>;
    wall: Tile[];
    dealer: number;
    currentSeat: number;
    phase: string;
    sequence: number;
    lastDiscard: unknown;
    firstDiscardDone: boolean;
    hadOpeningKong: boolean;
    processedActionIds: Set<string>;
    settlement: unknown;
  };

  return {
    seats: raw.seats.map((s) => ({
      ...s,
      hand: [...s.hand],
      discards: [...s.discards],
      melds: [...s.melds],
      closedTwoPairKeys: [...s.closedTwoPairKeys],
      discardedBeforeClose: [...s.discardedBeforeClose],
    })),
    wall: [...raw.wall],
    dealer: raw.dealer,
    currentSeat: raw.currentSeat,
    phase: raw.phase,
    sequence: raw.sequence,
    lastDiscard: raw.lastDiscard ? JSON.parse(JSON.stringify(raw.lastDiscard)) : null,
    firstDiscardDone: raw.firstDiscardDone,
    hadOpeningKong: raw.hadOpeningKong,
    processedActionIds: Array.from(raw.processedActionIds ?? []),
    settlement: raw.settlement ? JSON.parse(JSON.stringify(raw.settlement)) : null,
  };
}

export function restoreGameFromPureState(state: Record<string, unknown>): PizhouGame {
  const game = new PizhouGame();
  const raw = game as unknown as Record<string, unknown>;

  const savedSeats = state.seats as Array<{
    seat: number;
    hand: Tile[];
    discards: Tile[];
    melds: Meld[];
    closed: boolean;
    closedTwoPair: boolean;
    closedTwoPairKeys: string[];
    discardedBeforeClose: string[];
    singleWaitChanged: boolean;
    lastDrawnId: string | null;
    firstDiscardKey: string | null;
  }>;

  raw.seats = savedSeats.map((s) => ({
    ...s,
    hand: [...s.hand],
    discards: [...s.discards],
    melds: [...s.melds],
    closedTwoPairKeys: [...s.closedTwoPairKeys],
    discardedBeforeClose: [...s.discardedBeforeClose],
  }));

  raw.wall = [...(state.wall as Tile[])];
  raw.dealer = state.dealer;
  raw.currentSeat = state.currentSeat;
  raw.phase = state.phase;
  raw.sequence = state.sequence;
  raw.lastDiscard = state.lastDiscard;
  raw.firstDiscardDone = state.firstDiscardDone;
  raw.hadOpeningKong = state.hadOpeningKong;
  raw.processedActionIds = new Set(state.processedActionIds as string[]);
  raw.settlement = state.settlement;

  return game;
}
