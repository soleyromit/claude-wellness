/**
 * Validating sprite constructor.
 *
 * Pixel art authored as string literals is easy to get subtly wrong — one
 * missing dot shifts an entire row and the sprite renders skewed rather than
 * failing. Validating at module load turns that into a loud error at startup
 * (and, more usefully, a failing test) instead of art that looks slightly off.
 */

import type { Sprite } from '../render/pixel.js';

export interface MakeOptions {
  readonly name?: string;
}

/** A run of pixels placed at an explicit column. */
export type Segment = readonly [x: number, pixels: string];

/**
 * Build one row by placing segments at explicit columns.
 *
 * Hand-counting leading dots to align a limb is how sprites end up with
 * disconnected torsos and floating hands: the arithmetic is invisible in the
 * source, so a row that is one pixel out looks exactly like one that isn't.
 * Stating the column makes alignment reviewable — two rows that should line up
 * carry the same number — and overlaps or overruns throw instead of silently
 * shifting the art.
 */
export function row(width: number, ...segments: Segment[]): string {
  const cells = new Array<string>(width).fill('.');

  for (const [x, pixels] of segments) {
    if (x < 0 || x + pixels.length > width) {
      throw new Error(`Segment "${pixels}" at x=${x} does not fit in width ${width}`);
    }
    for (let i = 0; i < pixels.length; i++) {
      const ch = pixels[i]!;
      if (ch === '.') continue; // explicit hole, leaves whatever is there
      cells[x + i] = ch;
    }
  }

  return cells.join('');
}

/** `row` bound to a fixed canvas width, for a whole sprite file. */
export function rowBuilder(width: number): (...segments: Segment[]) => string {
  return (...segments) => row(width, ...segments);
}

export function makeSprite(
  palette: Readonly<Record<string, string>>,
  frames: readonly (readonly string[])[],
  options: MakeOptions = {},
): Sprite {
  const label = options.name ? `Sprite "${options.name}"` : 'Sprite';

  if (frames.length === 0) throw new Error(`${label} has no frames`);

  const height = frames[0]!.length;
  const width = frames[0]![0]?.length ?? 0;
  if (width === 0) throw new Error(`${label} has zero width`);

  frames.forEach((frame, f) => {
    if (frame.length !== height) {
      throw new Error(`${label} frame ${f} has ${frame.length} rows, expected ${height}`);
    }
    frame.forEach((row, y) => {
      if (row.length !== width) {
        throw new Error(
          `${label} frame ${f} row ${y} is ${row.length} chars, expected ${width}: "${row}"`,
        );
      }
      for (const ch of row) {
        if (ch !== '.' && ch !== ' ' && palette[ch] === undefined) {
          throw new Error(`${label} frame ${f} row ${y} uses unknown palette key "${ch}"`);
        }
      }
    });
  });

  return { width, height, palette, frames };
}
