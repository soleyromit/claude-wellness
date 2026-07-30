/**
 * Exercise poses — the activities that get you out of the chair.
 *
 * Each animates between the two ends of the rep, so the sprite doubles as the
 * rep pacer: follow the animation and you're at the right tempo.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite, rowBuilder } from './make.js';

const r = rowBuilder(24);
const _ = '........................';

/**
 * Side-view body used by plank and push-ups: a straight line from heels to
 * head, propped on one arm.
 *
 * `drop` lowers the torso. Critically, the hand and the foot stay pinned to a
 * fixed floor row while the torso moves, so the supporting arm gets *shorter*
 * as the body descends. Moving the whole figure instead — the obvious way to
 * build this — animates a person levitating with a rigid arm, which is not
 * what a push-up looks like.
 *
 * Columns are fixed across every row: head x2-7, torso x7-16, hips and legs
 * x17-23, supporting arm x5-6. Declaring them once is what keeps the body
 * connected instead of drifting apart row by row.
 */
const FLOOR_ROW = 19;

function sideBody(drop: number, extras: Record<number, string> = {}): string[] {
  const rows = new Array<string>(24).fill(_);
  const put = (y: number, value: string): void => {
    if (y >= 0 && y < 24) rows[y] = value;
  };

  const top = 4 + drop;

  put(top, r([3, 'hhhh']));
  put(top + 1, r([2, 'hhhhhh']));
  put(top + 2, r([2, 'hssssh']));
  put(top + 3, r([2, 'sossss'], [8, 'cccc']));
  put(top + 4, r([2, 'hssss'], [7, 'cccccccccc'], [17, 'pppp']));
  put(top + 5, r([3, 'SSS'], [6, 'ss'], [8, 'ccccccccc'], [17, 'ppppppp']));
  put(top + 6, r([5, 'ss'], [7, 'cccccccccc'], [17, 'ppppppp']));
  put(top + 7, r([5, 'ss'], [8, 'cccccccc'], [16, 'PPPPPPPP']));

  // Arm and leg reach down to the floor from wherever the torso ended up.
  for (let y = top + 8; y < FLOOR_ROW; y++) {
    put(y, r([5, 'ss'], [18, 'ppp']));
  }
  put(FLOOR_ROW, r([4, 'oooo'], [18, 'ooo']));
  put(FLOOR_ROW + 1, r([2, 'aaaaaaaaaaaaaaaaaaaa']));

  for (const [y, value] of Object.entries(extras)) put(Number(y), value);
  return rows;
}

/**
 * Front-facing standing figure, used by squats, lunges and calf raises.
 *
 * `sink` lowers the hips while the feet stay on a fixed floor row, so the legs
 * compress instead of the whole person sliding down the canvas. `arms` chooses
 * where the hands go, which is most of what distinguishes these three
 * movements at 24 pixels.
 */
const FOOT_ROW = 22;

function standing(
  sink: number,
  arms: 'down' | 'forward',
  extras: Record<number, string> = {},
): string[] {
  const rows = new Array<string>(24).fill(_);
  const put = (y: number, value: string): void => {
    if (y >= 0 && y < 24) rows[y] = value;
  };

  const top = 2 + sink;

  put(top, r([9, 'hhhhhh']));
  put(top + 1, r([8, 'hhhhhhhh']));
  put(top + 2, r([8, 'hssssssh']));
  put(top + 3, r([8, 'hsossosh']));
  put(top + 4, r([8, 'hssssssh']));
  put(top + 5, r([9, 'ssssss']));
  put(top + 6, r([10, 'SSSS']));

  // Torso. Widening it as the hips sink reads as the body folding forward.
  const spread = sink > 0 ? 1 : 0;
  put(top + 7, r([7 - spread, 'c'.repeat(10 + spread * 2)]));
  for (const dy of [8, 9, 10]) {
    put(top + dy, r([6 - spread, 'c'.repeat(12 + spread * 2)]));
  }
  put(top + 11, r([7 - spread, 'C'.repeat(10 + spread * 2)]));

  if (arms === 'forward') {
    // Counterbalance: hands out in front, joined to the shoulders.
    put(top + 8, r([6 - spread, 'c'.repeat(12 + spread * 2)], [18 + spread, 'ssss']));
    put(top + 9, r([6 - spread, 'c'.repeat(12 + spread * 2)], [18 + spread, 'ssss']));
  } else {
    put(top + 8, r([6 - spread, 's'], [7 - spread, 'c'.repeat(10 + spread * 2)], [17 + spread, 's']));
    put(top + 9, r([6 - spread, 's'], [7 - spread, 'c'.repeat(10 + spread * 2)], [17 + spread, 's']));
  }

  // Hips, then legs dropping to a fixed floor.
  const hipRow = top + 12;
  put(hipRow, r([8 - spread, 'p'.repeat(8 + spread * 2)]));
  put(hipRow + 1, r([8 - spread, 'p'.repeat(8 + spread * 2)]));
  // Legs and feet are identical in every pose. Only their *length* changes as
  // the hips sink, which is what compressing into a squat actually looks like —
  // widening the stance instead would animate the feet sliding across the floor.
  for (let y = hipRow + 2; y < FOOT_ROW; y++) {
    put(y, r([8, 'ppp'], [13, 'ppp']));
  }
  put(FOOT_ROW, r([7, 'oooo'], [13, 'oooo']));

  for (const [y, value] of Object.entries(extras)) put(Number(y), value);
  return rows;
}

export const squat: Sprite = makeSprite(PALETTE, [
  // Standing tall.
  standing(0, 'forward'),
  // Bottom of the squat: hips sink, knees track out, feet have not moved.
  standing(3, 'forward'),
]);

export const pushup: Sprite = makeSprite(PALETTE, [
  // Top of the rep: arm fully extended.
  sideBody(0),
  // Bottom: torso down, arm folded short. Hand and toes have not moved.
  sideBody(4),
]);

export const plank: Sprite = makeSprite(PALETTE, [
  // Held low on the forearms.
  sideBody(5),
  // The same hold with the core lit up. A plank pulses; it does not travel,
  // so animating movement here would be teaching the exercise wrong.
  sideBody(5, { 16: r([5, 'ss'], [7, 'yyyyyyyyyy'], [17, 'ppppppp']) }),
]);

/**
 * Calf raises. The full figure is drawn rather than a cropped pair of legs —
 * cropped legs read as a bug, and seeing the whole body rise is what makes the
 * movement obvious.
 */
export const calf: Sprite = makeSprite(PALETTE, [
  // Heels down, flat feet.
  standing(1, 'down'),
  // Up on the toes: the body rises a pixel and the heels lift clear of the
  // floor, leaving only the balls of the feet down.
  standing(0, 'down', {
    1: r([9, 'yyyyyy']),
    [FOOT_ROW - 1]: r([8, 'sss'], [13, 'sss']),
    [FOOT_ROW]: r([8, 'oo'], [14, 'oo']),
  }),
]);

/**
 * Lunge, side-on. The back foot stays where it started and the front foot
 * steps forward — anchoring both feet, as the standing poses do, would make the
 * step itself invisible.
 */
export const lunge: Sprite = makeSprite(PALETTE, [
  // Standing, feet together.
  standing(0, 'down'),
  // Front knee forward, back knee dropped toward the floor.
  [
    _,
    _,
    _,
    r([6, 'hhhhhh']),
    r([5, 'hhhhhhhh']),
    r([5, 'hssssssh']),
    r([5, 'hsossosh']),
    r([5, 'hssssssh']),
    r([6, 'ssssss']),
    r([7, 'SSSS']),
    r([4, 'cccccccccc']),
    r([3, 'cccccccccccc']),
    r([3, 'sccccccccccs']),
    r([3, 'sccccccccccs']),
    r([3, 's'], [4, 'cccccccccc'], [14, 's']),
    r([5, 'pppppppp']),
    r([5, 'pppppppppppppp']),
    r([5, 'ppp'], [13, 'PPPPPP']),
    r([5, 'ppp'], [16, 'ppp']),
    r([5, 'ppp'], [16, 'ppp']),
    r([5, 'ppp'], [16, 'ppp']),
    r([4, 'ooooo'], [16, 'ppp']),
    r([16, 'oooo']),
    _,
  ],
]);
