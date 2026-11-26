// Ember Valley — Sky Courier: the valley itself.
// A deterministic heightfield: rolling hills, a river valley, a flat runway
// corridor and the town of Amberford. No textures, no downloads — every colour
// is picked from the height, slope and a stable per-cell hash, so the ground
// reads as fields, forest, river and rock from the air.

import { RUNWAY, TOWN, hash2, clamp, lerp } from './config.js';

export function riverX(z) {
  return 210 * Math.sin(z * 0.0016) + 130;
}

function hillHeight(x, z) {
  const a = 62 * Math.sin(x * 0.0038 + 1.7) * Math.cos(z * 0.0029 + 0.4);
  const b = 34 * Math.sin(x * 0.0105 + 0.6) * Math.sin(z * 0.0071 + 2.1);
  const c = 88 * Math.pow(Math.max(0, Math.sin(x * 0.0016 + 0.9)), 2);
  const d = 48 * Math.sin((x + z) * 0.0021 + 3.3) * Math.cos((x - z) * 0.0017);
  return a + b + c + d;
}

// How flat the ground is forced near the runway and the town apron.
function flattenFactor(x, z) {
  const dx = Math.abs(x - RUNWAY.x);
  const dz = Math.max(0, Math.max(RUNWAY.zMin - z, z - RUNWAY.zMax));
  const corridor = clamp(1 - (dx - 60) / 160, 0, 1);
  const along = clamp(1 - (dz - 40) / 160, 0, 1);
  const town =
    x > TOWN.xMin - 40 && x < TOWN.xMax + 40 && z > TOWN.zMin - 40 && z < TOWN.zMax + 40
      ? 0.75
      : 0;
  return Math.max(corridor * along, town);
}

export function groundHeight(x, z) {
  let h = hillHeight(x, z);
  const f = flattenFactor(x, z);
  h = lerp(h, 2, f);
  // Carve the river channel.
  const rx = riverX(z);
  const dRiver = Math.abs(x - rx);
  h -= 26 * Math.exp(-((dRiver * dRiver) / (2 * 34 * 34)));
  if (dRiver < 26) h = Math.min(h, 1.5);
  return Math.max(h, 0.4);
}

export function isWater(x, z) {
  return Math.abs(x - riverX(z)) < 24 && groundHeight(x, z) < 4;
}

export function isRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.halfWidth &&
    z >= RUNWAY.zMin &&
    z <= RUNWAY.zMax
  );
}

export function isTown(x, z) {
  return x >= TOWN.xMin && x <= TOWN.xMax && z >= TOWN.zMin && z <= TOWN.zMax;
}

// Ground colour for one terrain cell, by height, slope and land use.
export function groundColor(x, z, h, slope) {
  if (isRunway(x, z)) return '#3a3f46';
  if (isWater(x, z)) return '#2e6f8e';
  const cell = Math.floor(x / 120) + Math.floor(z / 120) * 7;
  const r = hash2(cell, 11);
  if (isTown(x, z)) return r < 0.5 ? '#8a7a5c' : '#7d6f55';
  if (h > 150) return slope > 0.55 ? '#6d5b4a' : '#8d8578';
  if (h > 95) return r < 0.4 ? '#5d7040' : '#6b7a44';
  // Valley floor: patchwork fields in greens and gold.
  if (r < 0.22) return '#b59a4e'; // wheat
  if (r < 0.45) return '#5f7d3a'; // meadow
  if (r < 0.62) return '#4e7034'; // deep green
  if (r < 0.78) return '#7d8f45'; // pale field
  return '#55763a';
}

// A tree stands here (deterministic per cell), unless it is runway, water,
// road or town. Returns a height in metres, 0 when there is none.
export function treeAt(ix, iz) {
  const x = ix * 40 + 20;
  const z = iz * 40 + 20;
  if (isRunway(x, z) || isWater(x, z) || isTown(x, z)) return 0;
  const r = hash2(ix, iz);
  if (r < 0.62) return 0;
  const h = groundHeight(x, z);
  if (h > 130) return 0;
  return 7 + r * 7;
}

// Rooftops of Amberford: deterministic boxes, each [x, z, w, d, h, hue].
export function townBuildings() {
  const out = [];
  for (let ix = 0; ix < 7; ix++) {
    for (let iz = 0; iz < 6; iz++) {
      const r = hash2(ix * 3 + 5, iz * 5 + 2);
      if (r < 0.25) continue; // a square, a garden, a gap
      const x = TOWN.xMin + 14 + ix * 26 + (r - 0.5) * 8;
      const z = TOWN.zMin + 16 + iz * 48 + (hash2(ix, iz * 7) - 0.5) * 10;
      out.push({
        x,
        z,
        w: 14 + r * 10,
        d: 12 + hash2(ix + 9, iz) * 10,
        h: 9 + hash2(ix, iz + 4) * 16,
        roof: r < 0.5,
      });
    }
  }
  return out;
}

export const BUILDINGS = townBuildings();
