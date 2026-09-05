/**
 * Pizhou Mahjong - HTML5 Canvas 2D Battle Report Poster Generator
 * High-Aesthetic Guofeng Battle Report Poster at 2x Retina Resolution
 */

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

const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SEAT_NAMES = ['东', '南', '西', '北'];
const RANK_LABELS = ['壹', '贰', '叁', '肆'];

/** Helper to draw rounded rectangle */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Helper to draw a single 2.5D Jade Mahjong Tile on canvas */
function drawMahjongTile(
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

/** Render traditional oriental corner filigree flourishes */
function drawFiligreeCorners(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  armLen: number = 32,
) {
  ctx.save();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2.5;

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(x, y + armLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + armLen, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 10, y + 10, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#d4af37';
  ctx.fill();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(x + w - armLen, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + armLen);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w - 10, y + 10, 3, 0, Math.PI * 2);
  ctx.fill();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(x, y + h - armLen);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + armLen, y + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 10, y + h - 10, 3, 0, Math.PI * 2);
  ctx.fill();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(x + w - armLen, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - armLen);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w - 10, y + h - 10, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

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

  // ==========================================
  // Layer 1: Imperial Lacquer Jade Background
  // ==========================================
  ctx.save();
  const bgGrad = ctx.createRadialGradient(W / 2, 450, 100, W / 2, H / 2, 950);
  bgGrad.addColorStop(0, '#0c3524');
  bgGrad.addColorStop(0.45, '#072016');
  bgGrad.addColorStop(0.85, '#03100a');
  bgGrad.addColorStop(1, '#020906');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle central watermarks
  ctx.beginPath();
  ctx.arc(W / 2, 520, 260, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.035)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2, 520, 340, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.02)';
  ctx.stroke();

  // ==========================================
  // Layer 2: Gold-Veined Filigree Borders
  // ==========================================
  const padOuter = 36;
  const padInner = 44;

  // Outer gold frame
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, padOuter, padOuter, W - padOuter * 2, H - padOuter * 2, 16);
  ctx.stroke();

  // Inner hairline frame
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, padInner, padInner, W - padInner * 2, H - padInner * 2, 12);
  ctx.stroke();

  // 4 Corner filigree ornaments
  drawFiligreeCorners(ctx, padInner + 6, padInner + 6, W - (padInner + 6) * 2, H - (padInner + 6) * 2, 40);

  // ==========================================
  // Layer 3: Header Calligraphy & Cinnabar Seal
  // ==========================================
  // Cinnabar Seal "邳"
  const sealX = W / 2 - 28;
  const sealY = 70;
  const sealSize = 56;
  drawRoundedRect(ctx, sealX, sealY, sealSize, sealSize, 10);
  const sealGrad = ctx.createLinearGradient(sealX, sealY, sealX + sealSize, sealY + sealSize);
  sealGrad.addColorStop(0, '#b91c1c');
  sealGrad.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = sealGrad;
  ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 32px "SongTi SC", "STKaiti", "Noto Serif SC", serif';
  ctx.fillStyle = '#fffbeb';
  ctx.fillText('邳', sealX + sealSize / 2, sealY + sealSize / 2 + 1);

  // Title: 邳州麻将 · 终局战报
  ctx.font = '900 44px "SongTi SC", "STKaiti", "Noto Serif SC", serif';
  const titleGrad = ctx.createLinearGradient(W / 2 - 220, 150, W / 2 + 220, 150);
  titleGrad.addColorStop(0, '#fffbeb');
  titleGrad.addColorStop(0.5, '#fef08a');
  titleGrad.addColorStop(1, '#fde68a');
  ctx.fillStyle = titleGrad;
  ctx.shadowColor = 'rgba(245, 158, 11, 0.35)';
  ctx.shadowBlur = 16;
  ctx.fillText('邳州麻将 · 终局战报', W / 2, 160);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.font = '600 13px sans-serif';
  ctx.fillStyle = 'rgba(212, 175, 55, 0.75)';
  ctx.fillText('AUTHENTIC JIANGHUAI MAHJONG BATTLE REPORT', W / 2, 195);

  // Horizontal Decorative Divider Line
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 280, 218);
  ctx.lineTo(W / 2 + 280, 218);
  ctx.stroke();

  // Central small gold diamond
  ctx.save();
  ctx.translate(W / 2, 218);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();

  // Match Metadata Pills Row
  const metaY = 245;
  const modeText = data.gameMode === 'online' ? '友人联机' : '单机演练';
  const roomText = `房号: ${data.roomCode || '888888'}`;
  const timeText = data.dateStr || new Date(data.timestamp).toLocaleString();
  const rateText = data.hunDi ? '飘荤底90分' : (data.pointRate ? `¥${data.pointRate}/分` : '标准番');

  const metaItems = [modeText, roomText, timeText, rateText];
  const metaStartX = W / 2 - 320;
  const metaW = 150;
  const metaGap = 13;

  metaItems.forEach((text, i) => {
    const mx = metaStartX + i * (metaW + metaGap);
    drawRoundedRect(ctx, mx, metaY, metaW, 30, 15);
    ctx.fillStyle = 'rgba(15, 45, 30, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 13px sans-serif';
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText(text, mx + metaW / 2, metaY + 15);
  });

  // ==========================================
  // Layer 4: Verdict Ribbon Banner
  // ==========================================
  const bannerY = 300;
  const bannerH = 76;
  const bannerX = 72;
  const bannerW = W - 144;

  drawRoundedRect(ctx, bannerX, bannerY, bannerW, bannerH, 12);
  const bannerGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX + bannerW, bannerY + bannerH);
  if (data.isDraw) {
    bannerGrad.addColorStop(0, 'rgba(51, 65, 85, 0.7)');
    bannerGrad.addColorStop(1, 'rgba(30, 41, 59, 0.7)');
  } else {
    bannerGrad.addColorStop(0, 'rgba(40, 24, 10, 0.85)');
    bannerGrad.addColorStop(0.5, 'rgba(60, 38, 12, 0.9)');
    bannerGrad.addColorStop(1, 'rgba(40, 24, 10, 0.85)');
  }
  ctx.fillStyle = bannerGrad;
  ctx.fill();
  ctx.strokeStyle = data.isDraw ? 'rgba(148, 163, 184, 0.4)' : 'rgba(245, 158, 11, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Main Verdict Text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 28px "SongTi SC", "STKaiti", "Noto Serif SC", serif';
  if (data.isDraw) {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`本局流局 · 握手言和 (${data.drawReason || '荒牌'})`, W / 2, bannerY + 28);
  } else {
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`恭喜【${data.winnerNickname || '获胜玩家'}】${data.winType || '平胡'}！`, W / 2, bannerY + 28);
  }

  // Verdict Tags Row
  const tagList: string[] = [];
  if (data.hunDi) tagList.push('🍲 飘荤底分 +90分');
  if (!data.isDraw) tagList.push('👑 涉及庄家两两胡差×2');
  if (data.baoZhuang) tagList.push(`💥 包庄全包赔`);
  if (!data.isDraw && !tagList.length) tagList.push('🀄 淮海对账 · 落地清算');

  ctx.font = '600 13px sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(tagList.join('   |   '), W / 2, bannerY + 56);

  // ==========================================
  // Layer 5: Winning Hand Showcase (Domino Tray)
  // ==========================================
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

  // ==========================================
  // Layer 6: 4-Player Standings Table
  // ==========================================
  const tableY = 595;
  const tableX = 72;
  const tableW = W - 144;
  const tableH = 750;

  drawRoundedRect(ctx, tableX, tableY, tableW, tableH, 14);
  ctx.fillStyle = 'rgba(6, 22, 14, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Table Title Bar
  const tHeaderH = 54;
  drawRoundedRect(ctx, tableX, tableY, tableW, tHeaderH, 14);
  ctx.fillStyle = 'rgba(15, 45, 30, 0.7)';
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 20px "SongTi SC", "STKaiti", "Noto Serif SC", serif';
  ctx.fillStyle = '#fef08a';
  ctx.fillText('🏆 四家战绩结算榜 (两两对账净结余)', tableX + 24, tableY + tHeaderH / 2);

  ctx.textAlign = 'right';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('位次 / 雀士 / 身份 / 查胡分 / 净结余', tableX + tableW - 24, tableY + tHeaderH / 2);

  // Sort Players by scoreDelta Descending
  const sortedPlayers = [...data.players].sort((a, b) => b.scoreDelta - a.scoreDelta);
  const maxDelta = Math.max(...sortedPlayers.map((p) => p.scoreDelta));

  const rowH = 156;
  sortedPlayers.forEach((player, idx) => {
    const rowY = tableY + tHeaderH + 12 + idx * (rowH + 12);
    const isMvp = player.scoreDelta === maxDelta && maxDelta > 0;
    const isFirst = idx === 0;

    // Row Container Card (Double Bezel)
    drawRoundedRect(ctx, tableX + 16, rowY, tableW - 32, rowH, 10);
    if (isFirst) {
      const rowGrad = ctx.createLinearGradient(tableX, rowY, tableX + tableW, rowY);
      rowGrad.addColorStop(0, 'rgba(60, 42, 15, 0.75)');
      rowGrad.addColorStop(0.5, 'rgba(45, 30, 10, 0.6)');
      rowGrad.addColorStop(1, 'rgba(20, 15, 5, 0.75)');
      ctx.fillStyle = rowGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(12, 32, 22, 0.65)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Rank Badge (壹, 贰, 叁, 肆)
    const rankX = tableX + 48;
    const rankY = rowY + rowH / 2;
    ctx.beginPath();
    ctx.arc(rankX, rankY, 24, 0, Math.PI * 2);
    ctx.fillStyle = isFirst ? '#b45309' : idx === 1 ? '#475569' : idx === 2 ? '#78350f' : '#1e293b';
    ctx.fill();
    ctx.strokeStyle = isFirst ? '#fef08a' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 20px "SongTi SC", "STKaiti", "Noto Serif SC", serif';
    ctx.fillStyle = isFirst ? '#fef08a' : '#f8fafc';
    ctx.fillText(RANK_LABELS[idx] || String(idx + 1), rankX, rankY + 1);

    // MVP Laurel Crest
    if (isMvp) {
      const mvpBadgeX = rankX + 44;
      const mvpBadgeY = rowY + 22;
      drawRoundedRect(ctx, mvpBadgeX, mvpBadgeY, 68, 22, 11);
      ctx.fillStyle = '#d97706';
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#fffbeb';
      ctx.fillText('👑 MVP', mvpBadgeX + 34, mvpBadgeY + 11);
    }

    // Seat Wind Pill
    const seatX = tableX + 110;
    const seatY = rowY + 36;
    drawRoundedRect(ctx, seatX, seatY, 28, 28, 6);
    ctx.fillStyle = '#0f3825';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px "SongTi SC", "STKaiti", serif';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(SEAT_NAMES[player.seat] || '东', seatX + 14, seatY + 14);

    // Player Nickname & Title
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(player.nickname, seatX + 40, seatY + 14);

    if (player.title) {
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`·  ${player.title}`, seatX + 40 + ctx.measureText(player.nickname).width + 12, seatY + 14);
    }

    // Status Badges (庄 / 关门 / 飘 / 胡)
    let badgeOffset = seatX;
    const badgeY = rowY + 76;
    const drawBadge = (txt: string, bg: string, border: string) => {
      const bw = ctx.measureText(txt).width + 16;
      drawRoundedRect(ctx, badgeOffset, badgeY, bw, 24, 4);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(txt, badgeOffset + bw / 2, badgeY + 12);
      badgeOffset += bw + 8;
    };

    ctx.font = '12px sans-serif';
    if (player.isDealer) drawBadge('庄家', '#854d0e', '#fde047');
    if (player.closed) drawBadge('关门', '#1e40af', '#93c5fd');
    if (player.piaoHun) drawBadge('飘荤', '#6b21a8', '#d8b4fe');
    if (player.isWinner) drawBadge('本局胡牌', '#991b1b', '#fca5a5');

    // Hu / Yao counts
    ctx.textAlign = 'left';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`牌面查胡：${player.hu} 胡 · ${player.yao} 幺`, seatX, rowY + 124);

    if (player.notes && player.notes.length > 0) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`牌型：${player.notes.slice(0, 3).join('，')}`, seatX + 180, rowY + 124);
    }

    // Large Score Delta on Right Side
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const deltaX = tableX + tableW - 48;
    const deltaY = rowY + rowH / 2 - 10;

    const delta = player.scoreDelta;
    const deltaStr = delta > 0 ? `+${delta}` : String(delta);

    ctx.font = '900 36px "DIN Alternate", "PingFang SC", sans-serif';
    if (delta > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = 'rgba(251, 191, 36, 0.4)';
      ctx.shadowBlur = 10;
    } else if (delta < 0) {
      ctx.fillStyle = '#f87171';
      ctx.shadowColor = 'transparent';
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.shadowColor = 'transparent';
    }
    ctx.fillText(`${deltaStr} 分`, deltaX, deltaY);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Cumulative total score
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`本局后累计: ${player.totalScore} 分`, deltaX, deltaY + 34);
  });

  // ==========================================
  // Layer 7: Footer Traditional Watermark
  // ==========================================
  const footerY = H - 100;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Cultural motto
  ctx.font = '15px "SongTi SC", "STKaiti", "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(212, 175, 55, 0.85)';
  ctx.fillText('两对关门藏机巧 · 坎上自杠显奇谋 · 两两对账见真章', W / 2, footerY);

  // Sub watermark
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.fillText('邳州麻将官方终局战报认证 · 淮海雀道经典传承 · 零黑边高清渲染', W / 2, footerY + 26);

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
