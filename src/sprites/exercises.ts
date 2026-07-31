/**
 * Exercise poses, drawn side-on from an articulated figure.
 *
 * Side view is the whole point. Front-on, a squat, a lunge and a calf raise all
 * collapse to the same standing silhouette once halved to sixteen terminal
 * rows — the hip hinge and knee bend that distinguish them are edge-on and
 * invisible. Turned side-on and exaggerated well past life, each one has a
 * silhouette you can name at a glance.
 *
 * Poses are deliberately caricatured: the squat sits deeper and the lunge is
 * longer than anyone would actually perform. Readable beats anatomical when
 * the whole figure is thirty-two pixels tall.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';
import { arrow, drawPose, ground, toRows, type Pose } from './figure.js';

/** Render a pose with the floor under it. */
function frame(pose: Pose, decorate?: (grid: string[][]) => void): string[] {
  const grid = drawPose(pose);
  ground(grid);
  decorate?.(grid);
  return toRows(grid);
}

// ---------------------------------------------------------------------- squat

/** Upright, arms forward as a counterbalance. */
const STAND_SQUAT: Pose = {
  head: [12, 6],
  shoulder: [12, 12],
  elbow: [15, 14],
  hand: [18, 15],
  hip: [12, 18],
  knee: [12, 23],
  ankle: [12, 27],
  toe: [16, 28],
  heel: [9, 28],
};

/**
 * Bottom of the squat: hips driven back behind the heels, knees forward, chest
 * over the thighs. The offset between hip and knee is the pose's signature.
 */
const DEEP_SQUAT: Pose = {
  head: [14, 11],
  shoulder: [13, 16],
  elbow: [17, 17],
  hand: [21, 17],
  hip: [8, 21],
  knee: [16, 23],
  ankle: [12, 27],
  toe: [16, 28],
  heel: [9, 28],
};

export const squat: Sprite = makeSprite(PALETTE, [
  frame(STAND_SQUAT, (g) => arrow(g, 25, 20, 'down')),
  frame(DEEP_SQUAT, (g) => arrow(g, 25, 16, 'up')),
]);

// ---------------------------------------------------------------------- lunge

const STAND_LUNGE: Pose = {
  head: [12, 6],
  shoulder: [12, 12],
  elbow: [13, 16],
  hand: [13, 20],
  hip: [12, 18],
  knee: [12, 23],
  ankle: [12, 27],
  toe: [16, 28],
  heel: [9, 28],
};

/** Long split stance: front shin vertical, back knee almost on the floor. */
const DEEP_LUNGE: Pose = {
  head: [13, 7],
  shoulder: [13, 13],
  elbow: [14, 17],
  hand: [14, 21],
  hip: [13, 19],
  knee: [20, 22],
  ankle: [20, 27],
  toe: [24, 28],
  heel: [17, 28],
  backKnee: [7, 26],
  backAnkle: [4, 27],
  backToe: [2, 28],
};

export const lunge: Sprite = makeSprite(PALETTE, [frame(STAND_LUNGE), frame(DEEP_LUNGE)]);

// ----------------------------------------------------------------------- calf

const CALF_DOWN: Pose = {
  head: [12, 6],
  shoulder: [12, 12],
  elbow: [13, 16],
  hand: [13, 20],
  hip: [12, 18],
  knee: [12, 23],
  ankle: [12, 26],
  toe: [16, 28],
  heel: [9, 28],
};

/**
 * Up on the toes. The whole figure rises two pixels *and* the heel swings clear
 * of the floor — the gap under the heel is what makes the movement readable.
 */
const CALF_UP: Pose = {
  head: [12, 4],
  shoulder: [12, 10],
  elbow: [13, 14],
  hand: [13, 18],
  hip: [12, 16],
  knee: [12, 21],
  ankle: [12, 24],
  toe: [16, 28],
  heel: [9, 25],
};

export const calf: Sprite = makeSprite(PALETTE, [
  frame(CALF_DOWN),
  frame(CALF_UP, (g) => arrow(g, 22, 12, 'up')),
]);

// --------------------------------------------------------------------- pushup

/** Body in a straight line from heels to head, arm extended to the floor. */
const PUSHUP_UP: Pose = {
  head: [7, 15],
  shoulder: [11, 17],
  elbow: [10, 22],
  hand: [10, 27],
  hip: [21, 18],
  knee: [26, 22],
  ankle: [27, 26],
  toe: [29, 28],
};

/** Chest lowered; the hand has not moved, so the arm folds. */
const PUSHUP_DOWN: Pose = {
  head: [7, 21],
  shoulder: [11, 22],
  elbow: [8, 25],
  hand: [10, 27],
  hip: [21, 21],
  knee: [26, 23],
  ankle: [27, 26],
  toe: [29, 28],
};

export const pushup: Sprite = makeSprite(PALETTE, [
  frame(PUSHUP_UP, (g) => arrow(g, 16, 12, 'down')),
  frame(PUSHUP_DOWN, (g) => arrow(g, 16, 14, 'up')),
]);

// ---------------------------------------------------------------------- plank

/** Held on the forearms, body dead straight. */
const PLANK: Pose = {
  head: [7, 19],
  shoulder: [11, 20],
  elbow: [8, 25],
  hand: [13, 27],
  hip: [21, 20],
  knee: [26, 23],
  ankle: [27, 26],
  toe: [29, 28],
};

export const plank: Sprite = makeSprite(PALETTE, [
  frame(PLANK),
  // A plank pulses; it does not travel. The core lights up rather than the
  // body moving, because animating movement here would teach the exercise wrong.
  frame(PLANK, (g) => {
    for (let x = 13; x <= 20; x++) {
      g[19]![x] = 'y';
      g[20]![x] = 'y';
    }
  }),
]);
