/**
 * Eye art.
 *
 * Rendered as a close-up rather than a figure — an eye at this size reads far
 * more clearly than a tiny person looking into the distance, and the iris
 * moving between frames makes the "look away" instruction obvious without
 * needing the caption.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';

/** Eye shape with the iris at a given horizontal offset, or shut. */
function eye(irisCol: number | null, extras: Record<number, string> = {}): string[] {
  const rows: string[] = [];

  const put = (y: number, base: string): void => {
    rows.push(extras[y] ?? base);
  };

  put(0, '........................');
  put(1, '........................');
  put(2, '........................');
  put(3, '......oooooooooooo......');
  put(4, '....oo............oo....');
  put(5, '...o................o...');

  if (irisCol === null) {
    // Shut: a single closed lash line with lashes below.
    put(6, '..o..................o..');
    put(7, '..o..................o..');
    put(8, '..oooooooooooooooooooo..');
    put(9, '...ooooooooooooooooo....');
    put(10, '....o....o....o....o....');
    put(11, '........................');
    put(12, '........................');
    put(13, '........................');
    put(14, '........................');
  } else {
    for (let y = 6; y <= 14; y++) {
      if (extras[y] !== undefined) {
        rows.push(extras[y]!);
        continue;
      }
      if (y === 6 || y === 14) {
        rows.push('..o..................o..');
        continue;
      }
      // White of the eye spanning columns 3..20, with the iris drawn on top.
      const cells = new Array<string>(24).fill('.');
      cells[2] = 'o';
      cells[21] = 'o';
      for (let x = 3; x <= 20; x++) cells[x] = 'w';

      const irisTop = 7;
      const irisBottom = 13;
      if (y >= irisTop && y <= irisBottom) {
        const radius = y === irisTop || y === irisBottom ? 2 : 3;
        for (let dx = -radius; dx <= radius; dx++) {
          const x = irisCol + dx;
          if (x >= 3 && x <= 20) cells[x] = 'b';
        }
        // Pupil and catch-light in the middle band.
        if (y >= irisTop + 2 && y <= irisBottom - 2) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = irisCol + dx;
            if (x >= 3 && x <= 20) cells[x] = 'o';
          }
        }
        if (y === irisTop + 1) {
          const x = irisCol + 1;
          if (x >= 3 && x <= 20) cells[x] = 'w';
        }
      }
      rows.push(cells.join(''));
    }
  }

  put(15, '...o................o...');
  put(16, '....oo............oo....');
  put(17, '......oooooooooooo......');
  put(18, '........................');
  put(19, '........................');
  put(20, '........................');
  put(21, '........................');
  put(22, '........................');
  put(23, '........................');

  return rows;
}

/** Iris tracks from centre out to the far distance and back. */
export const eyes: Sprite = makeSprite(PALETTE, [
  eye(11, { 20: '.........yyyyyy.........' }),
  eye(7, { 20: '...yyy..................' }),
  eye(5, { 20: '.yyy....................' }),
  eye(7, { 20: '...yyy..................' }),
]);

/** Squeeze shut, then open wide. */
export const blink: Sprite = makeSprite(PALETTE, [
  eye(11),
  eye(null),
  eye(null),
  eye(11, {
    3: '.....oooooooooooooo.....',
    4: '...oo..............oo...',
    17: '.....oooooooooooooo.....',
    16: '...oo..............oo...',
  }),
]);
