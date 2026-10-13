
export function drawBattleFooter(ctx: CanvasRenderingContext2D, W: number, H: number) {
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
}
