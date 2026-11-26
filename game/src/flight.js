// Ember Valley — Sky Courier: the flight model and the mission state machine.
// Arcade physics with real trade-offs: throttle sets target speed, banking
// turns the nose, pitch trades speed for altitude, and a slow wing stalls.
// Rings, landings, fuel, crashes and the timer all live here — the renderer
// only draws what this module decides.

import { FLIGHT, RUNWAY, missionById, clamp, degToRad, radToDeg, wrapAngle } from './config.js';
import { groundHeight, isRunway } from './terrain.js';

export const PHASE = {
  MENU: 'menu',
  FLYING: 'flying',
  PAUSED: 'paused',
  LANDED: 'landed',
  CRASHED: 'crashed',
  COMPLETE: 'complete',
};

export function newPlane() {
  return {
    x: 0,
    y: 130,
    z: -1150,
    heading: 0, // north, toward the runway
    pitch: 0, // deg, + nose up
    roll: 0, // deg, + right wing down
    speed: 58, // m/s
    throttle: 0.6,
    fuel: FLIGHT.fuelStart,
    vspeed: 0, // m/s, + climbing
    onGround: false,
    gearDown: true,
  };
}

export class FlightGame {
  constructor() {
    this.phase = PHASE.MENU;
    this.mission = missionById('ringRun');
    this.plane = newPlane();
    this.score = 0;
    this.ringsPassed = 0;
    this.ringIndex = 0;
    this.time = 0;
    this.timeLeft = 0;
    this.message = '';
    this.messageUntil = 0;
    this.warning = '';
    this.stallWarnedAt = -10;
    this.best = this.loadBest();
    this.events = []; // one-frame events the loop consumes: 'ring' | 'land' | 'crash' | 'complete' | 'stall'
  }

  loadBest() {
    try {
      const raw = window.localStorage.getItem('ember-valley-best');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  saveBest() {
    try {
      const prev = this.best[this.mission.id] || 0;
      if (this.score > prev) {
        this.best[this.mission.id] = this.score;
        window.localStorage.setItem('ember-valley-best', JSON.stringify(this.best));
      }
    } catch {
      /* storage unavailable: best score just is not kept */
    }
  }

  startMission(id) {
    this.mission = missionById(id);
    this.plane = newPlane();
    this.score = 0;
    this.ringsPassed = 0;
    this.ringIndex = 0;
    this.time = 0;
    this.timeLeft = this.mission.timeLimit;
    this.phase = PHASE.FLYING;
    this.events = [];
    this.say(`${this.mission.name} — ${this.mission.goal}`, 6);
  }

  restart() {
    this.startMission(this.mission.id);
  }

  toMenu() {
    this.phase = PHASE.MENU;
    this.plane = newPlane();
    this.events = [];
  }

  say(text, seconds = 3) {
    this.message = text;
    this.messageUntil = this.time + seconds;
  }

  nextRing() {
    return this.mission.rings[this.ringIndex] || null;
  }

  ringsLeft() {
    return this.mission.rings.length - this.ringIndex;
  }

  // input: {pitch: -1..1, roll: -1..1, throttle: -1..1} per frame, dt seconds.
  update(input, dt) {
    if (this.phase !== PHASE.FLYING) return;
    const p = this.plane;
    this.time += dt;

    if (this.mission.timeLimit > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endCrash('OUT OF TIME — the Ridge Dash clock ran out.');
        return;
      }
    }

    // Throttle: W/S nudge it, it stays where you leave it.
    p.throttle = clamp(p.throttle + input.throttle * dt * 0.55, 0, 1);

    // Pitch and roll ease toward the commanded values.
    const pitchTarget = input.pitch * FLIGHT.maxPitchDeg;
    const rollTarget = input.roll * FLIGHT.maxRollDeg;
    p.pitch += clamp(pitchTarget - p.pitch, -FLIGHT.pitchRate * dt, FLIGHT.pitchRate * dt);
    p.roll += clamp(rollTarget - p.roll, -FLIGHT.rollRate * dt, FLIGHT.rollRate * dt);

    // Banking turns the nose; a steep bank without speed loses lift.
    p.heading += degToRad(p.roll) * degToRad(FLIGHT.turnRate) * dt * (p.speed / FLIGHT.cruiseSpeed);
    p.heading = wrapAngle(p.heading);

    // Speed chases the throttle's target; climbing and banking bleed it.
    const targetSpeed = FLIGHT.minSpeed + p.throttle * (FLIGHT.maxSpeed - FLIGHT.minSpeed);
    let speedTarget = targetSpeed;
    if (p.pitch > 0) speedTarget -= p.pitch * 0.55;
    if (p.pitch < 0) speedTarget += -p.pitch * 0.35;
    speedTarget -= Math.abs(p.roll) * 0.12;
    p.speed += clamp(speedTarget - p.speed, -FLIGHT.accel * dt, FLIGHT.accel * 0.6 * dt);

    // Stall: below stall speed the wing quits and the nose drops.
    const stalled = p.speed < FLIGHT.stallSpeed && p.pitch > 2;
    if (stalled) {
      p.pitch = Math.max(p.pitch - 30 * dt, -12);
      p.speed = Math.max(p.speed - 6 * dt, FLIGHT.minSpeed);
      if (this.time - this.stallWarnedAt > 2.5) {
        this.stallWarnedAt = this.time;
        this.events.push('stall');
      }
    }

    // Vertical speed from pitch; a fast descent builds speed, a climb costs it.
    const pitchRad = degToRad(p.pitch);
    p.vspeed = p.speed * Math.sin(pitchRad) * FLIGHT.climbFactor;
    if (stalled) p.vspeed -= 6;

    const fx = Math.sin(p.heading);
    const fz = -Math.cos(p.heading);
    p.x += fx * p.speed * Math.cos(pitchRad) * dt;
    p.z += fz * p.speed * Math.cos(pitchRad) * dt;
    p.y += p.vspeed * dt;

    // Fuel burns with throttle; empty tanks glide you down, they do not stop you.
    p.fuel = Math.max(0, p.fuel - p.throttle * FLIGHT.fuelBurn * dt);
    if (p.fuel <= 0 && p.throttle > 0.15) p.throttle = 0.15;

    // Stay inside the valley.
    p.x = clamp(p.x, -1900, 1900);
    p.z = clamp(p.z, -2100, 700);

    this.checkRings();
    this.checkGround();
    this.updateWarning();
    if (this.time > this.messageUntil) this.message = '';
  }

  checkRings() {
    const ring = this.nextRing();
    if (!ring) return;
    const p = this.plane;
    const dx = p.x - ring[0];
    const dy = p.y - ring[1];
    const dz = p.z - ring[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 20) {
      this.ringIndex++;
      this.ringsPassed++;
      this.score += 250;
      this.plane.fuel = Math.min(FLIGHT.fuelStart, this.plane.fuel + FLIGHT.ringFuelBonus);
      this.events.push('ring');
      if (this.ringIndex >= this.mission.rings.length) {
        if (this.mission.needsLanding) {
          this.say('All rings flown! Now land on runway 18.', 5);
        } else {
          this.completeMission();
        }
      } else {
        this.say(`Ring ${this.ringsPassed} of ${this.mission.rings.length} — +250 pts, +fuel`, 2.5);
      }
    }
  }

  checkGround() {
    const p = this.plane;
    const ground = groundHeight(p.x, p.z);
    if (p.y <= ground + 2.5) {
      p.y = ground + 2.5;
      const onStrip = isRunway(p.x, p.z);
      const gentle = p.vspeed > FLIGHT.hardLandingVs;
      const slowEnough = p.speed < 46; // ~90 kt
      const level = Math.abs(p.roll) < 12 && Math.abs(p.pitch) < 10;
      if (onStrip && gentle && slowEnough && level) {
        this.land();
      } else if (onStrip && !gentle) {
        this.endCrash('HARD LANDING — you came down too fast for the gear.');
      } else if (onStrip && !slowEnough) {
        this.endCrash('TOO FAST — you overshot the runway at landing speed.');
      } else {
        this.endCrash('TERRAIN — the valley floor is not a runway.');
      }
    }
  }

  land() {
    const p = this.plane;
    p.onGround = true;
    p.speed = Math.max(0, p.speed - 18);
    p.vspeed = 0;
    p.pitch = 0;
    p.roll = 0;
    this.events.push('land');
    if (this.mission.needsLanding && this.ringIndex >= this.mission.rings.length) {
      this.completeMission();
    } else if (this.mission.needsLanding) {
      this.say('On the runway — but the rings are not done. Take off and fly them!', 5);
      // Rolling takeoff: keep flying state, speed rebuilds with throttle.
      p.onGround = false;
      this.score += 100;
    } else {
      this.phase = PHASE.LANDED;
      this.score += 100;
      this.say('Landed safely on Amberford Field. +100 pts', 5);
      this.saveBest();
    }
  }

  completeMission() {
    this.phase = PHASE.COMPLETE;
    const timeBonus = this.mission.timeLimit > 0 ? Math.round(this.timeLeft) * 2 : 0;
    this.score += timeBonus + 500;
    this.events.push('complete');
    this.saveBest();
  }

  endCrash(reason) {
    this.phase = PHASE.CRASHED;
    this.events.push('crash');
    this.message = reason;
    this.messageUntil = this.time + 30;
    this.saveBest();
  }

  updateWarning() {
    const p = this.plane;
    const ground = groundHeight(p.x, p.z);
    const clearance = p.y - ground;
    if (this.phase === PHASE.FLYING && clearance < 45 && p.vspeed < -1) {
      this.warning = 'PULL UP';
    } else if (this.phase === PHASE.FLYING && p.fuel < 20) {
      this.warning = 'LOW FUEL';
    } else if (this.phase === PHASE.FLYING && p.speed < FLIGHT.stallSpeed + 4) {
      this.warning = 'STALL';
    } else {
      this.warning = '';
    }
  }

  // What the HUD and the renderer need, in display units.
  hudState() {
    const p = this.plane;
    return {
      altitudeFt: Math.round(p.y * 3.28084),
      speedKt: Math.round(p.speed * 1.94384),
      heading: p.heading,
      vspeedFpm: Math.round(p.vspeed * 196.85),
      throttle: p.throttle,
      fuel: p.fuel,
      score: this.score,
      ringsPassed: this.ringsPassed,
      ringsTotal: this.mission.rings.length,
      timeLeft: this.timeLeft,
      warning: this.warning,
      message: this.message,
      phase: this.phase,
      mission: this.mission,
      onGround: p.onGround,
    };
  }
}
