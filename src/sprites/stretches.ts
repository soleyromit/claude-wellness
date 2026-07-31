/**
 * Stretch poses, one key pose per instruction step, animated between them.
 *
 * The old version was the source of the worst problem in the app: several
 * stretches had five instruction steps and a two-frame sprite, so playback
 * cycled 0,1,0,1,0 and step three showed the pose for step one. The picture
 * actively contradicted the words, which makes a stretch impossible to follow
 * no matter how detailed the art is.
 *
 * Every stretch here has exactly one pose per step, and the figure eases
 * between them so you see the movement rather than just its endpoints.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';
import {
  blankFigure,
  drawPose,
  framesFromPoses,
  ground,
  limb,
  plot,
  toRows,
  type Pose,
} from './figure.js';
import { FRAMES_PER_STEP } from './exercises.js';

function strip(poses: readonly Pose[], decorate?: (grid: string[][], step: number) => void): string[][] {
  return framesFromPoses(poses, FRAMES_PER_STEP, (pose, step) => {
    const grid = drawPose(pose);
    ground(grid);
    decorate?.(grid, step);
    return toRows(grid);
  });
}

/** Neutral standing figure every stretch departs from. */
const BASE: Pose = {
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

const arm = (elbow: [number, number], hand: [number, number]): Pose => ({
  ...BASE,
  elbow,
  hand,
});

// -------------------------------------------------------------------- wrists

/**
 * Five steps, five arm positions. The forearm angle and hand height carry the
 * difference — palm up is held low with the arm extended, palm down comes up
 * and in, the fist draws back toward the shoulder.
 */
export const wrists: Sprite = makeSprite(
  PALETTE,
  strip(
    [
      arm([16, 14], [21, 15]), // arm out, palm up, fingers pulled back
      arm([16, 15], [21, 12]), // palm down, fingers pulled toward you
      arm([15, 14], [19, 10]), // spread wide, then fist
      arm([8, 14], [3, 15]), // other hand, palm up
      arm([8, 15], [3, 12]), // other hand, palm down
    ],
    (grid, step) => {
      // A small mark at the fingertips shows which way to pull.
      const tip: [number, number] = step >= 3 ? [2, 13] : [22, 13];
      plot(grid, tip[0], tip[1], 'y');
      plot(grid, tip[0], tip[1] + 1, 'y');
    },
  ),
);

// ---------------------------------------------------------------------- neck

const tiltHead = (dx: number, dy: number): Pose => ({
  ...BASE,
  head: [12 + dx, 6 + dy],
});

export const neck: Sprite = makeSprite(
  PALETTE,
  strip([
    tiltHead(3, 1), // ear toward right shoulder
    tiltHead(0, 2), // chin down to chest
    tiltHead(-3, 1), // ear toward left shoulder
    tiltHead(0, 0), // slow half-circle back to centre
  ]),
);

// ----------------------------------------------------------------- shoulders

export const shoulders: Sprite = makeSprite(
  PALETTE,
  strip([
    { ...BASE, shoulder: [12, 10], elbow: [13, 14], hand: [13, 18] }, // lifted to the ears
    BASE, // dropped and released
  ]),
);

// --------------------------------------------------------------------- chest

export const chest: Sprite = makeSprite(
  PALETTE,
  strip([
    { ...BASE, elbow: [9, 17], hand: [7, 20] }, // hands clasped behind
    { ...BASE, head: [13, 5], shoulder: [12, 11], elbow: [7, 15], hand: [4, 12] }, // lifted, chest open
    BASE, // released
  ]),
);

// --------------------------------------------------------------------- twist

/** Seated: hips low and fixed, only the upper body rotates. */
const SEATED: Pose = {
  head: [12, 8],
  shoulder: [12, 14],
  elbow: [13, 17],
  hand: [13, 20],
  hip: [12, 20],
  knee: [19, 21],
  ankle: [19, 26],
  toe: [23, 28],
  heel: [16, 28],
};

export const twist: Sprite = makeSprite(
  PALETTE,
  strip([
    SEATED, // sit tall, feet flat
    { ...SEATED, head: [14, 8], shoulder: [14, 14], elbow: [18, 16], hand: [20, 18] }, // twist right
    SEATED, // back to centre
    { ...SEATED, head: [10, 8], shoulder: [10, 14], elbow: [6, 16], hand: [4, 18] }, // twist left
  ]),
);

// ------------------------------------------------------------------- cat-cow

/** On all fours: hips and shoulders fixed, the spine between them moves. */
const ALL_FOURS: Pose = {
  head: [7, 16],
  shoulder: [11, 18],
  elbow: [10, 22],
  hand: [10, 27],
  hip: [21, 18],
  knee: [24, 22],
  ankle: [24, 27],
  toe: [27, 28],
};

export const catcow: Sprite = makeSprite(
  PALETTE,
  strip([
    // Cow: chest drops, head lifts.
    { ...ALL_FOURS, head: [6, 13], shoulder: [11, 20] },
    // Cat: spine rounds up, chin tucks under.
    { ...ALL_FOURS, head: [9, 19], shoulder: [11, 15] },
  ]),
);

// -------------------------------------------------------------------- ankles

/**
 * Ankle circles, drawn as a close-up of one lower leg.
 *
 * A seated whole-body figure puts the foot at four or five pixels, which is far
 * too small to show rotation — the one thing this exercise is. Cropping to the
 * shin and foot gives the movement the whole canvas, and the foot sweeps
 * through a real arc rather than snapping between positions.
 */
function ankleFrame(angleDeg: number, mirrored: boolean): string[] {
  const grid = blankFigure();
  const ANKLE: [number, number] = [16, 19];
  const rad = (angleDeg * Math.PI) / 180;
  const dir = mirrored ? -1 : 1;

  // Shin, fixed in every frame so only the foot appears to move.
  limb(grid, [16, 3], [16, 12], 7, 'p');
  limb(grid, [16, 12], ANKLE, 5, 's');

  // Foot: a limb from the ankle out to the toe, plus a short heel behind it.
  const toe: [number, number] = [
    ANKLE[0] + dir * 8 * Math.cos(rad),
    ANKLE[1] + 8 * Math.sin(rad),
  ];
  const heel: [number, number] = [
    ANKLE[0] - dir * 3.5 * Math.cos(rad - 0.5),
    ANKLE[1] - 3.5 * Math.sin(rad - 0.5),
  ];
  limb(grid, ANKLE, toe, 4, 's');
  limb(grid, ANKLE, heel, 3, 'S');

  // Faint arc tracing the path the toe travels.
  for (let a = -70; a <= 110; a += 15) {
    const r = (a * Math.PI) / 180;
    plot(grid, ANKLE[0] + dir * 11 * Math.cos(r), ANKLE[1] + 11 * Math.sin(r), 'y');
  }

  ground(grid, 30);
  return toRows(grid);
}

/** Four steps: each foot rotates one way, then the other. */
export const ankles: Sprite = makeSprite(
  PALETTE,
  [
    { from: -70, to: 110, mirrored: false },
    { from: 110, to: -70, mirrored: false },
    { from: -70, to: 110, mirrored: true },
    { from: 110, to: -70, mirrored: true },
  ].flatMap(({ from, to, mirrored }) =>
    Array.from({ length: FRAMES_PER_STEP }, (_, i) =>
      ankleFrame(from + ((to - from) * i) / (FRAMES_PER_STEP - 1), mirrored),
    ),
  ),
);
