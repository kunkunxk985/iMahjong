import type { PosterData } from './types';
import { drawRoundedRect } from './primitives';
export function drawBattleHeader(ctx: CanvasRenderingContext2D, data: PosterData, W: number) {
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
}
