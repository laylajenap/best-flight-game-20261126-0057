// Ember Valley — Sky Courier: the picture.
// A hand-rolled pseudo-3D renderer on one 2D canvas: golden-hour sky, a
// projected heightfield valley with fields, river, road and town, the
// runway, glowing target rings, and the Kestrel-9 herself — chase view or
// cockpit view. No images, no libraries: every pixel is drawn from code.

import { RUNWAY, degToRad, clamp, lerp } from './config.js';
import { groundHeight, groundColor, treeAt, BUILDINGS } from './terrain.js';

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

// Fixed cloud puffs, placed once so they never jump between frames.
const CLOUDS = [];
for (let i = 0; i < 26; i++) {
  CLOUDS.push({
    x: ((i * 733) % 3400) - 1700,
    y: 300 + ((i * 197) % 130),
    z: -((i * 911) % 3600) + 500,
    s: 90 + ((i * 131) % 130),
  });
}

class Projector {
  constructor(w, h, plane, camera) {
    this.w = w;
    this.h = h;
    this.focal = (h * 0.5) / Math.tan(degToRad(32));
    this.horizonY = h * 0.44;
    const heading = plane.heading;
    this.fx = Math.sin(heading);
    this.fz = -Math.cos(heading);
    this.rx = Math.cos(heading);
    this.rz = Math.sin(heading);
    // Camera sits behind and above the plane, looking where it is going.
    const back = camera === 'cockpit' ? 2 : 26;
    const up = camera === 'cockpit' ? 1.6 : 7;
    this.cx = plane.x - this.fx * back;
    this.cy = plane.y + up;
    this.cz = plane.z - this.fz * back;
    // Camera pitch: look slightly down, more when the nose is down.
    this.pitch = degToRad(3 + plane.pitch * 0.35);
    this.cp = Math.cos(this.pitch);
    this.sp = Math.sin(this.pitch);
  }

  project(x, y, z) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    const dz = z - this.cz;
    let cz = dx * this.fx + dz * this.fz;
    let cx = dx * this.rx + dz * this.rz;
    let cy = dy;
    // Rotate by camera pitch around the right axis.
    const cy2 = cy * this.cp - cz * this.sp;
    const cz2 = cy * this.sp + cz * this.cp;
    cz = cz2;
    cy = cy2;
    if (cz < 3) return null;
    const s = this.focal / cz;
    return { x: this.w / 2 + cx * s, y: this.horizonY - cy * s, s, d: cz };
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  render(view) {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const plane = view.plane;
    const proj = new Projector(w, h, plane, view.camera);
    this.drawSky(ctx, w, h, plane);
    this.drawClouds(ctx, proj, plane);
    this.drawTerrain(ctx, proj, plane);
    this.drawRunway(ctx, proj, plane);
    this.drawTown(ctx, proj);
    this.drawRings(ctx, proj, view);
    if (view.camera === 'chase') {
      if (!view.hidePlane) this.drawPlane(ctx, w, h, plane, proj, view.time);
    } else {
      this.drawCockpitFrame(ctx, w, h, plane, view.time);
    }
  }

  drawSky(ctx, w, h, plane) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#274b73');
    g.addColorStop(0.38, '#6f9cc0');
    g.addColorStop(0.55, '#e8b878');
    g.addColorStop(0.62, '#f6cf96');
    g.addColorStop(1, '#8a6a4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Low golden sun in the west.
    const sunX = w * 0.78;
    const sunY = h * 0.34;
    const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120);
    sg.addColorStop(0, 'rgba(255,236,180,0.95)');
    sg.addColorStop(0.25, 'rgba(255,205,120,0.55)');
    sg.addColorStop(1, 'rgba(255,205,120,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
    ctx.fill();
    // Far mountain silhouette along the horizon.
    ctx.fillStyle = 'rgba(74,88,110,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.46);
    for (let x = 0; x <= w; x += 24) {
      const y =
        h * 0.46 -
        (Math.sin(x * 0.006 + 1.2) * 26 + Math.sin(x * 0.017 + 4.0) * 12 + 14);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h * 0.46);
    ctx.closePath();
    ctx.fill();
  }

  drawClouds(ctx, proj, plane) {
    ctx.save();
    for (const c of CLOUDS) {
      // Wrap clouds around the plane so the sky never runs out.
      let z = c.z;
      while (z - plane.z > 1800) z -= 3600;
      while (z - plane.z < -1800) z += 3600;
      const p = proj.project(c.x, c.y, z);
      if (!p || p.d > 2400 || p.y < 56) continue; // keep clouds out of the HUD bar
      const s = c.s * p.s * 0.9;
      if (s < 4) continue;
      ctx.fillStyle = 'rgba(255,250,240,0.85)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s, s * 0.36, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - s * 0.55, p.y + s * 0.08, s * 0.6, s * 0.28, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + s * 0.55, p.y + s * 0.06, s * 0.62, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawTerrain(ctx, proj, plane) {
    const step = 40;
    const fwdMax = 1150;
    const sideMax = 750;
    // Far rows first so near ground overdraws them.
    for (let df = fwdMax; df >= -80; df -= step) {
      for (let dr = -sideMax; dr < sideMax; dr += step) {
        const corners = [];
        let ok = true;
        for (const [a, b] of [[0, 0], [step, 0], [step, step], [0, step]]) {
          const wx = proj.cx + proj.fx * (df + a) + proj.rx * (dr + b);
          const wz = proj.cz + proj.fz * (df + a) + proj.rz * (dr + b);
          const wy = groundHeight(wx, wz);
          const p = proj.project(wx, wy, wz);
          if (!p) {
            ok = false;
            break;
          }
          corners.push(p);
        }
        if (!ok) continue;
        const cxw = proj.cx + proj.fx * (df + step / 2) + proj.rx * (dr + step / 2);
        const czw = proj.cz + proj.fz * (df + step / 2) + proj.rz * (dr + step / 2);
        const ch = groundHeight(cxw, czw);
        const slope = Math.abs(
          groundHeight(cxw + step, czw) - groundHeight(cxw - step, czw),
        ) / (2 * step);
        let col = groundColor(cxw, czw, ch, slope);
        // Distance haze toward the horizon colour.
        const haze = clamp((df - 500) / 900, 0, 0.55);
        if (haze > 0) col = mixHex(col, '#d9b98c', haze);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.fill();
        // A tree here and there, drawn as a small dark-green cone.
        const ix = Math.round(cxw / step);
        const iz = Math.round(czw / step);
        const th = treeAt(ix, iz);
        if (th > 0 && df < 700) {
          const tp = proj.project(cxw, ch, czw);
          if (tp) {
            const ts = th * tp.s * 0.9;
            ctx.fillStyle = '#2f4d24';
            ctx.beginPath();
            ctx.moveTo(tp.x, tp.y - ts);
            ctx.lineTo(tp.x - ts * 0.45, tp.y);
            ctx.lineTo(tp.x + ts * 0.45, tp.y);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
  }

  drawRunway(ctx, proj, plane) {
    // The strip, in 20 m segments so it follows the ground.
    for (let z = RUNWAY.zMin; z < RUNWAY.zMax; z += 20) {
      const a = proj.project(RUNWAY.x - RUNWAY.halfWidth, 2.2, z);
      const b = proj.project(RUNWAY.x + RUNWAY.halfWidth, 2.2, z);
      const c = proj.project(RUNWAY.x + RUNWAY.halfWidth, 2.2, z + 20);
      const d = proj.project(RUNWAY.x - RUNWAY.halfWidth, 2.2, z + 20);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = '#3a3f46';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      // Centreline dash.
      if (Math.floor(z / 40) % 2 === 0) {
        const e = proj.project(RUNWAY.x - 0.8, 2.4, z + 4);
        const f = proj.project(RUNWAY.x + 0.8, 2.4, z + 4);
        const g = proj.project(RUNWAY.x + 0.8, 2.4, z + 16);
        const hh = proj.project(RUNWAY.x - 0.8, 2.4, z + 16);
        if (e && f && g && hh) {
          ctx.fillStyle = '#f2f2e8';
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(f.x, f.y);
          ctx.lineTo(g.x, g.y);
          ctx.lineTo(hh.x, hh.y);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Edge lights, glowing amber.
      for (const side of [-1, 1]) {
        const lp = proj.project(RUNWAY.x + side * (RUNWAY.halfWidth + 2), 3, z);
        if (lp && lp.d < 900) {
          ctx.fillStyle = '#ffb347';
          ctx.shadowColor = '#ff9a1f';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(lp.x, lp.y, Math.max(1.5, 90 / lp.d), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }
    // Threshold bars at both ends.
    for (const z of [RUNWAY.zMin + 6, RUNWAY.zMax - 14]) {
      const a = proj.project(RUNWAY.x - 10, 2.4, z);
      const b = proj.project(RUNWAY.x + 10, 2.4, z);
      const c = proj.project(RUNWAY.x + 10, 2.4, z + 8);
      const d = proj.project(RUNWAY.x - 10, 2.4, z + 8);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = '#f2f2e8';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawTown(ctx, proj) {
    for (const b of BUILDINGS) {
      const y0 = groundHeight(b.x, b.z);
      const y1 = y0 + b.h;
      const pts = [];
      let ok = true;
      for (const [ox, oz] of [
        [-b.w / 2, -b.d / 2],
        [b.w / 2, -b.d / 2],
        [b.w / 2, b.d / 2],
        [-b.w / 2, b.d / 2],
      ]) {
        const p0 = proj.project(b.x + ox, y0, b.z + oz);
        const p1 = proj.project(b.x + ox, y1, b.z + oz);
        if (!p0 || !p1) {
          ok = false;
          break;
        }
        pts.push([p0, p1]);
      }
      if (!ok) continue;
      if (pts[0][1].d > 1300) continue;
      // Two visible walls + roof.
      const wall = (i, j, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(pts[i][0].x, pts[i][0].y);
        ctx.lineTo(pts[j][0].x, pts[j][0].y);
        ctx.lineTo(pts[j][1].x, pts[j][1].y);
        ctx.lineTo(pts[i][1].x, pts[i][1].y);
        ctx.closePath();
        ctx.fill();
      };
      wall(0, 1, '#b99c72');
      wall(1, 2, '#8f7a5c');
      ctx.fillStyle = b.roof ? '#a34d3a' : '#6d6a63';
      ctx.beginPath();
      ctx.moveTo(pts[0][1].x, pts[0][1].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][1].x, pts[i][1].y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawRings(ctx, proj, view) {
    const rings = view.mission.rings;
    rings.forEach((ring, i) => {
      const passed = i < view.ringIndex;
      const isNext = i === view.ringIndex;
      if (passed && !isNext) return;
      const [rx, ry, rz] = ring;
      const c = proj.project(rx, ry, rz);
      if (!c || c.d > 1500) return;
      // Ring plane: vertical, facing the plane's direction of travel.
      const nx = Math.sin(view.plane.heading);
      const nz = -Math.cos(view.plane.heading);
      const tx = -nz;
      const tz = nx;
      const R = 18;
      const N = 28;
      const pts = [];
      for (let k = 0; k <= N; k++) {
        const a = (k / N) * Math.PI * 2;
        const px = rx + tx * Math.cos(a) * R;
        const py = ry + Math.sin(a) * R;
        const pz = rz + tz * Math.cos(a) * R;
        const p = proj.project(px, py, pz);
        pts.push(p);
      }
      if (pts.some((p) => !p)) return;
      const glow = isNext ? (0.75 + 0.25 * Math.sin(view.time * 5)) : 0.35;
      ctx.save();
      ctx.globalAlpha = isNext ? 1 : 0.55;
      ctx.strokeStyle = isNext ? '#ffc93a' : '#e08a3c';
      ctx.lineWidth = Math.max(2, 260 / c.d);
      ctx.shadowColor = '#ffbe2e';
      ctx.shadowBlur = isNext ? 18 * glow + 6 : 4;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k <= N; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      // Distance tag above the next ring.
      if (isNext && c.d < 900) {
        ctx.fillStyle = '#ffe9a8';
        ctx.font = `bold ${Math.max(11, Math.min(18, 3200 / c.d))}px sans-serif`;
        ctx.textAlign = 'center';
        const topY = Math.min(...pts.map((q) => q.y));
        ctx.fillText(`${Math.round(c.d)} m`, c.x, topY - 12);
      }
    });
  }

  drawPlane(ctx, w, h, plane, proj, time) {
    // Soft shadow on the ground below the plane.
    const ground = groundHeight(plane.x, plane.z);
    const sh = proj.project(plane.x, ground + 1, plane.z);
    if (sh && sh.d > 0) {
      const spread = clamp(900 / Math.max(30, plane.y - ground), 6, 60);
      ctx.fillStyle = 'rgba(20,20,16,0.30)';
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, spread, spread * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const cx = w / 2;
    const cy = h * 0.62 + plane.pitch * 1.6;
    const S = Math.min(w, h) / 720; // scale for the plane sprite
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(degToRad(-plane.roll));
    ctx.scale(S, S);
    // Main wings.
    ctx.fillStyle = '#d8433a';
    ctx.beginPath();
    ctx.moveTo(-150, 6);
    ctx.quadraticCurveTo(-60, -14, 0, -8);
    ctx.quadraticCurveTo(60, -14, 150, 6);
    ctx.quadraticCurveTo(60, 14, 0, 12);
    ctx.quadraticCurveTo(-60, 14, -150, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4ede0';
    ctx.fillRect(-150, 2, 300, 5);
    // Fuselage, seen from behind: tail cone widening toward the viewer.
    const fg = ctx.createLinearGradient(0, -70, 0, 60);
    fg.addColorStop(0, '#f7f1e3');
    fg.addColorStop(0.6, '#e8ddc4');
    fg.addColorStop(1, '#c9b892');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-16, -64);
    ctx.quadraticCurveTo(-26, 10, -20, 58);
    ctx.quadraticCurveTo(0, 68, 20, 58);
    ctx.quadraticCurveTo(26, 10, 16, -64);
    ctx.quadraticCurveTo(0, -74, -16, -64);
    ctx.closePath();
    ctx.fill();
    // Cheatline stripe.
    ctx.fillStyle = '#d8433a';
    ctx.fillRect(-19, 18, 38, 7);
    // Tail fin.
    ctx.fillStyle = '#d8433a';
    ctx.beginPath();
    ctx.moveTo(-4, -58);
    ctx.lineTo(0, -96);
    ctx.lineTo(10, -58);
    ctx.closePath();
    ctx.fill();
    // Horizontal stabiliser.
    ctx.fillStyle = '#b8322a';
    ctx.beginPath();
    ctx.moveTo(-58, -42);
    ctx.quadraticCurveTo(0, -52, 58, -42);
    ctx.quadraticCurveTo(0, -32, -58, -42);
    ctx.closePath();
    ctx.fill();
    // Spinning prop hint at the far nose.
    const propA = (time * 22) % Math.PI;
    ctx.strokeStyle = 'rgba(60,50,40,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -66, 26, 6 + 20 * Math.abs(Math.sin(propA)), propA, 0, Math.PI * 2);
    ctx.stroke();
    // Wingtip nav lights: red port, green starboard, blinking.
    const blink = Math.sin(time * 6) > 0;
    ctx.fillStyle = '#ff2e2e';
    ctx.shadowColor = '#ff2e2e';
    ctx.shadowBlur = blink ? 14 : 3;
    ctx.beginPath();
    ctx.arc(-150, 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2eff5e';
    ctx.shadowColor = '#2eff5e';
    ctx.beginPath();
    ctx.arc(150, 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Registration on the wing.
    ctx.fillStyle = '#5a3a28';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KESTREL-9', 0, 4);
    ctx.restore();
    // Engine exhaust shimmer.
    ctx.fillStyle = 'rgba(255,170,80,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 52 * S, 10 * S, 16 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCockpitFrame(ctx, w, h, plane, time) {
    // Canopy struts.
    ctx.fillStyle = '#1c1a17';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.12, 0);
    ctx.lineTo(w * 0.2, h * 0.62);
    ctx.lineTo(w * 0.08, h * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w * 0.88, 0);
    ctx.lineTo(w * 0.8, h * 0.62);
    ctx.lineTo(w * 0.92, h * 0.62);
    ctx.closePath();
    ctx.fill();
    // Nose cone over the windscreen bottom.
    ctx.fillStyle = '#e8ddc4';
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h);
    ctx.quadraticCurveTo(w * 0.5, h * 0.58, w * 0.58, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d8433a';
    ctx.beginPath();
    ctx.moveTo(w * 0.47, h);
    ctx.quadraticCurveTo(w * 0.5, h * 0.72, w * 0.53, h);
    ctx.closePath();
    ctx.fill();
    // Dashboard: dark panel with a warm glow along its top edge.
    const dg = ctx.createLinearGradient(0, h * 0.62, 0, h);
    dg.addColorStop(0, '#241f1a');
    dg.addColorStop(0.12, '#17130f');
    dg.addColorStop(1, '#0d0b09');
    ctx.fillStyle = dg;
    ctx.fillRect(0, h * 0.66, w, h * 0.34);
    ctx.fillStyle = 'rgba(255,190,90,0.35)';
    ctx.fillRect(0, h * 0.66, w, 3);
    // Wingtips peeking past the canopy edges.
    ctx.fillStyle = '#d8433a';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.78);
    ctx.lineTo(w * 0.1, h * 0.74);
    ctx.lineTo(w * 0.1, h * 0.8);
    ctx.lineTo(0, h * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, h * 0.78);
    ctx.lineTo(w * 0.9, h * 0.74);
    ctx.lineTo(w * 0.9, h * 0.8);
    ctx.lineTo(w, h * 0.86);
    ctx.closePath();
    ctx.fill();
  }
}
