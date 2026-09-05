/**
 * Mahjong Authentic Voice Pack Facade
 *
 * Backed entirely by authentic recorded/synthesized broadcast audio assets
 * (Mandarin and Pizhou dialect) via SoundManager.
 * Zero browser-dependent synthetic speech.
 */

import { getVoiceMode, setVoiceMode, type VoiceMode } from './settings';
import { soundManager } from './soundManager';

export type { VoiceMode };
export { getVoiceMode, setVoiceMode };

/** Mapping from game action strings to voice clip filenames */
const ACTION_CLIP_MAP: Record<string, string> = {
  peng: 'peng',
  chi: 'chi',
  kan: 'kan',
  gang: 'gang',
  'ming-gang': 'gang',
  'an-gang': 'an_gang',
  'zi-gang': 'gang',
  'close-gate': 'close_gate',
  hu: 'hu',
  'qidong-gang-hu': 'qidong_gang_hu',
  baozhuang: 'baozhuang',
};

/**
 * Convert tileKey (e.g. "wan-1", "tiao-9", "dragon-1") to audio clip filename (e.g. "wan_1")
 */
function tileKeyToClip(tileKey: string): string {
  return tileKey.replace(/-/g, '_');
}

/**
 * Play action announcement voice clip (e.g. "碰！", "关大门听牌！")
 */
export function speakAction(actionType: string): void {
  const mode = getVoiceMode();
  if (mode === 'off') return;

  const clipName = ACTION_CLIP_MAP[actionType] || actionType.replace(/-/g, '_');
  soundManager.playVoice(mode, clipName);
}

/**
 * Play tile discard announcement voice clip (e.g. "一万", "幺鸡", "红中")
 */
export function speakDiscardTile(tileKey: string): void {
  const mode = getVoiceMode();
  if (mode === 'off') return;

  const clipName = tileKeyToClip(tileKey);
  soundManager.playVoice(mode, clipName);
}

/**
 * Legacy API compatibility helper.
 * Strictly operates without native browser speech synthesis.
 */
export function speakText(text: string): void {
  const mode = getVoiceMode();
  if (mode === 'off') return;

  // If text matches any known action or tile, redirect to audio asset
  const trimmed = text.replace(/[！!]/g, '');
  if (trimmed === '碰') speakAction('peng');
  else if (trimmed === '吃' || trimmed === '吃了') speakAction('chi');
  else if (trimmed === '坎上' || trimmed === '坎上了') speakAction('kan');
  else if (trimmed === '杠' || trimmed === '开杠') speakAction('gang');
  else if (trimmed === '暗杠') speakAction('an-gang');
  else if (trimmed.includes('关门') || trimmed.includes('关大门')) speakAction('close-gate');
  else if (trimmed.includes('胡')) speakAction('hu');
  else if (trimmed.includes('包庄')) speakAction('baozhuang');
}
