/**
 * iMahjong - HTML5 Canvas 2D Battle Report Poster Generator
 * High-Aesthetic Guofeng Battle Report Poster at 2x Retina Resolution
 */

import type { PosterData } from './poster/types';
export type { PosterData, PosterPlayerData, PosterTile, PosterMeld } from './poster/types';

import { drawBattleBackground } from './poster/background';
import { drawBattleHeader } from './poster/header';
import { drawBattleVerdict } from './poster/verdict';
import { drawWinningHand } from './poster/winningHand';
import { drawBattleStandings } from './poster/standings';
import { drawBattleFooter } from './poster/footer';

/**
 * Main function to render high-DPI Canvas Battle Report Poster
 */
export async function renderBattleReportCanvas(data: PosterData): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Graceful fallback if font ready fails
    }
  }

  const canvas = document.createElement('canvas');
  // High-DPI 2x resolution: 1200 x 1600 (aspect ratio 3:4)
  const W = 1200;
  const H = 1600;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d canvas context');

  // Layer painters share this context in order; do not reset its inherited state.
  ctx.save();
  drawBattleBackground(ctx, W, H);
  drawBattleHeader(ctx, data, W);
  drawBattleVerdict(ctx, data, W);
  drawWinningHand(ctx, data, W);
  drawBattleStandings(ctx, data, W);
  drawBattleFooter(ctx, W, H);
  ctx.restore();
  return canvas;
}

/**
 * Export high-DPI Battle Report Poster as Base64 Data URL (PNG)
 */
export async function exportBattleReportPoster(data: PosterData): Promise<string> {
  const canvas = await renderBattleReportCanvas(data);
  return canvas.toDataURL('image/png', 1.0);
}

/**
 * Trigger Instant One-Click PNG Download in Browser/Electron
 */
export function downloadBattleReportPoster(dataUrl: string, filename?: string): void {
  const name = filename || `pizhou-battle-report-${Date.now()}.png`;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
