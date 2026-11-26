// Ember Valley — Sky Courier: tuning constants, world data and missions.
// One world unit is one metre. Heading 0 means flying north (toward -z);
// heading grows clockwise, so east is PI/2.

export const GAME_TITLE = 'EMBER VALLEY';
export const GAME_SUBTITLE = 'Sky Courier';
export const PLANE_NAME = 'Kestrel-9';

// Flight tuning (arcade model: forgiving, but throttle and turn discipline pay).
export const FLIGHT = {
  minSpeed: 24, // m/s, below this the wing stops flying
  cruiseSpeed: 62, // m/s at 60% throttle
  maxSpeed: 96, // m/s at full throttle
  accel: 14, // m/s^2 toward the throttle's target speed
  maxPitchDeg: 24, // nose up / down limit
  maxRollDeg: 48, // bank limit
  pitchRate: 42, // deg/s
  rollRate: 95, // deg/s
  turnRate: 26, // deg/s of heading at full bank
  climbFactor: 0.9, // vertical speed per m/s of forward speed at full pitch
  fuelBurn: 0.55, // fuel units per second at full throttle
  fuelStart: 100,
  ringFuelBonus: 6,
  stallSpeed: 34, // m/s, below this a climb bleeds speed fast
  hardLandingVs: -7, // m/s vertical speed that breaks the gear
};

export const RUNWAY = {
  x: 0, // runway centreline runs north-south through x = 0
  zMin: -260,
  zMax: 260,
  halfWidth: 13,
  headingDeg: 0,
  name: 'AMBERFORD FIELD',
  elevation: 0,
};

export const TOWN = {
  name: 'Amberford',
  xMin: 70,
  xMax: 260,
  zMin: -140,
  zMax: 170,
};

// Deterministic hash: every patch of ground, tree and rooftop is stable.
export function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(d) {
  return (d * Math.PI) / 180;
}

export function radToDeg(r) {
  return (r * 180) / Math.PI;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function formatHeading(rad) {
  const deg = ((radToDeg(rad) % 360) + 360) % 360;
  return String(Math.round(deg)).padStart(3, '0');
}

// Ring courses. Each ring: [x, altitude, z]. Rings hang in the sky along a
// winding valley route; the next ring is always the glowing target ahead.
export const RING_COURSES = {
  ringRun: [
    [0, 95, -620],
    [-120, 110, -900],
    [-260, 130, -1150],
    [-140, 105, -1420],
    [60, 120, -1620],
    [240, 140, -1450],
    [300, 115, -1150],
    [140, 100, -860],
  ],
  ridgeDash: [
    [0, 95, -620],
    [-180, 150, -950],
    [-320, 190, -1250],
    [-120, 170, -1550],
    [160, 190, -1500],
    [320, 150, -1150],
  ],
};

export const MISSIONS = [
  {
    id: 'ringRun',
    key: '1',
    name: 'RING RUN',
    tag: 'Fly the valley circuit',
    goal: 'Thread all 8 golden rings. Each ring pays 250 pts + fuel.',
    rings: RING_COURSES.ringRun,
    timeLimit: 0,
    needsLanding: false,
  },
  {
    id: 'courier',
    key: '2',
    name: 'COURIER DROP',
    tag: 'Bring the mail home',
    goal: 'Fly the valley, then land on Amberford Field runway 18. Touch down gentle: under 90 kt, sink under 7 m/s.',
    rings: [[0, 95, -620], [-120, 110, -900]],
    timeLimit: 0,
    needsLanding: true,
  },
  {
    id: 'ridgeDash',
    key: '3',
    name: 'RIDGE DASH',
    tag: 'Against the clock',
    goal: 'Thread 6 high rings, then land on the runway — before 4:00 runs out.',
    rings: RING_COURSES.ridgeDash,
    timeLimit: 240,
    needsLanding: true,
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}
