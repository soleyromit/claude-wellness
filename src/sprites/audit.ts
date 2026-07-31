/**
 * Automated art review.
 *
 * Rendering bugs in this project have all been of a few recurring kinds, and
 * every one shipped because it was invisible in the source and only obvious
 * once drawn: a decoration painted as a blind rectangle over the body, a limb
 * left floating, a figure that jumps between frames, art that fills the canvas
 * edge to edge.
 *
 * Reviewing frames by eye does not scale — there are now several hundred — and
 * spot-fixing whatever gets reported means the same class of fault reappears
 * somewhere else. So the criteria are written down here and checked over every
 * frame of every sprite.
 *
 * Pure functions over frame data; the test suite runs them across the registry.
 */

/** Pixels that make up a body. */
export const FIGURE_TONES = new Set([
  '1', 's', 'S', '2',
  '3', 'h', 'H',
  '4', 'c', 'C', '5',
  '6', 'p', 'P',
]);

/**
 * Free-floating cue symbols: arrows, motion arcs. These are *meant* to sit off
 * the body — they are notation, not anatomy.
 */
export const CUE_TONES = new Set(['y']);

/**
 * On-body emphasis: a muscle working, a joint under strain. These must land on
 * the figure, because they are describing part of it.
 *
 * Keeping the two apart is what makes the rule checkable. The plank's core glow
 * shipped as a rectangle painted straight across the canvas, severing the torso
 * and hanging out past it — indistinguishable from a legitimate arrow if both
 * use the same tone.
 */
export const EMPHASIS_TONES = new Set(['Y', 'r', 'R']);

export const DECORATION_TONES = new Set([...CUE_TONES, ...EMPHASIS_TONES]);

/** Structural, not part of a figure's mass. */
export const STRUCTURE_TONES = new Set(['o', 'k', 'a', 'A']);

export type Frame = readonly string[];

export interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly empty: boolean;
}

/** Bounding box of everything drawn. */
export function boundingBox(frame: Frame, tones?: ReadonlySet<string>): Box {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  frame.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      if (tones && !tones.has(ch)) return;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
  });

  const empty = minX === Infinity;
  return empty
    ? { minX: 0, maxX: 0, minY: 0, maxY: 0, empty }
    : { minX, maxX, minY, maxY, empty };
}

/** Count 4-connected regions of the given tones. */
export function components(frame: Frame, tones: ReadonlySet<string>): number {
  const height = frame.length;
  const width = frame[0]?.length ?? 0;
  const seen = Array.from({ length: height }, () => new Array<boolean>(width).fill(false));
  const has = (y: number, x: number): boolean =>
    y >= 0 && y < height && x >= 0 && x < width && tones.has(frame[y]![x]!);

  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!has(y, x) || seen[y]![x]) continue;
      count++;
      const stack: Array<readonly [number, number]> = [[y, x]];
      while (stack.length > 0) {
        const [cy, cx] = stack.pop()!;
        if (!has(cy, cx) || seen[cy]![cx]) continue;
        seen[cy]![cx] = true;
        stack.push([cy + 1, cx], [cy - 1, cx], [cy, cx + 1], [cy, cx - 1]);
      }
    }
  }
  return count;
}

/**
 * Emphasis pixels that are not surrounded by the body they claim to describe.
 *
 * A muscle highlight belongs *inside* a limb, so nearly all of its neighbours
 * should be figure. A run that spills into empty space is painting over the
 * art rather than tinting it.
 */
export function strayEmphasis(frame: Frame): number {
  const height = frame.length;
  const width = frame[0]?.length ?? 0;
  let stray = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!EMPHASIS_TONES.has(frame[y]![x]!)) continue;

      // The precise rule: emphasis lives inside the silhouette, so it must
      // never border empty space. Counting body neighbours instead misjudges a
      // tint that legitimately spans a whole limb's width.
      for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const ch = frame[y + dy]?.[x + dx];
        if (ch === '.') {
          stray++;
          break;
        }
      }
    }
  }
  return stray;
}

/**
 * Cue symbols that are isolated single pixels.
 *
 * Arrows and arcs may float, but a lone pixel is debris rather than notation.
 */
export function strayCues(frame: Frame): number {
  const height = frame.length;
  const width = frame[0]?.length ?? 0;
  let stray = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!CUE_TONES.has(frame[y]![x]!)) continue;
      let neighbours = 0;
      for (const [dy, dx] of [
        [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1],
      ] as const) {
        const ch = frame[y + dy]?.[x + dx];
        if (ch && ch !== '.') neighbours++;
      }
      if (neighbours === 0) stray++;
    }
  }
  return stray;
}

/**
 * How far a frame's content shifts from the previous one.
 *
 * Large jumps between consecutive frames of an animation read as a cut rather
 * than a movement — the cat-cow bug, where the two poses occupied different
 * parts of the canvas entirely.
 */
export function frameShift(a: Frame, b: Frame): number {
  // Measured over the body only. Including cues means an arrow appearing or
  // fading swings the bounding box by ten pixels and reports a perfectly
  // smooth movement as a jump.
  const tones = new Set([...FIGURE_TONES, ...EMPHASIS_TONES]);
  const boxA = boundingBox(a, tones);
  const boxB = boundingBox(b, tones);
  if (boxA.empty || boxB.empty) return 0;
  return Math.max(
    Math.abs(boxA.minX - boxB.minX),
    Math.abs(boxA.maxX - boxB.maxX),
    Math.abs(boxA.minY - boxB.minY),
    Math.abs(boxA.maxY - boxB.maxY),
  );
}

/** Fraction of the canvas covered by drawn pixels. */
export function fillRatio(frame: Frame): number {
  const height = frame.length;
  const width = frame[0]?.length ?? 1;
  let drawn = 0;
  for (const row of frame) {
    for (const ch of row) if (ch !== '.') drawn++;
  }
  return drawn / (height * width);
}

/**
 * Whether the drawn content is clipped by the canvas edge.
 *
 * Art touching the border has usually overflowed rather than been composed to
 * fit, and it looks cut off once rendered.
 */
export function touchesEdge(frame: Frame, tones?: ReadonlySet<string>): boolean {
  const box = boundingBox(frame, tones);
  if (box.empty) return false;
  const height = frame.length;
  const width = frame[0]?.length ?? 0;
  return box.minX === 0 || box.minY === 0 || box.maxX === width - 1 || box.maxY === height - 1;
}

export interface FrameReport {
  readonly index: number;
  readonly figureParts: number;
  readonly strayEmphasis: number;
  readonly strayCues: number;
  readonly fill: number;
  readonly shiftFromPrevious: number;
  readonly clipped: boolean;
}

export function auditFrames(frames: readonly Frame[]): FrameReport[] {
  return frames.map((frame, i) => ({
    index: i,
    // Emphasis counts as body for connectivity: a tinted midsection is still
    // the torso, and excluding it would report a perfectly good figure as
    // severed in two.
    figureParts: components(frame, new Set([...FIGURE_TONES, ...EMPHASIS_TONES])),
    strayEmphasis: strayEmphasis(frame),
    strayCues: strayCues(frame),
    fill: fillRatio(frame),
    shiftFromPrevious: i === 0 ? 0 : frameShift(frames[i - 1]!, frame),
    clipped: touchesEdge(frame, FIGURE_TONES),
  }));
}
