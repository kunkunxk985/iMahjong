/**
 * Mahjong Physical Sound Effects Facade
 *
 * Fully backed by natural sampled physical sound assets via SoundManager.
 * Zero oscillators, zero algorithmic white noise.
 */

import { soundManager } from './soundManager';
export { isMuted, toggleMute } from './settings';

/** Short percussive click — tile hitting the table */
export function playDiscard(): void {
  soundManager.playSfx('discard');
}

/** Soft slide sound — drawing a tile from the wall */
export function playDraw(): void {
  soundManager.playSfx('draw');
}

/** Shuffling mahjong tiles at game start */
export function playShuffle(): void {
  soundManager.playSfx('shuffle');
}

/** Double knock — peng (碰) */
export function playPeng(): void {
  soundManager.playSfx('peng');
}

/** Quick sequence slide and click — chi (吃) */
export function playChi(): void {
  soundManager.playSfx('chi');
}

/** Triple knock locking into place — kan (坎) */
export function playKan(): void {
  soundManager.playSfx('kan');
}

/** Quadruple heavy strike — gang (杠) */
export function playGang(): void {
  soundManager.playSfx('gang');
}

/** Heavy gate lock and bolt — guan men (关门听牌) */
export function playGuanmen(): void {
  soundManager.playSfx('guanmen');
}

/** Triumphant celebratory chime & table slap — hu (胡牌) */
export function playHu(): void {
  soundManager.playSfx('hu');
}

/** Explosive thunder & lightning chime — qi dong gang hu (起手杠胡大满贯) */
export function playQidongHu(): void {
  soundManager.playSfx('qidong_hu');
}

/** Ominous warning bell/gong — bao zhuang (包庄) */
export function playBaozhuang(): void {
  soundManager.playSfx('baozhuang');
}

/** Serene dissolution chimes — settlement / draw (流局) */
export function playSettle(): void {
  soundManager.playSfx('liuju');
}

/** Precision clock/wood tick — countdown warning */
export function playTick(): void {
  soundManager.playSfx('tick');
}

/** Gentle clear chime — player's turn alert */
export function playMyTurn(): void {
  soundManager.playSfx('my_turn');
}

/** Muted wooden double tap — illegal action / claim rejected */
export function playReject(): void {
  soundManager.playSfx('reject');
}

/** Subtle tactile click — button hover feedback */
export function playHover(): void {
  soundManager.playSfx('button_hover');
}
