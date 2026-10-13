import type { PosterData } from './types';
import { drawRoundedRect } from './primitives';
export function drawBattleVerdict(ctx: CanvasRenderingContext2D, data: PosterData, W: number) {
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
}
