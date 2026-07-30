/**
 * Breathing guides.
 *
 * Box breathing is generated rather than hand-drawn: the square genuinely
 * expands and contracts, and a marker travels its perimeter so you always know
 * which side of the box you're on. Following the animation *is* the exercise,
 * so geometric precision matters more than character here.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';

const SIZE = 24;

/**
 * Draw a centred square outline of the given half-extent, with an optional
 * bright marker at one point on the perimeter.
 */
function box(half: number, marker: { x: number; y: number } | null, fill: string): string[] {
  const grid: string[][] = Array.from({ length: SIZE }, () => new Array<string>(SIZE).fill('.'));
  const c = SIZE / 2;
  const min = Math.round(c - half);
  const max = Math.round(c + half) - 1;

  for (let x = min; x <= max; x++) {
    grid[min]![x] = fill;
    grid[max]![x] = fill;
  }
  for (let y = min; y <= max; y++) {
    grid[y]![min] = fill;
    grid[y]![max] = fill;
  }

  // A soft interior wash so the box reads as a volume filling with air.
  for (let y = min + 1; y <= max - 1; y++) {
    for (let x = min + 1; x <= max - 1; x++) {
      grid[y]![x] = 'k';
    }
  }

  if (marker) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const y = marker.y + dy;
        const x = marker.x + dx;
        if (y >= 0 && y < SIZE && x >= 0 && x < SIZE) grid[y]![x] = 'w';
      }
    }
  }

  return grid.map((row) => row.join(''));
}

/**
 * Four frames, one per side of the box: inhale (growing), hold (large),
 * exhale (shrinking), hold (small). The marker walks the perimeter clockwise.
 */
export const boxBreath: Sprite = makeSprite(PALETTE, [
  box(5, { x: 7, y: 7 }, 'l'), // inhale — top-left, growing
  box(9, { x: 20, y: 3 }, 'y'), // hold — top-right, full
  box(9, { x: 20, y: 20 }, 'y'), // exhale — bottom-right
  box(5, { x: 7, y: 16 }, 'b'), // hold — bottom-left, empty
]);

/**
 * Physiological sigh: two stacked inhales then a long release, shown as a
 * torso whose chest expands and then drops.
 */
export const sigh: Sprite = makeSprite(PALETTE, [
  // Resting.
  [
    '........................',
    '........................',
    '.........hhhhhh.........',
    '........hhhhhhhh........',
    '........hssssssh........',
    '........hsSSSSsh........',
    '........hssssssh........',
    '.........ssssss.........',
    '..........SSSS..........',
    '.......cccccccccc.......',
    '......cccccccccccc......',
    '......cccccccccccc......',
    '......cccccccccccc......',
    '......cccccccccccc......',
    '......CCCCCCCCCCCC......',
    '.......pppppppppp.......',
    '.......pppppppppp.......',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '.......ooo...ooo........',
    '........................',
    '........................',
  ],
  // First inhale — chest lifts.
  [
    '........................',
    '..........llll..........',
    '.........hhhhhh.........',
    '........hhhhhhhh........',
    '........hssssssh........',
    '........hsSSSSsh........',
    '........hssssssh........',
    '.........ssssss.........',
    '..........SSSS..........',
    '......cccccccccccc......',
    '.....cccccccccccccc.....',
    '.....cccccccccccccc.....',
    '.....cccccccccccccc.....',
    '......cccccccccccc......',
    '......CCCCCCCCCCCC......',
    '.......pppppppppp.......',
    '.......pppppppppp.......',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '.......ooo...ooo........',
    '........................',
    '........................',
  ],
  // Second, smaller top-up inhale — chest at full.
  [
    '.........llllll.........',
    '.........llllll.........',
    '.........hhhhhh.........',
    '........hhhhhhhh........',
    '........hssssssh........',
    '........hsSSSSsh........',
    '........hssssssh........',
    '.........ssssss.........',
    '..........SSSS..........',
    '.....cccccccccccccc.....',
    '....cccccccccccccccc....',
    '....cccccccccccccccc....',
    '....cccccccccccccccc....',
    '.....cccccccccccccc.....',
    '.....CCCCCCCCCCCCCC.....',
    '.......pppppppppp.......',
    '.......pppppppppp.......',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '.......ooo...ooo........',
    '........................',
    '........................',
  ],
  // Long exhale — everything drops and the breath streams away.
  [
    '........................',
    '........................',
    '.........hhhhhh.........',
    '........hhhhhhhh........',
    '........hssssssh........',
    '........hsSSSSsh........',
    '........hssssssh...bbbbb',
    '.........ssssss..bbb....',
    '..........SSSS..bb......',
    '........cccccccc........',
    '.......cccccccccc.......',
    '.......cccccccccc.......',
    '.......cccccccccc.......',
    '.......cccccccccc.......',
    '.......CCCCCCCCCC.......',
    '.......pppppppppp.......',
    '.......pppppppppp.......',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '........ppp..ppp........',
    '.......ooo...ooo........',
    '........................',
    '........................',
  ],
]);
