import type { PosterData } from './types';
import { drawRoundedRect } from './primitives';

const SEAT_NAMES = ['东', '南', '西', '北'];
const RANK_LABELS = ['壹', '贰', '叁', '肆'];

export function drawBattleStandings(ctx: CanvasRenderingContext2D, data: PosterData, W: number) {
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
}
