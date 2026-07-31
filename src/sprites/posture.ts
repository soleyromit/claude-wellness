/**
 * Posture check: three steps, three positions, with a plumb line to align to.
 *
 * The plumb line is drawn behind the body. Slouched, it shows through the gap
 * where your head should be; stacked, the body covers it. That turns "ears over
 * shoulders" from a caption into something you can see and correct against.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';
import { drawPose, framesFromPoses, ground, plot, scalePose, toRows, type Pose } from './figure.js';
import { FRAMES_PER_STEP } from './exercises.js';

/** Column the ear, shoulder and hip should stack on. */
const PLUMB_X = 18; // 12 on the authoring grid, scaled to the 48 canvas

/** Seated at a desk, slouched: head jutting forward of the plumb line. */
const SLOUCHED: Pose = {
  head: [17, 10],
  shoulder: [13, 15],
  elbow: [16, 18],
  hand: [19, 20],
  hip: [11, 20],
  knee: [18, 21],
  ankle: [18, 26],
  toe: [22, 28],
  heel: [15, 28],
};

/** Sat back into the chair — hips first, before the spine can stack. */
const SAT_BACK: Pose = {
  ...SLOUCHED,
  head: [15, 9],
  shoulder: [12, 15],
  hip: [10, 20],
};

/** Stacked: ear over shoulder over hip, feet flat. */
const STACKED: Pose = {
  head: [12, 8],
  shoulder: [12, 14],
  elbow: [14, 18],
  hand: [17, 20],
  hip: [11, 20],
  knee: [18, 21],
  ankle: [18, 26],
  toe: [22, 28],
  heel: [15, 28],
};

export const posture: Sprite = makeSprite(
  PALETTE,
  framesFromPoses([SLOUCHED, SAT_BACK, STACKED].map((p) => scalePose(p)), FRAMES_PER_STEP, (pose) => {
    const grid = drawPose(pose);

    // Plumb line behind the figure: only visible where the body isn't.
    for (let y = 6; y <= 30; y += 2) {
      if (grid[y]![PLUMB_X] === '.') plot(grid, PLUMB_X, y, 'a');
    }

    ground(grid);
    return toRows(grid);
  }),
);
