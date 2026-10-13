import { drawFiligreeCorners, drawRoundedRect } from './primitives';
export function drawBattleBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
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
}
