// Ember Valley — Sky Courier: the HUD and the lit instruments.
// Top bar: altitude, speed, heading tape, fuel, score, timer. Bottom strip:
// attitude indicator, altimeter, airspeed and compass dials with warm
// backlight glow, plus the throttle lever. The same dials are drawn large in
// the cockpit view's dashboard.

import { formatHeading, clamp } from './config.js';

function dial(ctx, cx, cy, r, label, drawFace) {
  ctx.save();
  ctx.translate(cx, cy);
  // Lit face: warm amber glow on a dark bezel.
  ctx.shadowColor = 'rgba(255,180,80,0.55)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#141210';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#8a7a5c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffb347';
  ctx.font = `bold ${Math.max(9, r * 0.24)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, -r - 5);
  drawFace(ctx, r);
  ctx.restore();
}

function attitudeFace(plane) {
  return (ctx, r) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate((-plane.roll * Math.PI) / 180);
    const dy = (plane.pitch / 30) * r;
    ctx.fillStyle = '#3a6ea8';
    ctx.fillRect(-r, -r + dy, r * 2, r - dy);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-r, dy, r * 2, r - dy + 2);
    ctx.strokeStyle = '#f4ede0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, dy);
    ctx.lineTo(r, dy);
    ctx.stroke();
    ctx.restore();
    // Fixed wings of the symbol.
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(-r * 0.55, -2, r * 0.35, 4);
    ctx.fillRect(r * 0.2, -2, r * 0.35, 4);
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  };
}

export function drawHud(ctx, w, h, hud, plane, camera) {
  // --- Top bar -------------------------------------------------------------
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,14,0.55)';
  ctx.fillRect(0, 0, w, 46);
  ctx.fillStyle = '#f4ede0';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`ALT  ${hud.altitudeFt.toLocaleString('en-US')} FT`, 14, 20);
  ctx.fillText(`SPD  ${hud.speedKt} KT`, 14, 38);
  ctx.fillStyle = '#9fd0ff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`VS ${hud.vspeedFpm >= 0 ? '+' : ''}${hud.vspeedFpm} FPM`, 190, 20);
  ctx.fillStyle = hud.fuel < 20 ? '#ff5a4a' : '#ffd76a';
  ctx.fillText(`FUEL ${Math.round(hud.fuel)}%`, 190, 38);
  // Compass tape across the top centre.
  const tapeW = Math.min(360, w * 0.32);
  const tapeX = w / 2 - tapeW / 2;
  ctx.fillStyle = 'rgba(10,12,14,0.55)';
  ctx.fillRect(tapeX - 8, 4, tapeW + 16, 38);
  ctx.strokeStyle = '#ffb347';
  ctx.lineWidth = 1;
  const headingDeg = ((hud.heading * 180) / Math.PI % 360 + 360) % 360;
  for (let d = -60; d <= 60; d += 10) {
    const deg = Math.round((headingDeg + d) / 10) * 10;
    const off = (deg - headingDeg) * (tapeW / 120);
    const x = w / 2 + off;
    if (x < tapeX - 4 || x > tapeX + tapeW + 4) continue;
    const major = deg % 30 === 0;
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, major ? 24 : 19);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#f4ede0';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const norm = ((deg % 360) + 360) % 360;
      const label = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm).padStart(3, '0');
      ctx.fillText(label, x, 36);
    }
  }
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`HDG ${formatHeading(hud.heading)}`, w / 2, 10);
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 5, 4);
  ctx.lineTo(w / 2 + 5, 4);
  ctx.lineTo(w / 2, 11);
  ctx.closePath();
  ctx.fill();
  // Right side: score, rings, timer.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f4ede0';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`SCORE ${hud.score}`, w - 14, 20);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`RINGS ${hud.ringsPassed}/${hud.ringsTotal}`, w - 14, 38);
  if (hud.timeLeft > 0) {
    const t = Math.max(0, Math.ceil(hud.timeLeft));
    ctx.fillStyle = t < 30 ? '#ff5a4a' : '#f4ede0';
    ctx.fillText(`TIME ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, w - 150, 38);
  }
  ctx.restore();

  // --- Centre reticle + next-ring pointer ---------------------------------
  if (hud.phase === 'flying') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,106,0.9)';
    ctx.lineWidth = 2;
    const cx = w / 2;
    const cy = camera === 'cockpit' ? h * 0.36 : h * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy);
    ctx.lineTo(cx + 20, cy);
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx, cy - 8);
    ctx.moveTo(cx, cy + 8);
    ctx.lineTo(cx, cy + 20);
    ctx.stroke();
    ctx.restore();
  }

  // --- Mission message -----------------------------------------------------
  if (hud.message) {
    ctx.save();
    ctx.font = 'bold 17px sans-serif';
    const tw = ctx.measureText(hud.message).width;
    ctx.fillStyle = 'rgba(10,12,14,0.6)';
    ctx.fillRect(w / 2 - tw / 2 - 14, 58, tw + 28, 30);
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(hud.message, w / 2, 79);
    ctx.restore();
  }

  // --- Warning flash --------------------------------------------------------
  if (hud.warning) {
    ctx.save();
    const blink = Math.sin(performance.now() / 120) > 0;
    ctx.globalAlpha = blink ? 1 : 0.35;
    ctx.fillStyle = '#ff3b2e';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠ ${hud.warning} ⚠`, w / 2, h * 0.24);
    ctx.restore();
  }

  // --- Instrument strip ------------------------------------------------------
  const stripY = camera === 'cockpit' ? h * 0.86 : h - 64;
  const r = camera === 'cockpit' ? 46 : 34;
  const gap = r * 2 + 26;
  const totalW = gap * 4 + 150;
  let x = (w - totalW) / 2 + r + 10;
  if (camera === 'chase' && w < 760) return; // small window: keep the sky clean
  dial(ctx, x, stripY, r, 'ATTITUDE', attitudeFace(plane));
  x += gap;
  dial(ctx, x, stripY, r, 'ALTIMETER', (c, rr) => {
    c.fillStyle = '#eaf6ff';
    c.font = `bold ${rr * 0.42}px sans-serif`;
    c.textAlign = 'center';
    c.fillText(String(Math.round(hud.altitudeFt / 100)), 0, rr * 0.16);
    c.fillStyle = '#9fd0ff';
    c.font = `${rr * 0.24}px sans-serif`;
    c.fillText('x100 FT', 0, rr * 0.5);
  });
  x += gap;
  dial(ctx, x, stripY, r, 'AIRSPEED', (c, rr) => {
    c.fillStyle = '#eaf6ff';
    c.font = `bold ${rr * 0.42}px sans-serif`;
    c.textAlign = 'center';
    c.fillText(String(hud.speedKt), 0, rr * 0.16);
    c.fillStyle = '#9fd0ff';
    c.font = `${rr * 0.24}px sans-serif`;
    c.fillText('KNOTS', 0, rr * 0.5);
  });
  x += gap;
  dial(ctx, x, stripY, r, 'COMPASS', (c, rr) => {
    c.save();
    c.rotate(-hud.heading);
    c.fillStyle = '#eaf6ff';
    c.font = `bold ${rr * 0.34}px sans-serif`;
    c.textAlign = 'center';
    c.fillText('N', 0, -rr * 0.55);
    c.fillText('S', 0, rr * 0.72);
    c.fillText('E', rr * 0.62, rr * 0.12);
    c.fillText('W', -rr * 0.62, rr * 0.12);
    c.restore();
    c.fillStyle = '#ffd76a';
    c.beginPath();
    c.moveTo(0, -rr * 0.92);
    c.lineTo(-5, -rr * 0.72);
    c.lineTo(5, -rr * 0.72);
    c.closePath();
    c.fill();
  });
  // Throttle lever.
  const tx = x + gap * 0.75;
  const ty = stripY - r;
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,14,0.6)';
  ctx.fillRect(tx - 14, ty - 6, 28, r * 2 + 12);
  ctx.fillStyle = '#2a2f33';
  ctx.fillRect(tx - 3, ty, 6, r * 2);
  const leverY = ty + r * 2 - hud.throttle * r * 2;
  ctx.fillStyle = '#ffb347';
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 8;
  ctx.fillRect(tx - 10, leverY - 4, 20, 8);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', tx, ty - 12);
  ctx.fillText(`${Math.round(hud.throttle * 100)}%`, tx, ty + r * 2 + 22);
  ctx.restore();
}
