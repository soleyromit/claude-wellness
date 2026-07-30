/**
 * Hydration art: a glass filling up, frame by frame.
 *
 * All sprites are 24x24 logical pixels, which is 12 terminal lines once the
 * half-block packing halves the height — tall enough for real detail, short
 * enough to fit a narrow side pane.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';

const EMPTY = '........................';
const RIM = '.......gggggggggg.......';
const BASE = '.......GGGGGGGGGG.......';
const WALL = '.......g........g.......';
const WALL_SHINE = '.......gw.......g.......';
const WATER = '.......gbbbbbbbbg.......';
const WATER_SHINE = '.......gwbbbbbbbg.......';
const SURFACE = '.......gllllllllg.......';

/** Build a glass frame with the water surface at the given row. */
function glass(surfaceRow: number | null, extras: Record<number, string> = {}): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 24; y++) {
    if (extras[y] !== undefined) {
      rows.push(extras[y]!);
      continue;
    }
    if (y < 4 || y > 21) {
      rows.push(EMPTY);
    } else if (y === 4) {
      rows.push(RIM);
    } else if (y === 21) {
      rows.push(BASE);
    } else if (surfaceRow === null || y < surfaceRow) {
      rows.push(y === 6 || y === 7 ? WALL_SHINE : WALL);
    } else if (y === surfaceRow) {
      rows.push(SURFACE);
    } else {
      rows.push(y === 6 || y === 7 ? WATER_SHINE : WATER);
    }
  }
  return rows;
}

export const water: Sprite = {
  width: 24,
  height: 24,
  palette: PALETTE,
  frames: [
    // Empty, with a drop about to fall.
    glass(null, {
      1: '...........ll...........',
      2: '...........bb...........',
    }),
    // A third full, drop still falling.
    glass(15, {
      2: '...........ll...........',
      3: '...........bb...........',
    }),
    // Two thirds.
    glass(10),
    // Full, with a sparkle.
    glass(6, {
      2: '.....w..................',
      3: '....www.................',
      4: '.....w.gggggggggg.......',
    }),
  ],
};
