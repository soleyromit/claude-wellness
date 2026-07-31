/**
 * Hydration art: a glass filling up.
 *
 * Generated rather than hand-drawn so the glass keeps a consistent thickness
 * and the water surface stays level as the fill rises. The detail that sells it
 * is all tonal: a lit left wall, a shadowed right one, a bright meniscus at the
 * surface and a darker pool beneath it — flat blue in a flat outline reads as a
 * blue rectangle no matter how carefully it's placed.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';

const SIZE = 24;
const LEFT = 6; // outer left wall
const RIGHT = 17; // outer right wall
const RIM = 3;
const BASE = 21;

type Grid = string[][];

function blank(): Grid {
  return Array.from({ length: SIZE }, () => new Array<string>(SIZE).fill('.'));
}

function put(grid: Grid, x: number, y: number, ch: string): void {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  grid[y]![x] = ch;
}

/**
 * @param surface Row of the water surface, or null for an empty glass.
 * @param drop    Row of a falling droplet, or null for none.
 * @param sparkle Whether to add a glint, used on the full frame.
 */
function glass(surface: number | null, drop: number | null, sparkle = false): string[] {
  const grid = blank();

  // Glass walls. Two pixels thick so they can carry a highlight and a shadow.
  for (let y = RIM; y <= BASE; y++) {
    put(grid, LEFT, y, 'G');
    put(grid, LEFT + 1, y, 'g');
    put(grid, RIGHT - 1, y, 'G');
    put(grid, RIGHT, y, 'G');
  }

  // Water, filling from the surface down to the base.
  if (surface !== null) {
    for (let y = surface; y < BASE; y++) {
      for (let x = LEFT + 2; x <= RIGHT - 2; x++) {
        // Lit on the left, deeper towards the right and the bottom.
        const t = (x - (LEFT + 2)) / (RIGHT - 2 - (LEFT + 2));
        const deep = y > BASE - 4;
        put(grid, x, y, t < 0.18 ? 'l' : t > 0.82 || deep ? 'B' : 'b');
      }
    }
    // Meniscus: the surface catches the light and reads as a liquid top.
    for (let x = LEFT + 2; x <= RIGHT - 2; x++) put(grid, x, surface, 'l');
    put(grid, LEFT + 2, surface, 'g');
    put(grid, RIGHT - 2, surface, 'G');
  }

  // Rim, drawn last so it sits over the water line.
  for (let x = LEFT; x <= RIGHT; x++) {
    put(grid, x, RIM, x < LEFT + 3 ? 'g' : x > RIGHT - 3 ? 'G' : 'g');
    put(grid, x, RIM - 1, x < LEFT + 3 ? 'w' : 'g');
  }

  // Base, thicker than the walls so the glass sits rather than floats.
  for (let x = LEFT; x <= RIGHT; x++) {
    put(grid, x, BASE, 'G');
    put(grid, x, BASE + 1, x < LEFT + 3 ? 'G' : '.');
  }
  for (let x = LEFT + 1; x <= RIGHT - 1; x++) put(grid, x, BASE + 1, 'G');

  // Vertical specular highlight down the left wall — the single most
  // glass-like cue available at this size.
  for (let y = RIM + 2; y <= RIM + 7; y++) put(grid, LEFT + 1, y, 'w');

  if (drop !== null) {
    put(grid, 11, drop, 'l');
    put(grid, 12, drop, 'l');
    put(grid, 11, drop + 1, 'b');
    put(grid, 12, drop + 1, 'B');
  }

  if (sparkle) {
    put(grid, 19, 5, 'w');
    put(grid, 20, 4, 'w');
    put(grid, 20, 6, 'w');
    put(grid, 21, 5, 'w');
  }

  return grid.map((row) => row.join(''));
}

export const water: Sprite = makeSprite(
  PALETTE,
  [
    glass(null, 0), // empty, drop about to land
    glass(16, 1), // a third
    glass(11, null), // two thirds
    glass(6, null, true), // full, with a glint
  ],
  // Hand-toned already; the automatic edge pass would flatten the meniscus.
  { shade: false },
);
