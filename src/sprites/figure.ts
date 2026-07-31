/**
 * A side-view articulated figure.
 *
 * Poses are defined as joint positions and the body is drawn between them,
 * which keeps the figure connected, keeps the same person in every exercise,
 * and makes tweening between poses free.
 *
 * What makes the figure read as a person rather than a stick construction:
 *
 *  - **Tapered limbs.** A thigh is thicker than a shin and an upper arm thicker
 *    than a forearm. Uniform tubes are the single biggest tell of a crude
 *    pixel figure.
 *  - **A shaped torso.** Shoulders wider than the waist, hips flaring again,
 *    instead of a rectangle.
 *  - **A profile head.** At this size a nose and a jaw do more for
 *    recognisability than any amount of interior detail.
 *  - **An outline.** A dark contour around the whole silhouette. This is what
 *    lets the figure hold together against the background and stops limbs
 *    dissolving into each other where they overlap.
 *
 * Everything is authored in flat mid-tones; `shadeFrames` adds rim lighting.
 */

export const FIGURE_SIZE = 32;
export const GROUND_Y = 28;

export type Point = readonly [x: number, y: number];

export interface Pose {
  readonly head: Point;
  readonly shoulder: Point;
  readonly elbow: Point;
  readonly hand: Point;
  readonly hip: Point;
  readonly knee: Point;
  readonly ankle: Point;
  readonly toe: Point;
  /**
   * Back of the foot. Drawing the heel separately is what makes a calf raise
   * legible — without it, "on the toes" and "flat" differ by a pixel of height.
   */
  readonly heel?: Point;
  /** Far leg, drawn behind. Omit where the legs are together. */
  readonly backKnee?: Point;
  readonly backAnkle?: Point;
  readonly backToe?: Point;
  /** Facing. -1 draws the figure mirrored. */
  readonly facing?: 1 | -1;
}

type Grid = string[][];

export function blankFigure(): Grid {
  return Array.from({ length: FIGURE_SIZE }, () => new Array<string>(FIGURE_SIZE).fill('.'));
}

export function plot(grid: Grid, x: number, y: number, ch: string): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || px >= FIGURE_SIZE || py < 0 || py >= FIGURE_SIZE) return;
  grid[py]![px] = ch;
}

/** A limb whose width changes along its length. */
export function taperedLimb(
  grid: Grid,
  a: Point,
  b: Point,
  thickA: number,
  thickB: number,
  tone: string,
): void {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
  const vertical = Math.abs(y1 - y0) >= Math.abs(x1 - x0);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const half = (thickA + (thickB - thickA) * t - 1) / 2;

    for (let d = -half; d <= half; d += 0.5) {
      if (vertical) plot(grid, x + d, y, tone);
      else plot(grid, x, y + d, tone);
    }
  }
}

/** Constant-width limb. */
export function limb(grid: Grid, a: Point, b: Point, thickness: number, tone: string): void {
  taperedLimb(grid, a, b, thickness, thickness, tone);
}

export function disc(grid: Grid, centre: Point, radius: number, tone: string): void {
  const [cx, cy] = centre;
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius + radius * 0.4) plot(grid, cx + x, cy + y, tone);
    }
  }
}

/**
 * Torso as a tapered slab: wide at the shoulders, narrower at the waist, and
 * flaring slightly at the hips. Drawn perpendicular to the spine so it stays
 * correct when the figure bends forward.
 */
function torso(grid: Grid, shoulder: Point, hip: Point, facing: number): void {
  const dx = hip[0] - shoulder[0];
  const dy = hip[1] - shoulder[1];
  const len = Math.max(1, Math.hypot(dx, dy));
  // Unit normal to the spine.
  const nx = -dy / len;
  const ny = dx / len;

  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = shoulder[0] + dx * t;
    const y = shoulder[1] + dy * t;
    // Chest 8 wide, waist 6, hips 7.
    const width = t < 0.45 ? 8 - t * 4 : 6 + (t - 0.45) * 2;
    const half = (width - 1) / 2;

    for (let d = -half; d <= half; d += 0.5) {
      // Bias the chest forward, so the figure has a front and a back.
      const bias = t < 0.5 ? facing * 0.4 : 0;
      plot(grid, x + nx * d + bias, y + ny * d, 'c');
    }
  }
}

/**
 * Head in profile: skull, jaw, nose and hair.
 *
 * The nose is three pixels and it is the difference between a circle and a
 * person. `facing` decides which side it sits on.
 */
function head(grid: Grid, centre: Point, facing: number): void {
  const [cx, cy] = centre;

  disc(grid, [cx, cy], 3, 's');
  // Jaw, slightly forward of the skull.
  plot(grid, cx + facing, cy + 3, 's');
  plot(grid, cx + facing * 2, cy + 2, 's');

  // Nose.
  plot(grid, cx + facing * 4, cy, 's');
  plot(grid, cx + facing * 4, cy + 1, 'S');

  // Hair over the crown and down the back of the skull.
  for (let dx = -3; dx <= 2; dx++) {
    plot(grid, cx + facing * dx, cy - 3, 'h');
  }
  for (let dy = -2; dy <= 1; dy++) {
    plot(grid, cx - facing * 3, cy + dy, 'h');
    plot(grid, cx - facing * 4, cy + dy, 'H');
  }
  plot(grid, cx + facing * 2, cy - 2, 'h');

  // Eye.
  plot(grid, cx + facing * 2, cy, 'o');
}

/**
 * Foot: a shallow wedge from the ankle.
 *
 * Drawn in a shoe tone rather than the outline colour — an outline-coloured
 * foot plus the outline pass produces a solid dark blob with no shape to it.
 */
function foot(grid: Grid, ankle: Point, toe: Point, heel: Point | undefined): void {
  taperedLimb(grid, ankle, toe, 3, 2, 'P');
  if (heel) taperedLimb(grid, ankle, heel, 3, 2, 'P');
}

/**
 * Trace a dark contour around the silhouette.
 *
 * Applied last, to transparent pixels only, so it never eats the figure. This
 * is what stops a limb crossing the torso from dissolving into it.
 */
function outline(grid: Grid): void {
  const solid = grid.map((row) => row.map((c) => c !== '.'));

  for (let y = 0; y < FIGURE_SIZE; y++) {
    for (let x = 0; x < FIGURE_SIZE; x++) {
      if (solid[y]![x]) continue;
      const touches =
        solid[y - 1]?.[x] || solid[y + 1]?.[x] || solid[y]![x - 1] || solid[y]![x + 1];
      if (touches) grid[y]![x] = 'o';
    }
  }
}

/**
 * Draw a full figure from a pose.
 *
 * Order matters: the far limbs go down first so the near ones overlap them,
 * which is what reads as depth in a side view.
 */
export function drawPose(pose: Pose, options: { outline?: boolean } = {}): Grid {
  const grid = blankFigure();
  const facing = pose.facing ?? 1;

  // Far leg, in shadow so it sits behind.
  if (pose.backKnee && pose.backAnkle) {
    taperedLimb(grid, pose.hip, pose.backKnee, 6, 5, 'P');
    taperedLimb(grid, pose.backKnee, pose.backAnkle, 5, 3, 'P');
    if (pose.backToe) taperedLimb(grid, pose.backAnkle, pose.backToe, 3, 2, 'k');
  }

  // Far arm, behind the torso.
  taperedLimb(grid, pose.shoulder, pose.elbow, 4, 3, 'C');

  torso(grid, pose.shoulder, pose.hip, facing);

  // Near leg, thigh into shin.
  taperedLimb(grid, pose.hip, pose.knee, 7, 5, 'p');
  taperedLimb(grid, pose.knee, pose.ankle, 5, 3, 'p');
  foot(grid, pose.ankle, pose.toe, pose.heel);

  // Near arm, over the torso, with a hand at the end. Kept slim: an arm as
  // thick as the chest reads as a slab across the body rather than a limb.
  taperedLimb(grid, pose.shoulder, pose.elbow, 4, 3, 's');
  taperedLimb(grid, pose.elbow, pose.hand, 3, 2, 's');
  disc(grid, pose.hand, 1, 'S');

  // Neck, then head over everything.
  taperedLimb(grid, pose.head, pose.shoulder, 4, 5, 's');
  head(grid, pose.head, facing);

  if (options.outline !== false) outline(grid);

  return grid;
}

/** A ground line, so poses have something to press against. */
export function ground(grid: Grid, y = GROUND_Y + 1): void {
  for (let x = 1; x < FIGURE_SIZE - 1; x++) {
    if (grid[y]![x] === '.' || grid[y]![x] === 'o') plot(grid, x, y, 'a');
  }
}

/** Directional cue — a chevron showing which way the movement goes. */
export function arrow(grid: Grid, x: number, y: number, dir: 'up' | 'down'): void {
  const s = dir === 'up' ? -1 : 1;
  plot(grid, x, y, 'y');
  plot(grid, x - 1, y + s, 'y');
  plot(grid, x + 1, y + s, 'y');
  plot(grid, x, y + s, 'y');
  plot(grid, x, y + 2 * s, 'y');
}

export function toRows(grid: Grid): string[] {
  return grid.map((row) => row.join(''));
}

// ---------------------------------------------------------------- animation

function lerpPoint(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Ease in and out, so a movement accelerates and settles rather than sliding. */
export function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Blend two poses.
 *
 * Joint-based poses make this nearly free, and it is what turns a pair of
 * static positions into an instruction you can follow: you see the *path* the
 * body takes, not just where it starts and stops.
 */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const pick = (key: 'backKnee' | 'backAnkle' | 'backToe' | 'heel'): Point | undefined => {
    const pa = a[key];
    const pb = b[key];
    if (pa && pb) return lerpPoint(pa, pb, t);
    return pb ?? pa;
  };

  return {
    head: lerpPoint(a.head, b.head, t),
    shoulder: lerpPoint(a.shoulder, b.shoulder, t),
    elbow: lerpPoint(a.elbow, b.elbow, t),
    hand: lerpPoint(a.hand, b.hand, t),
    hip: lerpPoint(a.hip, b.hip, t),
    knee: lerpPoint(a.knee, b.knee, t),
    ankle: lerpPoint(a.ankle, b.ankle, t),
    toe: lerpPoint(a.toe, b.toe, t),
    heel: pick('heel'),
    backKnee: pick('backKnee'),
    backAnkle: pick('backAnkle'),
    backToe: pick('backToe'),
    facing: t < 0.5 ? (a.facing ?? 1) : (b.facing ?? 1),
  };
}

/**
 * Turn one key pose per instruction step into an animated strip.
 *
 * Each step gets `framesPerStep` frames: the first half eases out of the
 * previous pose into this one, the second half holds it. That gives you both
 * halves of an instruction — the movement to make, and the position to stay in.
 */
export function framesFromPoses(
  poses: readonly Pose[],
  framesPerStep: number,
  render: (pose: Pose, step: number, t: number) => string[],
): string[][] {
  const frames: string[][] = [];

  poses.forEach((pose, step) => {
    const from = step === 0 ? poses[poses.length - 1]! : poses[step - 1]!;
    for (let i = 0; i < framesPerStep; i++) {
      const raw = Math.min(1, (i / Math.max(1, framesPerStep - 1)) * 2);
      frames.push(render(lerpPose(from, pose, ease(raw)), step, raw));
    }
  });

  return frames;
}
