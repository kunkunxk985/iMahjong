/** Helper to draw rounded rectangle */
export function drawRoundedRect(
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

/** Render traditional oriental corner filigree flourishes */
export function drawFiligreeCorners(
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
