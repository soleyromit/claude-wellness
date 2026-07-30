/**
 * Colour handling for the pixel renderer.
 *
 * Sprites are authored in 24-bit RGB — that is what makes the art read as
 * detailed rather than blocky. Not every terminal can show that, so we detect
 * the best available depth and quantise down to 256 or 16 colours rather than
 * letting the art break.
 *
 * Everything here is pure. `detectColorDepth` takes the environment as an
 * argument instead of reading `process.env` so it can be tested directly.
 */

export type RGB = readonly [number, number, number];

export type ColorDepth = 24 | 8 | 4;

/** Parse `"#4fc3f7"` (or `"4fc3f7"`) into an RGB triple. */
export function hexToRgb(hex: string): RGB {
  const h = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Work out how much colour this terminal can actually render.
 *
 * `NO_COLOR` and `FORCE_COLOR=0` disable colour entirely elsewhere; here we
 * just pick the richest depth we can justify, defaulting to 256 because that
 * is near-universal and still looks good.
 */
export function detectColorDepth(env: NodeJS.ProcessEnv = process.env): ColorDepth {
  const forced = env['CLAUDE_WELLNESS_COLOR_DEPTH'];
  if (forced === '24' || forced === '8' || forced === '4') {
    return Number(forced) as ColorDepth;
  }

  const colorterm = (env['COLORTERM'] ?? '').toLowerCase();
  if (colorterm.includes('truecolor') || colorterm.includes('24bit')) return 24;

  // Terminals that support truecolor but don't always advertise COLORTERM.
  const termProgram = (env['TERM_PROGRAM'] ?? '').toLowerCase();
  if (['iterm.app', 'wezterm', 'ghostty', 'hyper', 'vscode'].includes(termProgram)) {
    return 24;
  }

  const term = (env['TERM'] ?? '').toLowerCase();
  if (term.includes('kitty') || term.includes('direct')) return 24;
  if (term.includes('256')) return 8;
  if (term === 'dumb' || term === '') return 4;

  return 8;
}

/** The six levels used by the xterm 6x6x6 colour cube. */
const CUBE_LEVELS = [0, 95, 135, 175, 215, 255] as const;

function nearestCubeIndex(value: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < CUBE_LEVELS.length; i++) {
    const dist = Math.abs(CUBE_LEVELS[i]! - value);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/**
 * Quantise an RGB triple to an xterm-256 index.
 *
 * Near-grey colours go to the 24-step greyscale ramp (232-255), which is far
 * finer than the colour cube's grey diagonal — this matters a lot for the
 * shading and outlines in the sprites.
 */
export function rgbTo256(rgb: RGB): number {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max - min <= 8) {
    const level = Math.round((r + g + b) / 3);
    if (level < 8) return 16; // pure black
    if (level > 248) return 231; // pure white
    return 232 + Math.round(((level - 8) / 247) * 23);
  }

  return (
    16 + 36 * nearestCubeIndex(r) + 6 * nearestCubeIndex(g) + nearestCubeIndex(b)
  );
}

/** The classic 16 ANSI colours, as rendered by most modern terminals. */
const ANSI_16: readonly RGB[] = [
  [0, 0, 0],
  [170, 0, 0],
  [0, 170, 0],
  [170, 85, 0],
  [0, 0, 170],
  [170, 0, 170],
  [0, 170, 170],
  [170, 170, 170],
  [85, 85, 85],
  [255, 85, 85],
  [85, 255, 85],
  [255, 255, 85],
  [85, 85, 255],
  [255, 85, 255],
  [85, 255, 255],
  [255, 255, 255],
];

/** Quantise an RGB triple to the nearest of the 16 basic ANSI colours. */
export function rgbTo16(rgb: RGB): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < ANSI_16.length; i++) {
    const c = ANSI_16[i]!;
    // Squared euclidean distance is enough here and avoids a sqrt per pixel.
    const dist =
      (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** SGR escape setting the foreground colour at the given depth. */
export function fgCode(rgb: RGB, depth: ColorDepth): string {
  if (depth === 24) return `[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
  if (depth === 8) return `[38;5;${rgbTo256(rgb)}m`;
  const i = rgbTo16(rgb);
  return i < 8 ? `[${30 + i}m` : `[${90 + (i - 8)}m`;
}

/** SGR escape setting the background colour at the given depth. */
export function bgCode(rgb: RGB, depth: ColorDepth): string {
  if (depth === 24) return `[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
  if (depth === 8) return `[48;5;${rgbTo256(rgb)}m`;
  const i = rgbTo16(rgb);
  return i < 8 ? `[${40 + i}m` : `[${100 + (i - 8)}m`;
}

export const RESET = '[0m';
