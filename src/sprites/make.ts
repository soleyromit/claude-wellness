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
  /**
   * Apply automatic edge shading. On by default for figure art; turn it off
   * for sprites that already carry their own hand-placed tones.
   */
  readonly shade?: boolean;
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

/**
 * Materials that get automatic edge shading: mid tone -> [highlight, shadow].
 *
 * Keyed by the flat character an artist writes; the pass replaces the first and
 * last pixel of each horizontal run with the lit and shadowed tones.
 */
const SHADING: Readonly<Record<string, readonly [light: string, shade: string]>> = {
  c: ['4', 'C'], // shirt
  s: ['1', 'S'], // skin
  p: ['6', 'P'], // trousers
  h: ['3', 'H'], // hair
  n: ['7', 'N'], // plant
  m: ['9', 'M'], // terracotta
  b: ['l', 'B'], // water
};

/** Runs shorter than this stay flat — shading a 2px limb just recolours it. */
const MIN_RUN = 3;

/**
 * Add rim lighting to flat-coloured art.
 *
 * Sprites are authored in flat mid-tones because that is what is legible to
 * write and edit by hand. Depth comes from this pass instead: every horizontal
 * run of a material gets a lit pixel on the left and a shadowed one on the
 * right, so light falls consistently from the upper left across every sprite
 * without anyone hand-placing a single highlight.
 *
 * Doing it as a transform rather than in the source keeps the art editable —
 * you still read and change flat shapes, not a mosaic of four near-identical
 * characters.
 */
export function shadeFrames(frames: readonly (readonly string[])[]): string[][] {
  return frames.map((frame) =>
    frame.map((line) => {
      const cells = [...line];
      let x = 0;
      while (x < cells.length) {
        const ch = cells[x]!;
        const ramp = SHADING[ch];
        if (!ramp) {
          x++;
          continue;
        }
        let run = 1;
        while (x + run < cells.length && cells[x + run] === ch) run++;
        if (run >= MIN_RUN) {
          cells[x] = ramp[0];
          cells[x + run - 1] = ramp[1];
        }
        x += run;
      }
      return cells.join('');
    }),
  );
}

export function makeSprite(
  palette: Readonly<Record<string, string>>,
  input: readonly (readonly string[])[],
  options: MakeOptions = {},
): Sprite {
  const label = options.name ? `Sprite "${options.name}"` : 'Sprite';

  if (input.length === 0) throw new Error(`${label} has no frames`);

  // Shade before validating, so the validator checks what actually renders.
  const frames = options.shade === false ? input : shadeFrames(input);

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
