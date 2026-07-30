/**
 * Breathing guides.
 *
 * These are the one place where the animation *is* the exercise — you pace
 * your breath by watching it — so both sprites are generated at a high frame
 * count and swept continuously across each repetition rather than snapping
 * once per step. A box that sits still while you're told to inhale teaches
 * nothing.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';

const SIZE = 24;
const CENTRE = SIZE / 2;

/** Smoothstep, so the box eases at the turns instead of moving mechanically. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

type Grid = string[][];

function blank(): Grid {
  return Array.from({ length: SIZE }, () => new Array<string>(SIZE).fill('.'));
}

function plot(grid: Grid, x: number, y: number, ch: string): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) return;
  grid[py]![px] = ch;
}

/**
 * One frame of the box.
 *
 * `half` is the box's half-extent and `phase` (0..4) is the position of the
 * travelling marker around the perimeter — up the left side, across the top,
 * down the right, back along the bottom. That path is the whole point: it tells
 * you which side of the box you are on without reading the caption.
 */
function boxFrame(half: number, phase: number): string[] {
  const grid = blank();
  const min = CENTRE - half;
  const max = CENTRE + half - 1;

  // Interior wash — reads as the volume of air in the lungs.
  for (let y = min + 1; y <= max - 1; y++) {
    for (let x = min + 1; x <= max - 1; x++) {
      grid[y]![x] = 'k';
    }
  }

  // Edges.
  for (let x = min; x <= max; x++) {
    plot(grid, x, min, 'l');
    plot(grid, x, max, 'l');
  }
  for (let y = min; y <= max; y++) {
    plot(grid, min, y, 'l');
    plot(grid, max, y, 'l');
  }

  // Brighter corners give the box structure at small sizes.
  for (const [cx, cy] of [
    [min, min],
    [max, min],
    [min, max],
    [max, max],
  ] as const) {
    plot(grid, cx, cy, 'w');
  }

  // Marker travels the perimeter counter-clockwise from the bottom-left.
  const side = Math.floor(phase) % 4;
  const t = phase - Math.floor(phase);
  let mx = min;
  let my = max;
  if (side === 0) {
    my = lerp(max, min, t); // up the left
  } else if (side === 1) {
    my = min;
    mx = lerp(min, max, t); // across the top
  } else if (side === 2) {
    mx = max;
    my = lerp(min, max, t); // down the right
  } else {
    my = max;
    mx = lerp(max, min, t); // back along the bottom
  }

  // A small plus rather than a square blob — it stays legible on the edge.
  plot(grid, mx, my, 'w');
  plot(grid, mx - 1, my, 'y');
  plot(grid, mx + 1, my, 'y');
  plot(grid, mx, my - 1, 'y');
  plot(grid, mx, my + 1, 'y');

  return grid.map((row) => row.join(''));
}

const SMALL = 4;
// Stops short of the canvas edge so the travelling marker has room to sit
// outside the border without being clipped.
const LARGE = 9;
/** Frames per phase. Four phases at four frames each reads as smooth motion. */
const PER_PHASE = 4;

/**
 * Box breathing: grow, hold, shrink, hold — four equal counts.
 *
 * The box genuinely changes size during the inhale and exhale phases, which is
 * what makes it followable.
 */
export const boxBreath: Sprite = makeSprite(
  PALETTE,
  Array.from({ length: PER_PHASE * 4 }, (_, i) => {
    const phase = Math.floor(i / PER_PHASE);
    const t = ease((i % PER_PHASE) / PER_PHASE);

    const half =
      phase === 0
        ? lerp(SMALL, LARGE, t) // inhale: grow
        : phase === 1
          ? LARGE // hold: full
          : phase === 2
            ? lerp(LARGE, SMALL, t) // exhale: shrink
            : SMALL; // hold: empty

    return boxFrame(Math.round(half), phase + t);
  }),
);

/**
 * Physiological sigh: a torso whose chest fills over two stacked inhales and
 * then empties over a long exhale, with the breath streaming away on release.
 *
 * Frame budget is split to match the step durations (3s, 2s, 6s), so the art
 * stays in step with the instruction as the strip sweeps.
 */
function torso(chest: number, breath: number): string[] {
  const grid = blank();
  const put = (y: number, x: number, pixels: string): void => {
    for (let i = 0; i < pixels.length; i++) plot(grid, x + i, y, pixels[i]!);
  };

  // Head, fixed. Eyes closed — this is a calming exercise.
  put(2, 9, 'hhhhhh');
  put(3, 8, 'hhhhhhhh');
  put(4, 8, 'hssssssh');
  put(5, 8, 'hsSSSSsh');
  put(6, 8, 'hssssssh');
  put(7, 9, 'ssssss');
  put(8, 10, 'SSSS');
  // Neck reaches down to row 9 so it still meets the chest at rest, when the
  // chest sits a row lower than it does at full inhale.
  put(9, 10, 'SSSS');

  // Chest widens and lifts with the breath.
  const width = Math.round(lerp(10, 16, chest));
  const top = Math.round(lerp(10, 9, chest));
  const x = Math.round(CENTRE - width / 2);
  for (let y = top; y <= 14; y++) {
    put(y, x, (y === 14 ? 'C' : 'c').repeat(width));
  }

  // Hips and legs stay planted so only the chest moves.
  put(15, 7, 'pppppppppp');
  put(16, 7, 'pppppppppp');
  for (let y = 17; y <= 20; y++) {
    put(y, 8, 'ppp');
    put(y, 13, 'ppp');
  }
  put(21, 7, 'ooo');
  put(21, 13, 'ooo');

  // Breath leaving on the exhale, drawn as a stream drifting up and right.
  if (breath > 0) {
    const reach = Math.round(lerp(0, 8, breath));
    for (let i = 0; i < reach; i++) {
      plot(grid, 17 + i * 0.7, 7 - i * 0.5, 'b');
    }
  }

  return grid.map((row) => row.join(''));
}

const INHALE_FRAMES = 4;
const TOPUP_FRAMES = 2;
const EXHALE_FRAMES = 6;

export const sigh: Sprite = makeSprite(PALETTE, [
  // First inhale: chest fills to about two thirds.
  ...Array.from({ length: INHALE_FRAMES }, (_, i) =>
    torso(ease((i + 1) / INHALE_FRAMES) * 0.65, 0),
  ),
  // Second, shorter top-up to full.
  ...Array.from({ length: TOPUP_FRAMES }, (_, i) =>
    torso(0.65 + ease((i + 1) / TOPUP_FRAMES) * 0.35, 0),
  ),
  // Long release: chest empties while the breath streams away.
  ...Array.from({ length: EXHALE_FRAMES }, (_, i) => {
    const t = ease((i + 1) / EXHALE_FRAMES);
    return torso(1 - t, t);
  }),
]);
