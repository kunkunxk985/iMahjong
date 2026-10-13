import type { PosterTile } from './types';
import { drawRoundedRect } from './primitives';

const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** Helper to draw a single 2.5D Jade Mahjong Tile on canvas */
export function drawMahjongTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tile: PosterTile,
  isWinningTile: boolean = false,
) {
  ctx.save();

  // 1. Drop shadow & bottom jade layer
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  // Bottom emerald sandwich base
  const bevelH = 6;
  drawRoundedRect(ctx, x, y + bevelH, w, h - bevelH, 6);
  ctx.fillStyle = '#0f3825';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Middle emerald slice
  drawRoundedRect(ctx, x, y + bevelH - 2, w, h - bevelH, 6);
  ctx.fillStyle = '#1b5e3f';
  ctx.fill();

  // 2. Mutton-Fat White Jade Face
  const faceH = h - bevelH;
  drawRoundedRect(ctx, x, y, w, faceH, 5);
  const jadeGrad = ctx.createLinearGradient(x, y, x + w, y + faceH);
  jadeGrad.addColorStop(0, '#ffffff');
  jadeGrad.addColorStop(0.35, '#f5faf7');
  jadeGrad.addColorStop(1, '#dfede5');
  ctx.fillStyle = jadeGrad;
  ctx.fill();

  // Subtle inner chamfer highlight
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.stroke();

  // Outer delicate border
  ctx.strokeStyle = 'rgba(16, 50, 36, 0.25)';
  ctx.stroke();

  // 3. Render Tile Symbol / Number
  const cx = x + w / 2;
  const cy = y + faceH / 2;

  if (tile.suit === 'wan') {
    const digitChar = CHINESE_DIGITS[tile.rank] || String(tile.rank);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.floor(faceH * 0.38)}px "SongTi SC", "STKaiti", "Noto Serif SC", serif`;
    ctx.fillStyle = (tile.rank === 1 || tile.rank === 5 || tile.rank === 7 || tile.rank === 9) ? '#b91c1c' : '#1e293b';
    ctx.fillText(digitChar, cx, cy - faceH * 0.2);

    ctx.font = `900 ${Math.floor(faceH * 0.36)}px "SongTi SC", "STKaiti", "Noto Serif SC", serif`;
    ctx.fillStyle = '#b91c1c';
    ctx.fillText('萬', cx, cy + faceH * 0.24);
  } else if (tile.suit === 'tong') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTongDots(ctx, cx, cy, w, faceH, tile.rank);
  } else if (tile.suit === 'tiao') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTiaoSticks(ctx, cx, cy, w, faceH, tile.rank);
  } else if (tile.suit === 'dragon') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.floor(faceH * 0.6)}px "SongTi SC", "STKaiti", "Noto Serif SC", serif`;
    if (tile.rank === 1) {
      ctx.fillStyle = '#dc2626';
      ctx.fillText('中', cx, cy);
    } else if (tile.rank === 2) {
      ctx.fillStyle = '#15803d';
      ctx.fillText('發', cx, cy);
    } else if (tile.rank === 3) {
      const bw = w * 0.55;
      const bh = faceH * 0.65;
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      drawRoundedRect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 3);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillText('🀄', cx, cy);
    }
  }

  // 4. Winning Tile Laurel Badge
  if (isWinningTile) {
    const badgeW = Math.max(22, w * 0.52);
    const badgeH = 16;
    const bx = x + w - badgeW + 3;
    const by = y - 4;
    drawRoundedRect(ctx, bx, by, badgeW, badgeH, 4);
    ctx.fillStyle = '#b45309';
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#fffbeb';
    ctx.fillText('胡', bx + badgeW / 2, by + badgeH / 2);
  }

  ctx.restore();
}

/** Draw Tong (circle/dots) tiles cleanly on Canvas */
function drawTongDots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  rank: number,
) {
  const drawCircle = (ox: number, oy: number, r: number, color: string) => {
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  };

  const r = Math.max(3.5, w * 0.12);
  const dx = w * 0.22;
  const dy = h * 0.24;

  if (rank === 1) {
    drawCircle(0, 0, w * 0.26, '#dc2626');
  } else if (rank === 2) {
    drawCircle(0, -dy * 0.7, r * 1.2, '#2563eb');
    drawCircle(0, dy * 0.7, r * 1.2, '#15803d');
  } else if (rank === 3) {
    drawCircle(-dx, -dy * 0.8, r, '#2563eb');
    drawCircle(0, 0, r, '#dc2626');
    drawCircle(dx, dy * 0.8, r, '#15803d');
  } else if (rank === 4) {
    drawCircle(-dx, -dy * 0.7, r, '#2563eb');
    drawCircle(dx, -dy * 0.7, r, '#15803d');
    drawCircle(-dx, dy * 0.7, r, '#15803d');
    drawCircle(dx, dy * 0.7, r, '#2563eb');
  } else if (rank === 5) {
    drawCircle(-dx, -dy * 0.7, r, '#2563eb');
    drawCircle(dx, -dy * 0.7, r, '#15803d');
    drawCircle(0, 0, r * 1.15, '#dc2626');
    drawCircle(-dx, dy * 0.7, r, '#15803d');
    drawCircle(dx, dy * 0.7, r, '#2563eb');
  } else if (rank === 6) {
    drawCircle(-dx, -dy * 0.8, r, '#15803d');
    drawCircle(dx, -dy * 0.8, r, '#15803d');
    drawCircle(-dx, 0, r, '#dc2626');
    drawCircle(dx, 0, r, '#dc2626');
    drawCircle(-dx, dy * 0.8, r, '#dc2626');
    drawCircle(dx, dy * 0.8, r, '#dc2626');
  } else if (rank === 7) {
    drawCircle(-dx * 0.8, -dy, r * 0.9, '#15803d');
    drawCircle(0, -dy * 0.6, r * 0.9, '#15803d');
    drawCircle(dx * 0.8, -dy * 0.2, r * 0.9, '#15803d');
    drawCircle(-dx, dy * 0.4, r * 0.9, '#dc2626');
    drawCircle(dx, dy * 0.4, r * 0.9, '#dc2626');
    drawCircle(-dx, dy * 0.95, r * 0.9, '#dc2626');
    drawCircle(dx, dy * 0.95, r * 0.9, '#dc2626');
  } else if (rank === 8) {
    for (let i = 0; i < 4; i++) {
      const yOffset = -dy + i * (dy * 2 / 3);
      drawCircle(-dx, yOffset, r * 0.9, '#2563eb');
      drawCircle(dx, yOffset, r * 0.9, '#2563eb');
    }
  } else if (rank === 9) {
    for (let row = -1; row <= 1; row++) {
      for (let col = -1; col <= 1; col++) {
        const color = row === -1 ? '#15803d' : row === 0 ? '#dc2626' : '#2563eb';
        drawCircle(col * dx, row * dy * 0.85, r * 0.9, color);
      }
    }
  }
}

/** Draw Tiao (bamboo) tiles cleanly on Canvas */
function drawTiaoSticks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  rank: number,
) {
  const drawStick = (ox: number, oy: number, sw: number, sh: number, color: string) => {
    ctx.fillStyle = color;
    drawRoundedRect(ctx, cx + ox - sw / 2, cy + oy - sh / 2, sw, sh, 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + ox - sw / 2, cy + oy - 1, sw, 2);
  };

  const sw = Math.max(3, w * 0.1);
  const sh = h * 0.26;
  const dx = w * 0.24;
  const dy = h * 0.25;

  if (rank === 1) {
    ctx.fillStyle = '#15803d';
    drawRoundedRect(ctx, cx - sw, cy - sh * 0.7, sw * 2, sh * 1.4, 4);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(cx, cy - sh * 0.7, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (rank === 2) {
    drawStick(0, -dy * 0.6, sw, sh, '#15803d');
    drawStick(0, dy * 0.6, sw, sh, '#2563eb');
  } else if (rank === 3) {
    drawStick(0, -dy * 0.7, sw, sh, '#2563eb');
    drawStick(-dx * 0.7, dy * 0.6, sw, sh, '#15803d');
    drawStick(dx * 0.7, dy * 0.6, sw, sh, '#15803d');
  } else if (rank === 4) {
    drawStick(-dx, -dy * 0.6, sw, sh, '#15803d');
    drawStick(dx, -dy * 0.6, sw, sh, '#2563eb');
    drawStick(-dx, dy * 0.6, sw, sh, '#2563eb');
    drawStick(dx, dy * 0.6, sw, sh, '#15803d');
  } else if (rank === 5) {
    drawStick(-dx, -dy * 0.6, sw, sh, '#15803d');
    drawStick(dx, -dy * 0.6, sw, sh, '#2563eb');
    drawStick(0, 0, sw, sh, '#dc2626');
    drawStick(-dx, dy * 0.6, sw, sh, '#2563eb');
    drawStick(dx, dy * 0.6, sw, sh, '#15803d');
  } else if (rank === 6) {
    drawStick(-dx, -dy * 0.6, sw, sh, '#15803d');
    drawStick(0, -dy * 0.6, sw, sh, '#15803d');
    drawStick(dx, -dy * 0.6, sw, sh, '#15803d');
    drawStick(-dx, dy * 0.6, sw, sh, '#2563eb');
    drawStick(0, dy * 0.6, sw, sh, '#2563eb');
    drawStick(dx, dy * 0.6, sw, sh, '#2563eb');
  } else if (rank === 7) {
    drawStick(0, -dy * 0.8, sw, sh * 0.9, '#dc2626');
    drawStick(-dx, 0, sw, sh * 0.8, '#15803d');
    drawStick(dx, 0, sw, sh * 0.8, '#15803d');
    drawStick(-dx, dy * 0.8, sw, sh * 0.8, '#2563eb');
    drawStick(0, dy * 0.8, sw, sh * 0.8, '#2563eb');
    drawStick(dx, dy * 0.8, sw, sh * 0.8, '#2563eb');
  } else if (rank === 8) {
    for (let i = 0; i < 4; i++) {
      const yOffset = -dy + i * (dy * 2 / 3);
      drawStick(-dx * 0.9, yOffset, sw, sh * 0.9, '#15803d');
      drawStick(dx * 0.9, yOffset, sw, sh * 0.9, '#2563eb');
    }
  } else if (rank === 9) {
    for (let c = -1; c <= 1; c++) {
      drawStick(c * dx, -dy * 0.75, sw, sh * 0.75, '#15803d');
      drawStick(c * dx, 0, sw, sh * 0.75, '#dc2626');
      drawStick(c * dx, dy * 0.75, sw, sh * 0.75, '#2563eb');
    }
  }
}

