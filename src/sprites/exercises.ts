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

export const squat: Sprite = makeSprite(PALETTE, [
  // Standing tall, arms forward.
  [
    '........................',
    '........................',
    '.........hhhhhh.........',
    '........hhhhhhhh........',
    '........hssssssh........',
    '........hsossosh........',
    '........hssssssh........',
    '.........ssssss.........',
    '..........SSSS..........',
    '.......cccccccccc.......',
    '......cccccccccccc......',
    '......ccccccccccccssss..',
    '......ccccccccccccssss..',
    '......cccccccccccc......',
    '......s.cccccccc.s......',
    '........pppppppp........',
    '........pppppppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '.......ooo...ooo........',
    '........................',
  ],
  // Bottom of the squat: hips back, knees bent, arms still forward.
  [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.........hhhhhh.........',
    '........hhhhhhhh........',
    '........hssssssh........',
    '........hsossosh........',
    '........hssssssh........',
    '.........ssssss.........',
    '..........SSSS..........',
    '.....cccccccccccc.......',
    '....ccccccccccccccssss..',
    '....ccccccccccccccssss..',
    '.....cccccccccccc.......',
    '.....pppppppppppp.......',
    '....pppppppppppppp......',
    '....ppp........ppp......',
    '....ppp........ppp......',
    '....ppp........ppp......',
    '....ppp........ppp......',
    '...ooooo......ooooo.....',
    '........................',
  ],
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

export const calf: Sprite = makeSprite(PALETTE, [
  // Heels down.
  [
    '........................',
    '........................',
    '........................',
    '.........cccccc.........',
    '.........cccccc.........',
    '.........cccccc.........',
    '.........CCCCCC.........',
    '........pppppppp........',
    '........pppppppp........',
    '........pppppppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........PPP..PPP........',
    '........sss..sss........',
    '........sss..sss........',
    '.......oooo.oooo........',
    '.......oooo.oooo........',
    '........................',
    '........................',
  ],
  // Up on the toes — the whole figure rises and the heels lift clear.
  [
    '........................',
    '........................',
    '.........cccccc.........',
    '.........cccccc.........',
    '.........cccccc.........',
    '.........CCCCCC.........',
    '........pppppppp........',
    '........pppppppp........',
    '........pppppppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........PPP..PPP........',
    '........sss..sss........',
    '........sss..sss........',
    '........sss..sss........',
    '.........oo...oo........',
    '.......yy.......yy......',
    '........................',
    '........................',
  ],
]);

export const lunge: Sprite = makeSprite(PALETTE, [
  // Standing, ready.
  [
    '........................',
    '........................',
    '.........hhhhhh.........',
    '........hhhhhhhh........',
    '........hssssssh........',
    '........hsossosh........',
    '........hssssssh........',
    '.........ssssss.........',
    '..........SSSS..........',
    '.......cccccccccc.......',
    '......cccccccccccc......',
    '......sccccccccccs......',
    '......sccccccccccs......',
    '......sccccccccccs......',
    '......s.cccccccc.s......',
    '........pppppppp........',
    '........pppppppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '.......ooo...ooo........',
    '........................',
  ],
  // Front knee forward, back knee dropped toward the floor.
  [
    '........................',
    '........................',
    '........................',
    '.......hhhhhh...........',
    '......hhhhhhhh..........',
    '......hssssssh..........',
    '......hsossosh..........',
    '......hssssssh..........',
    '.......ssssss...........',
    '........SSSS............',
    '.....cccccccccc.........',
    '....cccccccccccc........',
    '....sccccccccccs........',
    '....sccccccccccs........',
    '....s.cccccccc.s........',
    '......pppppppp..........',
    '......pppppppppppp......',
    '......ppp.....PPPPPP....',
    '......ppp.........ppp...',
    '......ppp.........ppp...',
    '......ppp.........ppp...',
    '.....ooooo........ppp...',
    '..................ooo...',
    '........................',
  ],
]);
