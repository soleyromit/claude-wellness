/**
 * Stretch poses.
 *
 * Each sprite animates between two frames — the two ends of the movement —
 * which is exactly what a stretch demo needs: you can see where to start and
 * where to finish. The silhouettes are deliberately distinct so you can tell
 * which stretch it is at a glance without reading the title.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite, rowBuilder } from './make.js';

const r = rowBuilder(24);
const _ = '........................';

/**
 * Cat-cow, drawn as one animal on all fours whose spine curves between frames.
 *
 * The head, hands, knees and floor stay in exactly the same place; only the
 * back moves. Authoring the two poses independently is what produced the
 * original broken version — the frames landed in different parts of the canvas
 * and the animation read as a jump cut rather than a spine arching.
 *
 * `spine` gives the top edge of the torso for each of the twelve body columns,
 * as an offset downward. A hump in the middle is cat; a dip is cow.
 */
function allFours(
  spine: readonly number[],
  headRows: readonly string[],
  headTop: number,
): string[] {
  const rows = new Array<string>(24).fill(_);
  const BODY_X = 8;
  const TOP = 10;
  const BELLY = 17;

  // Build the torso column by column so the back is a continuous curve.
  const grid: string[][] = Array.from({ length: 24 }, () => new Array<string>(24).fill('.'));
  spine.forEach((offset, i) => {
    const x = BODY_X + i;
    const top = TOP + offset;
    for (let y = top; y <= BELLY; y++) {
      grid[y]![x] = y === top ? 'C' : 'c';
    }
  });

  for (let y = 0; y < 24; y++) rows[y] = grid[y]!.join('');

  // Head sits at the left, and the neck bridges it to the shoulders. The head
  // has to ride with the front of the spine: when the back arches, the
  // shoulders lift away and a fixed head would be left floating.
  headRows.forEach((line, i) => {
    rows[headTop + i] = mergeRow(rows[headTop + i]!, line);
  });
  rows[headTop + 4] = mergeRow(rows[headTop + 4]!, r([5, 'sss']));
  rows[headTop + 5] = mergeRow(rows[headTop + 5]!, r([5, 'SSS']));

  // Front and back legs drop to a shared floor.
  for (let y = BELLY + 1; y <= 19; y++) {
    rows[y] = mergeRow(rows[y]!, r([9, 'pp'], [17, 'pp']));
  }
  rows[20] = mergeRow(rows[20]!, r([8, 'oooo'], [16, 'oooo']));
  rows[21] = r([4, 'aaaaaaaaaaaaaaaa']);

  return rows;
}

/** Overlay non-transparent pixels of `over` onto `base`. */
function mergeRow(base: string, over: string): string {
  const cells = [...base];
  for (let i = 0; i < over.length && i < cells.length; i++) {
    if (over[i] !== '.') cells[i] = over[i]!;
  }
  return cells.join('');
}

export const wrists: Sprite = makeSprite(PALETTE, [
  // Palm up, fingers pulled back.
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
    '......cccccccccccssssss.',
    '......ccccccccccc.sSss..',
    '......s.cccccccc........',
    '......s.cccccccc........',
    '........pppppppp........',
    '........pppppppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '.......ooo...ooo........',
    '........................',
  ],
  // Palm down, fingers pulled toward you.
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
    '......cccccccccccc......',
    '......ccccccccccccssss..',
    '......cccccccccccssssss.',
    '......s.cccccccc..sSss..',
    '......s.cccccccc........',
    '........pppppppp........',
    '........pppppppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '.......ooo...ooo........',
    '........................',
  ],
]);

export const neck: Sprite = makeSprite(PALETTE, [
  // Ear toward the right shoulder.
  [
    '........................',
    '........................',
    '..........hhhhhh........',
    '.........hhhhhhhh.......',
    '........hsssssssh.......',
    '........ssssssosh.......',
    '........hsssssssh.......',
    '..........ssssss........',
    '...........SSSS.........',
    '.......cccccccccc.......',
    '......cccccccccccc......',
    '......sccccccccccs......',
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
    '.......ooo...ooo........',
    '........................',
  ],
  // Ear toward the left shoulder.
  [
    '........................',
    '........................',
    '........hhhhhh..........',
    '.......hhhhhhhh.........',
    '.......hsssssssh........',
    '.......hsossssss........',
    '.......hsssssssh........',
    '........ssssss..........',
    '.........SSSS...........',
    '.......cccccccccc.......',
    '......cccccccccccc......',
    '......sccccccccccs......',
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
    '.......ooo...ooo........',
    '........................',
  ],
]);

export const shoulders: Sprite = makeSprite(PALETTE, [
  // Shoulders down, relaxed.
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
    '......sccccccccccs......',
    '......s.cccccccc.s......',
    '........pppppppp........',
    '........pppppppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '.......ooo...ooo........',
    '........................',
  ],
  // Shrugged up to the ears.
  [
    '........................',
    '........................',
    '.........hhhhhh.........',
    '........hhhhhhhh........',
    '........hssssssh........',
    '........hsossosh........',
    '.yyy....hssssssh....yyy.',
    '......c..ssssss..c......',
    '.....ccc..SSSS..ccc.....',
    '.....cccccccccccccc.....',
    '......cccccccccccc......',
    '......sccccccccccs......',
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
    '.......ooo...ooo........',
    '........................',
  ],
]);

export const chest: Sprite = makeSprite(PALETTE, [
  // Hands clasped behind the back, arms low.
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
    '.....CccccccccccccC.....',
    '.....CccccccccccccC.....',
    '.....CccccccccccccC.....',
    '......ssccccccccss......',
    '.......ssssssssss.......',
    '........pppppppp........',
    '........pppppppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '.......ooo...ooo........',
    '........................',
  ],
  // Arms swept up and back, chest open, chin lifted. Each arm is a continuous
  // diagonal from the shoulder outward — the earlier version scattered
  // detached pixels either side of the torso, which read as speckle.
  [
    _,
    r([2, 'yy'], [20, 'yy']),
    r([9, 'hhhhhh']),
    r([8, 'hhhhhhhh']),
    r([8, 'hssssssh']),
    r([8, 'hsSSSSsh']),
    r([2, 'ss'], [8, 'hssssssh'], [20, 'ss']),
    r([3, 'ss'], [9, 'ssssss'], [19, 'ss']),
    r([4, 'ss'], [10, 'SSSS'], [18, 'ss']),
    r([5, 'ss'], [7, 'cccccccccc'], [17, 'ss']),
    r([6, 'Cccccccccccc']),
    r([6, 'cccccccccccc']),
    r([6, 'cccccccccccc']),
    r([7, 'cccccccccc']),
    r([8, 'cccccccc']),
    r([8, 'CCCCCCCC']),
    // Hips down match frame 0 exactly, so the chest opens without the whole
    // figure bobbing up and down.
    r([8, 'pppppppp']),
    r([8, 'pppppppp']),
    r([8, 'ppp'], [13, 'ppp']),
    r([8, 'ppp'], [13, 'ppp']),
    r([8, 'ppp'], [13, 'ppp']),
    r([8, 'ppp'], [13, 'ppp']),
    r([7, 'ooo'], [13, 'ooo']),
    _,
  ],
]);

export const twist: Sprite = makeSprite(PALETTE, [
  // Seated, twisted to the right.
  [
    '........................',
    '........................',
    '..........hhhhhh........',
    '.........hhhhhhhh.......',
    '........hsssssssh.......',
    '........ssssssosh.......',
    '........hsssssssh.......',
    '..........ssssss........',
    '...........SSSS.........',
    '........cccccccccc......',
    '.......cccccccccccc.....',
    '.....ssccccccccccccss...',
    '....sss.ccccccccc..ss...',
    '........cccccccc........',
    '........pppppppp........',
    '......pppppppppppp......',
    '......ppppppppppppppp...',
    '......PPPPPPPPPPPPPPP...',
    '......ppp...............',
    '......ppp...............',
    '......ppp...............',
    '......ppp...............',
    '.....ooooo..............',
    '........................',
  ],
  // Seated, twisted to the left.
  [
    '........................',
    '........................',
    '........hhhhhh..........',
    '.......hhhhhhhh.........',
    '.......hsssssssh........',
    '.......hsossssss........',
    '.......hsssssssh........',
    '........ssssss..........',
    '.........SSSS...........',
    '......cccccccccc........',
    '.....cccccccccccc.......',
    '...ssccccccccccccss.....',
    '...ss..ccccccccc.sss....',
    '........cccccccc........',
    '........pppppppp........',
    '......pppppppppppp......',
    '...ppppppppppppppp......',
    '...PPPPPPPPPPPPPPP......',
    '...............ppp......',
    '...............ppp......',
    '...............ppp......',
    '...............ppp......',
    '..............ooooo.....',
    '........................',
  ],
]);

export const catcow: Sprite = makeSprite(PALETTE, [
  // Cow: back sags, chest opens, head lifts.
  allFours(
    [1, 2, 3, 4, 4, 4, 4, 4, 3, 2, 1, 1],
    [r([1, 'hhhhh']), r([0, 'hhhhhhh']), r([0, 'hsossh']), r([0, 'hssssh'])],
    8,
  ),
  // Cat: spine rounds up and the chin tucks down toward the chest.
  allFours(
    [4, 3, 1, 0, 0, 0, 0, 0, 1, 2, 3, 4],
    [r([2, 'hhhhh']), r([1, 'hhhhhh']), r([1, 'hssssh']), r([1, 'hsooss'])],
    10,
  ),
]);

/**
 * Ankle circles: a lower leg with the foot rotating around a fixed ankle.
 *
 * The leg, the ankle joint and the faint arc are identical in every frame, so
 * the only thing that moves is the foot. The previous version mirrored a pair
 * of decorative arcs while leaving the foot itself untouched, which meant the
 * one thing the animation existed to demonstrate — rotation — never happened.
 */
function ankle(foot: readonly (readonly [y: number, x: number, pixels: string])[]): string[] {
  const rows = new Array<string>(24).fill(_);

  // Shin, fixed in every frame.
  for (let y = 2; y <= 8; y++) rows[y] = r([8, 'pppppppp']);
  rows[9] = r([8, 'PPPPPPPP']);
  for (let y = 10; y <= 13; y++) rows[y] = r([9, 'ssssss']);
  rows[14] = r([9, 'sSSSSs']);
  // Ankle joint — the pivot everything else turns around.
  rows[15] = r([9, 'ssssss']);

  // Faint arc showing the path of the toe.
  rows[12] = mergeRow(rows[12]!, r([19, 'y']));
  rows[14] = mergeRow(rows[14]!, r([21, 'y']));
  rows[17] = mergeRow(rows[17]!, r([22, 'y']));
  rows[20] = mergeRow(rows[20]!, r([21, 'y']));
  rows[22] = mergeRow(rows[22]!, r([18, 'y']));

  for (const [y, x, pixels] of foot) {
    rows[y] = mergeRow(rows[y]!, r([x, pixels]));
  }

  return rows;
}

export const ankles: Sprite = makeSprite(PALETTE, [
  // Toe pointed down.
  ankle([
    [16, 9, 'ssssss'],
    [17, 11, 'sssss'],
    [18, 13, 'ssss'],
    [19, 14, 'oooo'],
  ]),
  // Foot flat, pointing forward.
  ankle([
    [16, 9, 'ssssssss'],
    [17, 9, 'sssssssss'],
    [18, 9, 'ooooooooo'],
  ]),
  // Toe lifted.
  ankle([
    [13, 16, 'sss'],
    [14, 14, 'ssss'],
    [15, 11, 'sssss'],
    [16, 9, 'sssssss'],
    [17, 9, 'oooooo'],
  ]),
  // Back through flat, so the loop reads as a circle rather than a flick.
  ankle([
    [16, 9, 'ssssssss'],
    [17, 9, 'sssssssss'],
    [18, 9, 'ooooooooo'],
  ]),
]);
