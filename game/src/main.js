// Ember Valley — Sky Courier: the game loop, screens and screenshot staging.
// Owns the canvas, the clock, the menu / pause / end screens and the
// ?shot= staging the screenshots are taken from. Flight lives in flight.js,
// the picture in render.js, the instruments in hud.js.

import { GAME_TITLE, GAME_SUBTITLE, PLANE_NAME, MISSIONS, missionById } from './config.js';
import { FlightGame, PHASE } from './flight.js';
import { Renderer } from './render.js';
import { drawHud } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot') || '';
const SEED = Number(params.get('seed') || '1');

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const sounds = new SoundBank();
const game = new FlightGame();

let camera = 'chase';
let time = 0;
let last = performance.now();
let menuIndex = 0;
let demoTime = 0;

function resize() {
  const w = Math.min(window.innerWidth, 1600);
  const h = Math.min(window.innerHeight, 1000);
  renderer.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

// --- Screenshot staging ----------------------------------------------------
// ?shot=start  title menu over the valley at dawn light
// ?shot=play   mid-flight: ring ahead, runway in sight, instruments lit
// ?shot=cockpit cockpit view, ring ahead, big lit dials
// ?shot=end   wheels on the runway, delivery complete
function stageShot() {
  if (!SHOT) return;
  if (SHOT === 'start') {
    game.toMenu();
    game.plane.y = 210;
    game.plane.z = -1500;
    game.plane.speed = 62;
    return;
  }
  if (SHOT === 'play' || SHOT === 'cockpit') {
    game.startMission('ringRun');
    const p = game.plane;
    p.x = 10;
    p.y = 90;
    p.z = 120;
    p.heading = 0.02;
    p.pitch = -2;
    p.roll = -3;
    p.speed = 64;
    p.throttle = 0.68;
    p.fuel = 85;
    game.score = 0;
    game.ringsPassed = 0;
    game.ringIndex = 0;
    game.say('Ring 1 of 8 — thread the gold ring!', 30);
    if (SHOT === 'cockpit') camera = 'cockpit';
    return;
  }
  if (SHOT === 'end') {
    game.startMission('courier');
    const p = game.plane;
    p.x = 0;
    p.y = 3;
    p.z = 60;
    p.heading = 0;
    p.pitch = 0;
    p.roll = 0;
    p.speed = 12;
    p.throttle = 0.1;
    p.onGround = true;
    game.ringsPassed = 2;
    game.ringIndex = 2;
    game.score = 1250;
    game.phase = PHASE.COMPLETE;
    game.say('DELIVERED — the mail is home at Amberford Field!', 30);
  }
}
stageShot();

// Menu backdrop: a slow autopilot drift so the title screen is alive.
function menuDrift(dt) {
  demoTime += dt;
  const p = game.plane;
  p.heading = Math.sin(demoTime * 0.05) * 0.35;
  p.roll = Math.sin(demoTime * 0.05) * 10;
  p.pitch = 1.5 + Math.sin(demoTime * 0.3) * 0.8;
  p.y = 200 + Math.sin(demoTime * 0.2) * 12;
  p.z = -1500 + Math.sin(demoTime * 0.05) * 120;
  p.speed = 62;
  p.throttle = 0.6;
}

function drainEvents() {
  for (const ev of game.events) {
    if (ev === 'ring') sounds.ring();
    if (ev === 'land') sounds.thud();
    if (ev === 'crash') sounds.crash();
    if (ev === 'complete') sounds.fanfare();
    if (ev === 'stall') sounds.stallWarn();
  }
  game.events = [];
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  const ctx = renderer.canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Global keys.
  if (input.consume('KeyM')) sounds.toggleMute();
  if (input.consume('KeyC') && game.phase === PHASE.FLYING) {
    camera = camera === 'chase' ? 'cockpit' : 'chase';
  }

  if (game.phase === PHASE.MENU) {
    menuDrift(dt);
    if (input.consume('Digit1')) { sounds.unlock(); sounds.click(); game.startMission('ringRun'); }
    if (input.consume('Digit2')) { sounds.unlock(); sounds.click(); game.startMission('courier'); }
    if (input.consume('Digit3')) { sounds.unlock(); sounds.click(); game.startMission('ridgeDash'); }
    if (input.consume('Enter') || input.consume('Space')) {
      sounds.unlock(); sounds.click(); game.startMission(MISSIONS[menuIndex].id);
    }
    const down = input.consume('ArrowDown');
    const up = input.consume('ArrowUp');
    if (down || up) {
      menuIndex = (menuIndex + (down ? 1 : MISSIONS.length - 1)) % MISSIONS.length;
      sounds.click();
    }
  } else if (game.phase === PHASE.FLYING) {
    if (input.consume('KeyP') || input.consume('Escape')) game.phase = PHASE.PAUSED;
    if (input.consume('KeyR')) game.restart();
    const cmd = input.flightCommand();
    game.update(cmd, dt);
    sounds.update(game.plane.throttle, game.plane.speed, true);
    drainEvents();
  } else if (game.phase === PHASE.PAUSED) {
    if (input.consume('KeyP') || input.consume('Escape') || input.consume('Enter')) {
      game.phase = PHASE.FLYING;
    }
    if (input.consume('KeyR')) game.restart();
    if (input.consume('KeyQ')) game.toMenu();
  } else {
    // LANDED / CRASHED / COMPLETE: idle scene, keys to go again.
    sounds.update(0, 0, false);
    if (input.consume('KeyR') || input.consume('Enter') || input.consume('Space')) {
      sounds.click();
      game.restart();
    }
    if (input.consume('KeyQ') || input.consume('Escape')) game.toMenu();
  }

  // --- Draw -----------------------------------------------------------------
  renderer.render({
    plane: game.plane,
    mission: game.mission,
    ringIndex: game.ringIndex,
    camera,
    time,
    hidePlane: game.phase === PHASE.MENU,
  });

  const hud = game.hudState();
  if (game.phase !== PHASE.MENU) {
    drawHud(ctx, w, h, hud, game.plane, camera);
  }
  if (game.phase === PHASE.MENU) drawMenu(ctx, w, h);
  if (game.phase === PHASE.PAUSED) drawOverlay(ctx, w, h, 'PAUSED', 'P / Esc resume · R restart · Q menu');
  if (game.phase === PHASE.CRASHED) {
    drawOverlay(ctx, w, h, 'CRASHED', `${game.message}  Score ${game.score} · R fly again · Q menu`);
  }
  if (game.phase === PHASE.COMPLETE) {
    drawOverlay(
      ctx, w, h, 'MISSION COMPLETE',
      `${game.mission.name} — Score ${game.score} · Best ${game.best[game.mission.id] || game.score} · R fly again · Q menu`,
    );
  }
  if (game.phase === PHASE.LANDED) {
    drawOverlay(ctx, w, h, 'LANDED SAFELY', `Score ${game.score} · R fly again · Q menu`);
  }

  requestAnimationFrame(frame);
}

function drawMenu(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(12,16,22,0.52)';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('M A K E . F U N   P R E S E N T S', cx, h * 0.2);
  ctx.fillStyle = '#f7f1e3';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText(GAME_TITLE, cx, h * 0.2 + 64);
  ctx.fillStyle = '#ffb347';
  ctx.font = 'italic bold 30px Georgia, serif';
  ctx.fillText(GAME_SUBTITLE, cx, h * 0.2 + 104);
  ctx.fillStyle = '#e8ddc4';
  ctx.font = '16px sans-serif';
  ctx.fillText(`Fly the ${PLANE_NAME} over the valley. Thread the rings. Bring the mail home.`, cx, h * 0.2 + 138);

  // Mission cards.
  const cardW = Math.min(560, w * 0.72);
  const cardH = 64;
  const top = h * 0.2 + 168;
  MISSIONS.forEach((m, i) => {
    const y = top + i * (cardH + 12);
    const selected = i === menuIndex;
    ctx.fillStyle = selected ? 'rgba(255,183,71,0.95)' : 'rgba(16,20,24,0.93)';
    ctx.strokeStyle = selected ? '#ffd76a' : '#5a5348';
    ctx.lineWidth = selected ? 3 : 1;
    roundRect(ctx, cx - cardW / 2, y, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = selected ? '#241a08' : '#f4ede0';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${m.key}. ${m.name} — ${m.tag}`, cx - cardW / 2 + 18, y + 26);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = selected ? '#4a3410' : '#c9bda6';
    ctx.fillText(m.goal, cx - cardW / 2 + 18, y + 48);
    const best = game.best[m.id];
    if (best) {
      ctx.textAlign = 'right';
      ctx.fillStyle = selected ? '#4a3410' : '#ffd76a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`BEST ${best}`, cx + cardW / 2 - 16, y + 26);
    }
  });

  ctx.fillStyle = '#e8ddc4';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  const controlsY = top + MISSIONS.length * (cardH + 12) + 26;
  ctx.fillText('↑ ↓ pitch · ← → bank · W / S throttle · mouse banks · wheel throttle · C camera · P pause · M mute', cx, controlsY);
  ctx.fillText('Press 1 / 2 / 3 or Enter to fly. Land gentle on runway 18 at Amberford Field.', cx, controlsY + 24);
  ctx.fillStyle = '#9fb4c4';
  ctx.font = '12px sans-serif';
  ctx.fillText('Original game: art, sound and music made in code. No network, no downloads.', cx, h - 18);
  ctx.restore();
}

function drawOverlay(ctx, w, h, title, sub) {
  ctx.save();
  ctx.fillStyle = 'rgba(12,16,22,0.5)';
  ctx.fillRect(0, h * 0.32, w, 150);
  ctx.textAlign = 'center';
  ctx.fillStyle = title === 'CRASHED' ? '#ff6a5a' : '#ffd76a';
  ctx.font = 'bold 46px Georgia, serif';
  ctx.fillText(title, w / 2, h * 0.32 + 62);
  ctx.fillStyle = '#f4ede0';
  ctx.font = '16px sans-serif';
  ctx.fillText(sub, w / 2, h * 0.32 + 104);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Mouse: clicking a mission card starts it.
canvas.addEventListener('click', (e) => {
  sounds.unlock();
  if (game.phase !== PHASE.MENU) return;
  const rect = canvas.getBoundingClientRect();
  const my = e.clientY - rect.top;
  const cardW = Math.min(560, canvas.width * 0.72);
  const cardH = 64;
  const top = canvas.height * 0.2 + 168;
  MISSIONS.forEach((m, i) => {
    const y = top + i * (cardH + 12);
    const x0 = canvas.width / 2 - cardW / 2;
    if (e.clientX - rect.left >= x0 && e.clientX - rect.left <= x0 + cardW && my >= y && my <= y + cardH) {
      sounds.click();
      game.startMission(m.id);
    }
  });
});

// Debug/test hook: the page's own state, readable from the console.
window.__emberValley = { game, get camera() { return camera; } };

requestAnimationFrame(frame);
