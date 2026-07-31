/**
 * The pixel compositor.
 *
 * Terminal cells are roughly twice as tall as they are wide, so drawing one
 * logical pixel per cell gives squashed, blocky art. Instead we pack two
 * vertically-stacked pixels into each cell using the upper-half-block glyph
 * `▀`: the glyph's foreground colour paints the top pixel and its background
 * colour paints the bottom one. That doubles vertical resolution and makes
 * pixels roughly square — this is what lets the sprites read as detailed.
 *
 * (This is the same model as `PixelGrid` in the author's claude-games
 * `engine.py`, lifted to TypeScript and upgraded from 8 ANSI colours to 24-bit.)
 *
 * `renderGrid` is pure: grid in, string out. No terminal required, so sprite
 * output is snapshot-testable.
 */

import { RESET, bgCode, fgCode, hexToRgb, type ColorDepth, type RGB } from './palette.js';

const UPPER_HALF = '▀'; // ▀
const LOWER_HALF = '▄'; // ▄

/** A pixel is either a colour or transparent. */
export type Pixel = RGB | null;

/**
 * A sprite as authored: frames of character rows, where each character indexes
 * into `palette` and `.` means transparent.
 */
export interface Sprite {
  readonly width: number;
  readonly height: number;
  /** Single-character key -> hex colour, e.g. `{ w: '#4fc3f7' }`. */
  readonly palette: Readonly<Record<string, string>>;
  /** Each frame is an array of rows; each row is one character per pixel. */
  readonly frames: readonly (readonly string[])[];
}

/** A mutable logical pixel buffer that sprites are drawn into. */
export class PixelGrid {
  readonly width: number;
  readonly height: number;
  private readonly cells: Pixel[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = new Array<Pixel>(width * height).fill(null);
  }

  clear(): void {
    this.cells.fill(null);
  }

  set(x: number, y: number, color: Pixel): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.cells[y * this.width + x] = color;
  }

  get(x: number, y: number): Pixel {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.cells[y * this.width + x] ?? null;
  }

  /** Fill a rectangle. Used for backdrops and progress bars. */
  fillRect(x: number, y: number, w: number, h: number, color: Pixel): void {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, color);
      }
    }
  }

  /**
   * Draw one frame of a sprite at (x, y). Transparent pixels (`.`) leave
   * whatever is underneath intact, so sprites can be layered.
   */
  drawSprite(x: number, y: number, sprite: Sprite, frameIndex = 0): void {
    const frame = sprite.frames[frameIndex % sprite.frames.length];
    if (!frame) return;

    const resolved = resolvePalette(sprite.palette);

    for (let dy = 0; dy < frame.length; dy++) {
      const row = frame[dy]!;
      for (let dx = 0; dx < row.length; dx++) {
        const ch = row[dx]!;
        if (ch === '.' || ch === ' ') continue;
        const color = resolved.get(ch);
        if (color) this.set(x + dx, y + dy, color);
      }
    }
  }

  /** Row-major copy of the buffer. Mainly for tests. */
  toRows(): Pixel[][] {
    const rows: Pixel[][] = [];
    for (let y = 0; y < this.height; y++) {
      rows.push(this.cells.slice(y * this.width, (y + 1) * this.width));
    }
    return rows;
  }
}

/** Convert an authored hex palette into RGB triples, once per draw. */
function resolvePalette(palette: Readonly<Record<string, string>>): Map<string, RGB> {
  const cached = paletteCache.get(palette);
  if (cached) return cached;

  const map = new Map<string, RGB>();
  for (const [key, hex] of Object.entries(palette)) {
    map.set(key, hexToRgb(hex));
  }
  paletteCache.set(palette, map);
  return map;
}

// Palettes are module-level constants in the sprite files, so keying the cache
// on identity is safe and means we parse each hex string exactly once.
const paletteCache = new WeakMap<Readonly<Record<string, string>>, Map<string, RGB>>();

function sameColor(a: Pixel, b: Pixel): boolean {
  if (a === null || b === null) return a === b;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Render a grid to an ANSI string, two pixel rows per line of output.
 *
 * Colour escapes are only emitted when the colour actually changes, which keeps
 * frames small enough to repaint at 12fps without flooding the terminal.
 */
export function renderGrid(grid: PixelGrid, depth: ColorDepth): string {
  const lines: string[] = [];

  for (let y = 0; y < grid.height; y += 2) {
    let line = '';
    let curFg: Pixel = null;
    let curBg: Pixel = null;
    let dirty = false;

    for (let x = 0; x < grid.width; x++) {
      const top = grid.get(x, y);
      const bottom = grid.get(x, y + 1);

      if (top === null && bottom === null) {
        // Nothing to draw. Reset first so the previous cell's background
        // doesn't bleed across the gap.
        if (dirty) {
          line += RESET;
          curFg = null;
          curBg = null;
          dirty = false;
        }
        line += ' ';
        continue;
      }

      // One glyph can express both pixels: use ▀ when the top is coloured and
      // ▄ when only the bottom is, so a lone bottom pixel needs no background.
      const glyph = top !== null ? UPPER_HALF : LOWER_HALF;
      const fg = top !== null ? top : bottom;
      const bg = top !== null ? bottom : null;

      if (!sameColor(fg, curFg)) {
        line += fgCode(fg as RGB, depth);
        curFg = fg;
        dirty = true;
      }
      if (bg !== null && !sameColor(bg, curBg)) {
        line += bgCode(bg, depth);
        curBg = bg;
        dirty = true;
      } else if (bg === null && curBg !== null) {
        // Clearing a background needs a full reset, which also drops the
        // foreground, so re-emit it.
        line += RESET + fgCode(fg as RGB, depth);
        curBg = null;
        curFg = fg;
        dirty = true;
      }

      line += glyph;
    }

    if (dirty) line += RESET;
    lines.push(line);
  }

  return lines.join('\n');
}

/** Convenience: render a single sprite frame with no surrounding grid. */
export function renderSprite(sprite: Sprite, frameIndex: number, depth: ColorDepth): string {
  const grid = new PixelGrid(sprite.width, sprite.height);
  grid.drawSprite(0, 0, sprite, frameIndex);
  return renderGrid(grid, depth);
}

/** How many terminal lines a sprite of this height occupies. */
export function spriteLineHeight(sprite: Sprite): number {
  return Math.ceil(sprite.height / 2);
}

/**
 * Shrink a sprite by a whole-number factor, for use as a thumbnail.
 *
 * Figures are drawn at 48 pixels because that is what it takes to carry a face
 * and a hand. That is twenty-four terminal rows, which is right for the one
 * sprite you are following and far too big for a preview sitting beside a
 * menu — it swamps the list it is supposed to be illustrating.
 *
 * Each output pixel takes the most common non-transparent colour in its block
 * rather than a single sample. Nearest-neighbour drops whichever thin features
 * happen to fall between sample points, which at this size means losing a nose
 * or a hand entirely.
 */
export function downscale(sprite: Sprite, factor: number): Sprite {
  if (factor <= 1) return sprite;

  const width = Math.floor(sprite.width / factor);
  const height = Math.floor(sprite.height / factor);

  const frames = sprite.frames.map((frame) => {
    const rows: string[] = [];
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const counts = new Map<string, number>();
        for (let dy = 0; dy < factor; dy++) {
          const line = frame[y * factor + dy];
          if (!line) continue;
          for (let dx = 0; dx < factor; dx++) {
            const ch = line[x * factor + dx];
            if (!ch || ch === '.' || ch === ' ') continue;
            counts.set(ch, (counts.get(ch) ?? 0) + 1);
          }
        }
        let best = '.';
        let bestCount = 0;
        for (const [ch, count] of counts) {
          if (count > bestCount) {
            best = ch;
            bestCount = count;
          }
        }
        row += best;
      }
      rows.push(row);
    }
    return rows;
  });

  return { width, height, palette: sprite.palette, frames };
}
