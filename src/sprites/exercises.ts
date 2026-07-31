/**
 * Exercise poses, drawn side-on from an articulated figure and animated
 * between key positions.
 *
 * Two things make these followable, and both were missing before:
 *
 *  - **Side view.** Front-on, the hip hinge and knee bend that distinguish a
 *    squat from a lunge from a calf raise are edge-on and invisible, so all
 *    three reduced to "person standing".
 *  - **In-between frames.** Two static frames tell you where a movement starts
 *    and ends but not the path between, which is the part you actually copy.
 *    Every step now gets its own block of frames easing into the pose.
 *
 * Poses are deliberately caricatured — the squat sits deeper and the lunge is
 * longer than anyone would really perform. Readable beats anatomical when the
 * whole figure is thirty-two pixels tall.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';
import {
  SHIRT_TONES,
  arrow,
  drawPose,
  scalePose,
  framesFromPoses,
  ground,
  tintBody,
  toRows,
  type Pose,
} from './figure.js';

/** Frames each instruction step gets. Must match `framesPerStep` on the activity. */
export const FRAMES_PER_STEP = 7;

/**
 * Build a strip from one key pose per step.
 *
 * `cue` places a directional arrow so the movement's direction is explicit
 * rather than inferred — the single most useful addition for someone glancing
 * at the pane mid-task.
 */
function strip(
  poses: readonly Pose[],
  cue?: (step: number) => { x: number; y: number; dir: 'up' | 'down' } | null,
): string[][] {
  // Poses are authored on a 32 grid and scaled up, so the coordinates stay
  // readable and the canvas can change without re-authoring every joint.
  return framesFromPoses(poses.map((p) => scalePose(p)), FRAMES_PER_STEP, (pose, step, t) => {
    const grid = drawPose(pose);
    ground(grid);
    const c = cue?.(step);
    // Cue positions are authored on the same 32 grid as the poses, so they
    // scale with them — otherwise an arrow that sat beside the figure ends up
    // on top of it.
    if (c && t < 0.9) arrow(grid, c.x * 1.4, c.y * 1.4 + 2, c.dir);
    return toRows(grid);
  });
}

// ---------------------------------------------------------------------- squat

const STAND: Pose = {
  head: [12, 6],
  shoulder: [12, 12],
  elbow: [15, 14],
  hand: [18, 15],
  hip: [12, 18],
  knee: [12, 23],
  ankle: [12, 26],
  toe: [16, 28],
  heel: [9, 28],
};

/** Hips driven back behind the heels, knees forward, chest over the thighs. */
const DEEP_SQUAT: Pose = {
  head: [14, 11],
  shoulder: [13, 16],
  elbow: [17, 17],
  hand: [21, 17],
  hip: [8, 21],
  knee: [16, 23],
  ankle: [12, 26],
  toe: [16, 28],
  heel: [9, 28],
};

// Steps are "Stand up" then "Sit back down", so the strip runs deep -> tall
// -> deep and the animation matches the words on both halves of the rep.
export const squat: Sprite = makeSprite(
  PALETTE,
  strip([STAND, DEEP_SQUAT], (step) =>
    step === 0 ? { x: 25, y: 18, dir: 'up' } : { x: 25, y: 14, dir: 'down' },
  ),
);

// ---------------------------------------------------------------------- lunge

const STAND_ARMS_DOWN: Pose = {
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

/** Long split stance: front shin vertical, back knee almost on the floor. */
const DEEP_LUNGE: Pose = {
  head: [13, 7],
  shoulder: [13, 13],
  elbow: [14, 17],
  hand: [14, 21],
  hip: [13, 19],
  knee: [20, 22],
  ankle: [20, 26],
  toe: [24, 28],
  heel: [17, 28],
  backKnee: [7, 25],
  backAnkle: [4, 27],
  backToe: [2, 28],
};

export const lunge: Sprite = makeSprite(
  PALETTE,
  strip([DEEP_LUNGE, STAND_ARMS_DOWN], (step) =>
    step === 0 ? { x: 27, y: 14, dir: 'down' } : { x: 27, y: 12, dir: 'up' },
  ),
);

// ----------------------------------------------------------------------- calf

const CALF_DOWN: Pose = { ...STAND_ARMS_DOWN };

/** Heel swings clear of the floor — the gap under it carries the movement. */
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

export const calf: Sprite = makeSprite(
  PALETTE,
  strip([CALF_UP, CALF_DOWN], (step) =>
    step === 0 ? { x: 22, y: 10, dir: 'up' } : { x: 22, y: 8, dir: 'down' },
  ),
);

// --------------------------------------------------------------------- pushup

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

export const pushup: Sprite = makeSprite(
  PALETTE,
  strip([PUSHUP_DOWN, PUSHUP_UP], (step) =>
    step === 0 ? { x: 17, y: 11, dir: 'down' } : { x: 17, y: 9, dir: 'up' },
  ),
);

// ---------------------------------------------------------------------- plank

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

/** Sagging hips — what the hold is trying to stop you doing. */
const PLANK_SAG: Pose = { ...PLANK, hip: [21, 23], knee: [26, 24] };

/**
 * Three steps: get into position, hold, release. The middle block lights the
 * core rather than moving, because a plank that visibly travels teaches the
 * exercise wrong.
 */
export const plank: Sprite = makeSprite(
  PALETTE,
  framesFromPoses([PLANK_SAG, PLANK, PLANK].map((p) => scalePose(p)), FRAMES_PER_STEP, (pose, step, t) => {
    const grid = drawPose(pose);
    // Tint the midsection of the torso, following whatever shape the shirt
    // actually occupies. Pulses with the hold rather than sitting constant.
    if (step === 1 && t > 0.4) {
      tintBody(
        grid,
        (x) => x >= pose.shoulder[0] + 2 && x <= pose.hip[0] - 2,
        SHIRT_TONES,
        'Y',
      );
    }
    ground(grid);
    return toRows(grid);
  }),
);
