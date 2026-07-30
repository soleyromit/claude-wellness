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
