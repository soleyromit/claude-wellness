/**
 * The pixel companion — a desk cactus whose condition mirrors yours.
 *
 * This is the one piece of art that sits on screen all day, so it gets the
 * largest canvas (32x32, sixteen terminal rows) and the most detail.
 *
 * It's generated rather than hand-placed because the detail that makes it read
 * as a plant — cylindrical shading, vertical ribbing, spines following the
 * ribs — is systematic. Hand-placing four moods' worth of tonal steps would be
 * both enormous and inconsistent; a shading function applies the same light
 * direction everywhere for free.
 *
 * Light falls from the upper left throughout.
 */

import type { Sprite } from '../render/pixel.js';
import type { PetMood } from '../core/pet.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';

const SIZE = 32;

type Grid = string[][];

function blank(): Grid {
  return Array.from({ length: SIZE }, () => new Array<string>(SIZE).fill('.'));
}

function put(grid: Grid, x: number, y: number, ch: string): void {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  grid[y]![x] = ch;
}

/** Tone ramp for a plant surface: edge, highlight, mid, shadow, deep edge. */
interface Ramp {
  readonly edge: string;
  readonly light: string;
  readonly mid: string;
  readonly shade: string;
  readonly deep: string;
}

const HEALTHY: Ramp = { edge: '8', light: '7', mid: 'n', shade: 'N', deep: '8' };
/** Wilting: the green yellows off rather than simply darkening. */
const WILTED: Ramp = { edge: 'V', light: 'f', mid: 'F', shade: 'v', deep: 'V' };
/** Neglected: dried out to brown. */
const DEAD: Ramp = { edge: 'z', light: 'u', mid: 'U', shade: 'z', deep: 'z' };

/**
 * Shade a vertical cylinder across columns `x0..x1`.
 *
 * The tone is chosen by horizontal position, which is what turns a flat
 * rectangle into something round. Ribs are darker seams laid on top at regular
 * intervals — the detail that says "cactus" rather than "green pill".
 */
function cylinder(
  grid: Grid,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  ramp: Ramp,
  ribs = true,
): void {
  const width = x1 - x0 + 1;
  for (let x = x0; x <= x1; x++) {
    const t = width === 1 ? 0.5 : (x - x0) / (width - 1);
    let tone: string;
    if (t < 0.1) tone = ramp.edge;
    else if (t < 0.32) tone = ramp.light;
    else if (t < 0.62) tone = ramp.mid;
    else if (t < 0.88) tone = ramp.shade;
    else tone = ramp.deep;

    // A single off-centre rib. Two read as stripes at this scale rather than
    // as the flutes of a cactus.
    if (ribs && width >= 6 && Math.abs(t - 0.55) < 0.05) {
      tone = ramp.shade;
    }

    for (let y = y0; y <= y1; y++) put(grid, x, y, tone);
  }
}

/** Round the top of a segment so it doesn't end in a flat cut. */
function roundTop(grid: Grid, x0: number, x1: number, y: number, ramp: Ramp): void {
  put(grid, x0, y, '.');
  put(grid, x1, y, '.');
  // Uses the ramp's own edge tone — hardcoding the healthy green here leaves a
  // green rim around a browned-off plant.
  put(grid, x0, y + 1, ramp.edge);
  put(grid, x1, y + 1, ramp.edge);
}

/**
 * Areoles down the sides, where a real cactus carries its spines.
 *
 * Deliberately sparse and confined to the silhouette edges. Scattering bright
 * pixels across the face of the plant reads as noise once the sprite is halved
 * to sixteen terminal rows — the edge is where they still parse as texture.
 */
function areoles(grid: Grid, x0: number, x1: number, y0: number, y1: number, ramp: Ramp): void {
  for (let y = y0; y <= y1; y += 4) {
    put(grid, x0, y, 'e');
    put(grid, x1, y, ramp.deep);
  }
}

interface MoodSpec {
  readonly ramp: Ramp;
  /** Vertical offset of each arm's top — larger means more droop. */
  readonly armDroop: number;
  /** Mouth shape drawn under the eyes. */
  readonly mouth: 'smile' | 'flat' | 'frown';
  readonly flower: boolean;
  /** Slumps the whole plant down into the pot. */
  readonly slump: number;
}

const BODY_X0 = 11;
const BODY_X1 = 20;
const POT_TOP = 24;

function cactus(spec: MoodSpec): string[] {
  const grid = blank();
  const { ramp, armDroop, mouth, flower, slump } = spec;

  const bodyTop = 6 + slump;

  // ------------------------------------------------------------------- body
  cylinder(grid, BODY_X0, BODY_X1, bodyTop, POT_TOP + 1, ramp);
  roundTop(grid, BODY_X0, BODY_X1, bodyTop, ramp);
  areoles(grid, BODY_X0, BODY_X1, bodyTop + 4, POT_TOP - 3, ramp);

  // ------------------------------------------------------------------- arms
  // Each arm is an elbow: a horizontal stub joining the body, then a vertical
  // section beside it. Both are four wide so they hold their shape once the
  // sprite is halved vertically.
  //
  // Droop shortens how far the arm rises above the elbow and lengthens how far
  // it hangs below, but the hanging end is clamped above the pot rim — an
  // unclamped droop sends the arms straight through the pot and off the canvas.
  const rise = Math.max(0, 5 - armDroop);
  const hang = Math.min(armDroop, 4);

  const drawArm = (x0: number, x1: number, elbowY: number): void => {
    const top = elbowY - rise;
    const bottom = Math.min(POT_TOP - 1, elbowY + 3 + hang);
    cylinder(grid, x0, x1, top, bottom, ramp, false);
    roundTop(grid, x0, x1, top, ramp);
  };

  const armY = 14 + armDroop + slump;
  // Horizontal stubs joining each arm to the trunk.
  cylinder(grid, 6, BODY_X0 - 1, armY, armY + 3, ramp, false);
  cylinder(grid, BODY_X1 + 1, 25, armY - 2, armY + 1, ramp, false);

  drawArm(6, 9, armY);
  // The right arm sits a little higher, so the plant isn't mirror-symmetric.
  drawArm(22, 25, armY - 2);

  // ------------------------------------------------------------------- face
  // Redrawn after the arms so nothing overlaps it.
  const faceY = bodyTop + 6;
  for (const ex of [13, 17]) {
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) put(grid, ex + dx, faceY + dy, 'o');
    }
    // One catchlight inside each eye. At this size it is the whole difference
    // between a face that looks alive and one that looks taxidermied.
    put(grid, ex, faceY, 'w');
  }

  const my = faceY + 4;
  if (mouth === 'smile') {
    put(grid, 13, my, 'o');
    put(grid, 14, my + 1, 'o');
    put(grid, 15, my + 1, 'o');
    put(grid, 16, my + 1, 'o');
    put(grid, 17, my, 'o');
  } else if (mouth === 'flat') {
    for (let x = 14; x <= 16; x++) put(grid, x, my, 'o');
  } else {
    put(grid, 13, my + 1, 'o');
    put(grid, 14, my, 'o');
    put(grid, 15, my, 'o');
    put(grid, 16, my, 'o');
    put(grid, 17, my + 1, 'o');
  }

  // ----------------------------------------------------------------- flower
  if (flower) {
    const fy = bodyTop - 4;
    // Five petals around a bright centre.
    for (const [dx, dy] of [
      [14, 0], [15, 0], [16, 0],
      [13, 1], [17, 1],
      [13, 2], [17, 2],
      [14, 3], [15, 3], [16, 3],
    ] as const) {
      put(grid, dx, fy + dy, dx > 15 ? 'J' : 'j');
    }
    put(grid, 14, fy + 1, 'q');
    put(grid, 15, fy + 1, 'q');
    put(grid, 16, fy + 1, 'J');
    put(grid, 14, fy + 2, 'q');
    put(grid, 15, fy + 2, 'J');
    put(grid, 16, fy + 2, 'J');
  }

  // -------------------------------------------------------------------- pot
  // Soil, with shadow only where the plant meets it — a uniformly dark band
  // reads as a gap between plant and pot rather than as earth.
  for (let x = 7; x <= 24; x++) {
    const atBase = x >= BODY_X0 - 1 && x <= BODY_X1 + 1;
    put(grid, x, POT_TOP, atBase ? 'D' : 'd');
  }

  // Rim.
  for (let x = 6; x <= 25; x++) {
    const t = (x - 6) / 19;
    const tone = t < 0.1 ? '0' : t < 0.34 ? '9' : t < 0.66 ? 'm' : t < 0.9 ? 'M' : '0';
    put(grid, x, POT_TOP + 1, tone);
    put(grid, x, POT_TOP + 2, tone === '9' ? 'm' : tone);
  }

  // Tapered body.
  for (let y = POT_TOP + 3; y < SIZE; y++) {
    const inset = Math.floor((y - (POT_TOP + 3)) * 0.9);
    const x0 = 7 + inset;
    const x1 = 24 - inset;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / Math.max(1, x1 - x0);
      const tone = t < 0.1 ? '0' : t < 0.32 ? '9' : t < 0.64 ? 'm' : t < 0.9 ? 'M' : '0';
      put(grid, x, y, tone);
    }
  }

  return grid.map((row) => row.join(''));
}

const thriving = makeSprite(
  PALETTE,
  [cactus({ ramp: HEALTHY, armDroop: 0, mouth: 'smile', flower: true, slump: 0 })],
  { name: 'pet-thriving', shade: false },
);

const ok = makeSprite(
  PALETTE,
  [cactus({ ramp: HEALTHY, armDroop: 1, mouth: 'flat', flower: false, slump: 0 })],
  { name: 'pet-ok', shade: false },
);

const wilting = makeSprite(
  PALETTE,
  [cactus({ ramp: WILTED, armDroop: 3, mouth: 'frown', flower: false, slump: 1 })],
  { name: 'pet-wilting', shade: false },
);

const sad = makeSprite(
  PALETTE,
  [cactus({ ramp: DEAD, armDroop: 5, mouth: 'frown', flower: false, slump: 3 })],
  { name: 'pet-sad', shade: false },
);

export const PET_SPRITES: Readonly<Record<PetMood, Sprite>> = {
  thriving,
  ok,
  wilting,
  sad,
};

export function petSprite(mood: PetMood): Sprite {
  return PET_SPRITES[mood];
}
