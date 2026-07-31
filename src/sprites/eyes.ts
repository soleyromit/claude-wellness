/**
 * Eye art.
 *
 * Drawn as a close-up: an eye at this size reads far more clearly than a tiny
 * person looking into the distance, and a moving iris makes "look away" obvious
 * without the caption.
 *
 * The key decision is that **a shut eye is not an open eye with the white
 * filled in**. The first version kept the same almond outline in every frame
 * and only changed what was inside it, so open, shut and wide all had identical
 * silhouettes and the blink was invisible. Here the lid genuinely closes: the
 * almond collapses to a single curved lash line, and the wide frame opens
 * taller than neutral with a raised brow. Three distinct shapes.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';

const SIZE = 24;
type Grid = string[][];

function blank(): Grid {
  return Array.from({ length: SIZE }, () => new Array<string>(SIZE).fill('.'));
}

function plot(grid: Grid, x: number, y: number, ch: string): void {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  grid[y]![x] = ch;
}

const CX = 11; // horizontal centre of the eye
const CY = 11; // vertical centre

/**
 * An open eye.
 *
 * @param openness Vertical half-height of the aperture. Larger is wider open.
 * @param irisX    Column the iris is centred on.
 */
function openEye(openness: number, irisX: number, brow = false): string[] {
  const grid = blank();
  const halfWidth = 9;

  // Lid outline: an ellipse. Sampling it per column keeps the corners sharp,
  // which is what makes it read as an eye rather than a circle.
  for (let dx = -halfWidth; dx <= halfWidth; dx++) {
    const t = dx / halfWidth;
    const h = Math.round(openness * Math.sqrt(Math.max(0, 1 - t * t)));

    for (let dy = -h; dy <= h; dy++) plot(grid, CX + dx, CY + dy, 'w');
    plot(grid, CX + dx, CY - h, 'o');
    plot(grid, CX + dx, CY + h, 'o');
  }

  // Iris and pupil, clipped to the aperture so a wide iris can't spill out.
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (dx * dx + dy * dy > 16) continue;
      const x = irisX + dx;
      const y = CY + dy;
      const t = (x - CX) / halfWidth;
      const h = Math.round(openness * Math.sqrt(Math.max(0, 1 - t * t)));
      if (Math.abs(y - CY) >= h) continue;
      plot(grid, x, y, dx * dx + dy * dy <= 4 ? 'o' : 'b');
    }
  }
  // Catch-light.
  plot(grid, irisX - 1, CY - 2, 'w');

  if (brow) {
    for (let dx = -8; dx <= 8; dx++) {
      const lift = Math.round(2 * Math.sqrt(Math.max(0, 1 - (dx / 8) ** 2)));
      const y = CY - openness - 2 - lift;
      plot(grid, CX + dx, y, 'h');
      plot(grid, CX + dx, y + 1, 'H');
    }
  }

  return grid.map((r) => r.join(''));
}

/**
 * A shut eye: a lash line with no aperture at all, plus lashes below.
 *
 * Nothing of the open shape survives, which is the entire point — this has to
 * be unmistakable at a glance against the open frames.
 */
function shutEye(): string[] {
  const grid = blank();
  const halfWidth = 9;

  for (let dx = -halfWidth; dx <= halfWidth; dx++) {
    const t = Math.abs(dx / halfWidth);
    // A shallow downward curve, deepest in the middle.
    const y = CY + Math.round(2 * (1 - t * t));
    plot(grid, CX + dx, y, 'o');
    plot(grid, CX + dx, y - 1, 'o');
  }

  // Lashes, angled down and out from the closed lid.
  for (const [dx, dy] of [
    [-8, 3], [-5, 4], [-2, 5], [1, 5], [4, 4], [7, 3],
  ] as const) {
    plot(grid, CX + dx, CY + dy, 'o');
    plot(grid, CX + dx, CY + dy + 1, 'o');
  }

  return grid.map((r) => r.join(''));
}

/** Distance markers under the eye, showing focus travelling outward. */
function withMarker(rows: string[], reach: number): string[] {
  const grid = rows.map((r) => [...r]);
  const width = Math.max(1, Math.round(reach * 6));
  for (let i = 0; i < width; i++) plot(grid, CX - 3 + i, 21, 'y');
  return grid.map((r) => r.join(''));
}

/**
 * 20-20-20: the iris tracks from centre out to the far corner and back, with a
 * marker below showing focus travelling into the distance.
 */
export const eyes: Sprite = makeSprite(
  PALETTE,
  [
    withMarker(openEye(6, CX), 1),
    withMarker(openEye(6, CX - 3), 0.6),
    withMarker(openEye(6, CX - 6), 0.2),
    withMarker(openEye(6, CX - 3), 0.6),
  ],
  { shade: false },
);

/** Blink drill: squeeze shut, then open wide. */
export const blink: Sprite = makeSprite(
  PALETTE,
  [
    openEye(6, CX),
    openEye(2, CX), // half closed, so the blink has a middle
    shutEye(),
    shutEye(),
    openEye(3, CX),
    openEye(7, CX, true), // wide, with the brow lifted
  ],
  { shade: false },
);
