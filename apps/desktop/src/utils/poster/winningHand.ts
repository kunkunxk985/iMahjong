import type { PosterData } from './types';
import { drawRoundedRect } from './primitives';
import { drawMahjongTile } from './tiles';
export function drawWinningHand(ctx: CanvasRenderingContext2D, data: PosterData, W: number) {
  const trayY = 398;
  const trayH = 175;
  const trayX = 72;
  const trayW = W - 144;

  drawRoundedRect(ctx, trayX, trayY, trayW, trayH, 12);
  ctx.fillStyle = 'rgba(8, 28, 18, 0.8)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Tray Header
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 16px "SongTi SC", "STKaiti", "Noto Serif SC", serif';
  ctx.fillStyle = '#fde68a';
  const trayTitle = data.isDraw
    ? '🀄 局终牌面 (未形成完整胡牌面)'
    : `🀄 赢家胡牌面拆解 (${data.winnerNickname || '赢家'} · 手牌与副露)`;
  ctx.fillText(trayTitle, trayX + 24, trayY + 28);

  // Render Winning Hand Tiles
  const tileW = 44;
  const tileH = 62;
  let curTileX = trayX + 24;
  const tileY = trayY + 54;

  if (data.winningMelds && data.winningMelds.length > 0) {
    for (const meld of data.winningMelds) {
      for (const t of meld.tiles) {
        drawMahjongTile(ctx, curTileX, tileY, tileW, tileH, t);
        curTileX += tileW + 4;
      }
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curTileX + 6, tileY + 6);
      ctx.lineTo(curTileX + 6, tileY + tileH - 6);
      ctx.stroke();
      curTileX += 16;
    }
  }

  if (data.winningHand && data.winningHand.length > 0) {
    for (const t of data.winningHand) {
      const isWinTile = Boolean(data.winningTileId && t.id === data.winningTileId);
      drawMahjongTile(ctx, curTileX, tileY, tileW, tileH, t, isWinTile);
      curTileX += tileW + 4;
    }
  } else if (!data.isDraw) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('牌面已归集两两对账账册', trayX + 28, tileY + tileH / 2);
  }

  // Tray Footer Tips
  ctx.textAlign = 'right';
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(212, 175, 55, 0.7)';
  ctx.fillText('※ 牌面按邳州查胡规则两两结算 · 幺牌对子及暗刻独立核算', trayX + trayW - 24, trayY + trayH - 18);
}
