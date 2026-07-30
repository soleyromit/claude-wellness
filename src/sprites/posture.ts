/**
 * Posture check: the same person slouched, then stacked properly.
 *
 * Two design decisions carry the whole sprite:
 *
 *  - The hips, legs and seat are pixel-identical in both frames. Only the spine
 *    and head move. An earlier version redrew each pose independently, so the
 *    figure slid sideways between frames and the correction was lost in the
 *    movement.
 *  - A dotted plumb line runs behind the body. Upright, the head and shoulders
 *    cover it; slouched, it shows through the gap where the head should have
 *    been. That turns "ears over shoulders" from a caption into something you
 *    can actually see.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite, rowBuilder } from './make.js';

const r = rowBuilder(24);

/** Column the ear, shoulder and hip should stack on. */
const PLUMB_X = 11;

function pose(upper: Readonly<Record<number, string>>): string[] {
  const rows = new Array<string>(24).fill('........................');

  // Plumb line first, so the body draws over it.
  for (let y = 2; y <= 16; y += 2) {
    rows[y] = r([PLUMB_X, 'a']);
  }

  const merge = (y: number, value: string): void => {
    const base = [...rows[y]!];
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== '.') base[i] = value[i]!;
    }
    rows[y] = base.join('');
  };

  for (const [y, value] of Object.entries(upper)) merge(Number(y), value);

  // Everything below the waist is fixed: seat, hips, thigh, lower leg, foot.
  merge(16, r([8, 'pppppppp']));
  merge(17, r([7, 'pppppppppppp']));
  merge(18, r([7, 'PPPPPPPPPPPP']));
  merge(19, r([7, 'ppp']));
  merge(20, r([7, 'ppp']));
  merge(21, r([7, 'ppp']));
  merge(22, r([6, 'ooooo']));

  return rows;
}

export const posture: Sprite = makeSprite(PALETTE, [
  // Slouched: head juts forward of the plumb line, upper back rounds over.
  pose({
    4: r([2, 'hhhhh']),
    5: r([1, 'hhhhhhh']),
    6: r([1, 'hsossh']),
    7: r([1, 'hsssss']),
    8: r([2, 'ssss']),
    9: r([3, 'SSS']),
    10: r([4, 'ccc']),
    11: r([5, 'ccccc']),
    12: r([6, 'cccccc']),
    13: r([7, 'ccccccc']),
    14: r([8, 'cccccc']),
    15: r([8, 'CCCCCC']),
  }),
  // Stacked: ear over shoulder over hip, all on the plumb line.
  pose({
    2: r([9, 'yyyyy']),
    4: r([9, 'hhhhh']),
    5: r([8, 'hhhhhhh']),
    6: r([8, 'hsossh']),
    7: r([8, 'hsssss']),
    8: r([9, 'ssss']),
    9: r([10, 'SSS']),
    10: r([8, 'cccccc']),
    11: r([8, 'cccccc']),
    12: r([8, 'cccccc']),
    13: r([8, 'cccccc']),
    14: r([8, 'cccccc']),
    15: r([8, 'CCCCCC']),
  }),
]);
