/**
 * A side-view articulated figure.
 *
 * Poses are joint positions and the body is drawn between them, which keeps
 * the figure connected, keeps the same person in every exercise, and makes
 * tweening between poses free.
 *
 * The canvas is 48x48 — twenty-four terminal rows. That is deliberate and it
 * is the main thing standing between this and a stick construction: at 32 a
 * whole person is twenty-six pixels tall, which leaves six for the head and
 * eight for the torso. There is no room for a hand, a collar or a shoe at that
 * size, so no amount of care produces detail. Fifty per cent more height is
 * roughly double the pixels to spend.
 *
 * The skeleton is procedural; the detail is not. Limbs, torso and head are
 * laid down from the joints, then hand-authored features go on top —
 * collar and hem, elbow and knee definition, a hand with a thumb, a shoe with
 * a sole, a face with a brow and a jaw. Procedural alone reads as tubing.
 */

export const FIGURE_SIZE = 48;
export const GROUND_Y = 44;

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
  /** Back of the foot — what makes a calf raise legible. */
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

/** Read a pixel, or '.' outside the canvas. */
function at(grid: Grid, x: number, y: number): string {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || px >= FIGURE_SIZE || py < 0 || py >= FIGURE_SIZE) return '.';
  return grid[py]![px]!;
}

/** A limb whose width changes along its length. */
export function taperedLimb(
  grid: Grid,
  a: Point,
  b: Point,
  thickA: number,
  thickB: number,
  tone: string,
  shade?: string,
): void {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 3;
  const vertical = Math.abs(y1 - y0) >= Math.abs(x1 - x0);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const half = (thickA + (thickB - thickA) * t - 1) / 2;

    for (let d = -half; d <= half; d += 0.5) {
      // Shade the trailing third, proportionally. A fixed-width shadow band
      // eats most of a thin limb — at three pixels across it left the shins
      // almost entirely in shadow, so the legs read as dark slabs.
      const useShade = shade && d > half * 0.4;
      if (vertical) plot(grid, x + d, y, useShade ? shade : tone);
      else plot(grid, x, y + d, useShade ? shade : tone);
    }
  }
}

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
 * Torso: chest, waist and hips, drawn perpendicular to the spine so it stays
 * correct when the body bends. Carries a collar, a sleeve seam and a hem —
 * the clothing details that separate a person from a coloured slab.
 */
function torso(grid: Grid, shoulder: Point, hip: Point, facing: number): void {
  const dx = hip[0] - shoulder[0];
  const dy = hip[1] - shoulder[1];
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;

  const steps = Math.ceil(len * 3);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = shoulder[0] + dx * t;
    const y = shoulder[1] + dy * t;

    // Chest 12 wide, waist 9, hips 11.
    const width = t < 0.45 ? 12 - t * 6 : 9 + (t - 0.45) * 4;
    const half = (width - 1) / 2;

    for (let d = -half; d <= half; d += 0.5) {
      const bias = t < 0.5 ? facing * 0.6 : 0;
      // Back of the torso in shadow, front lit.
      const tone = d * facing > half - 1.5 ? 'C' : 'c';
      plot(grid, x + nx * d + bias, y + ny * d, tone);
    }

    // Collar at the top, hem at the bottom.
    if (t < 0.08) {
      for (let d = -half; d <= half; d += 0.5) {
        plot(grid, x + nx * d, y + ny * d, '5');
      }
    }
    if (t > 0.62 && t < 0.72) {
      for (let d = -half; d <= half; d += 0.5) {
        plot(grid, x + nx * d, y + ny * d, '5');
      }
    }
  }
}

/**
 * Head in profile: skull, hair with a parting, ear, brow, eye, nose, mouth
 * and jaw.
 *
 * At 48 there is finally room for these to be separate features rather than
 * one blob with a dot in it, and a face is what the eye looks for first.
 */
function head(grid: Grid, centre: Point, facing: number): void {
  const [cx, cy] = centre;
  const f = facing;

  // Skull. Radius 3 keeps the figure around six heads tall; radius 5 made the
  // head as deep as the torso, which is the single most obvious way for a
  // figure to look wrong regardless of how well the rest is drawn.
  disc(grid, [cx, cy], 3, 's');
  // Jaw and chin.
  plot(grid, cx + f * 1, cy + 3, 's');
  plot(grid, cx + f * 2, cy + 2, 's');
  plot(grid, cx + f * 2, cy + 3, 'S');

  // Nose.
  plot(grid, cx + f * 4, cy, 's');
  plot(grid, cx + f * 4, cy + 1, 'S');

  // Brow, eye, mouth.
  plot(grid, cx + f * 2, cy - 1, 'S');
  plot(grid, cx + f * 3, cy, 'o');
  plot(grid, cx + f * 3, cy + 2, 'S');

  // Ear.
  plot(grid, cx - f * 1, cy + 1, 'S');

  // Hair: crown and the back of the skull.
  for (let dx = -3; dx <= 2; dx++) {
    plot(grid, cx + f * dx, cy - 3, 'h');
    if (dx <= 0) plot(grid, cx + f * dx, cy - 4, 'h');
  }
  for (let dy = -2; dy <= 2; dy++) {
    plot(grid, cx - f * 3, cy + dy, 'h');
    plot(grid, cx - f * 4, cy + dy, 'H');
  }
  plot(grid, cx + f * 1, cy - 4, '3');
}

/** Hand: a palm with a thumb, rather than a blob. */
function hand(grid: Grid, centre: Point, towards: Point): void {
  const [cx, cy] = centre;
  const dx = Math.sign(cx - towards[0]) || 1;
  const dy = Math.sign(cy - towards[1]) || 1;

  disc(grid, [cx, cy], 2, 's');
  plot(grid, cx + dx, cy, '1');
  plot(grid, cx + dx, cy + dy, 'S');
  // Thumb, set off the side of the palm.
  plot(grid, cx - dy, cy + dx, 'S');
}

/** Shoe: upper, sole and heel block. */
/** Shorten a vector to at most `max`, keeping its direction. */
function clampReach(from: Point, to: Point, max: number): Point {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len <= max || len === 0) return to;
  return [from[0] + (dx / len) * max, from[1] + (dy / len) * max];
}

function shoe(grid: Grid, ankle: Point, toe: Point, heel: Point | undefined): void {
  // Slim, and short. Feet were authored on a narrower grid, so scaling their
  // reach with the rest of the body gave a ten-pixel foot on a thirty-seven
  // pixel figure — a quarter of its height, and the loudest thing in the
  // silhouette. Clamping here fixes every pose at once, and keeps the
  // *direction* the pose asked for, which is what a calf raise depends on.
  taperedLimb(grid, ankle, clampReach(ankle, toe, 5), 3, 2, 'P');
  if (heel) taperedLimb(grid, ankle, clampReach(ankle, heel, 3), 3, 2, 'P');
  // The outline pass supplies the sole; drawing one as well doubled the dark
  // mass under the figure.
}

/** Elbow and knee definition — a shadow crease where the limb bends. */
function joint(grid: Grid, at_: Point, tone: string): void {
  disc(grid, at_, 1, tone);
}

/**
 * Trace a dark contour around the silhouette.
 *
 * Applied last, to transparent pixels only. This is what stops a limb crossing
 * the torso from dissolving into it, and what lets the figure hold against the
 * background.
 */
/**
 * Erase everything that isn't attached to the main body.
 *
 * Stepping along a line and rounding to the grid occasionally strands a pixel
 * or two a step away from the limb they belong to. A figure is by definition
 * one connected mass, so rather than tuning a size threshold and re-tuning it
 * every time the geometry changes, keep the largest component and drop the
 * rest. That makes connectivity a property of the renderer instead of
 * something to be rediscovered in each new pose.
 */
function keepLargestBody(grid: Grid): void {
  // Exactly the tones the audit counts as body. Including outline here would
  // let a stray pixel survive because an outline pixel bridges it — cleanup
  // and the check must agree on what "connected" means or they cancel out.
  const BODY = new Set([
    '1', 's', 'S', '2',
    '3', 'h', 'H',
    '4', 'c', 'C', '5',
    '6', 'p', 'P',
    'Y', 'r', 'R',
  ]);
  const isBody = (x: number, y: number): boolean => BODY.has(at(grid, x, y));

  const seen = Array.from({ length: FIGURE_SIZE }, () =>
    new Array<boolean>(FIGURE_SIZE).fill(false),
  );
  const groups: Array<Array<readonly [number, number]>> = [];

  for (let y = 0; y < FIGURE_SIZE; y++) {
    for (let x = 0; x < FIGURE_SIZE; x++) {
      if (!isBody(x, y) || seen[y]![x]) continue;
      const cells: Array<readonly [number, number]> = [];
      const stack: Array<readonly [number, number]> = [[x, y]];
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cx >= FIGURE_SIZE || cy < 0 || cy >= FIGURE_SIZE) continue;
        if (!isBody(cx, cy) || seen[cy]![cx]) continue;
        seen[cy]![cx] = true;
        cells.push([cx, cy]);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      groups.push(cells);
    }
  }

  if (groups.length < 2) return;
  groups.sort((a, b) => b.length - a.length);
  for (const group of groups.slice(1)) {
    for (const [x, y] of group) plot(grid, x, y, '.');
  }
}

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
 * Recolour body pixels inside a region, leaving everything else alone.
 *
 * Emphasis has to follow the anatomy. Painting a rectangle instead severs
 * whatever it crosses and hangs out past the silhouette.
 */
export function tintBody(
  grid: Grid,
  region: (x: number, y: number) => boolean,
  from: ReadonlySet<string>,
  tone: string,
): void {
  for (let y = 0; y < FIGURE_SIZE; y++) {
    for (let x = 0; x < FIGURE_SIZE; x++) {
      if (!from.has(grid[y]![x]!)) continue;
      if (!region(x, y)) continue;
      grid[y]![x] = tone;
    }
  }
}

export const SHIRT_TONES: ReadonlySet<string> = new Set(['c', 'C', '4', '5']);

/**
 * Draw a full figure from a pose.
 *
 * Far limbs first so the near ones overlap them, which is what reads as depth
 * in a side view; hand-authored detail last so nothing paints over a face.
 */
export function drawPose(pose: Pose, options: { outline?: boolean } = {}): Grid {
  const grid = blankFigure();
  const facing = pose.facing ?? 1;

  // Far leg, in shadow so it sits behind.
  if (pose.backKnee && pose.backAnkle) {
    taperedLimb(grid, pose.hip, pose.backKnee, 9, 7, 'P');
    taperedLimb(grid, pose.backKnee, pose.backAnkle, 7, 5, 'P');
    if (pose.backToe) taperedLimb(grid, pose.backAnkle, pose.backToe, 4, 3, 'k');
  } else {
    // Legs together: offset a shadowed copy so two legs are visible. Drawn as
    // a single mass they read as one thick trunk, which is most of why a
    // standing side view fails to look like a person.
    const back = (p: Point): Point => [p[0] - facing * 2.5, p[1]];
    taperedLimb(grid, back(pose.hip), back(pose.knee), 9, 6, 'P');
    taperedLimb(grid, back(pose.knee), back(pose.ankle), 6, 4, 'P');
    shoe(grid, back(pose.ankle), back(pose.toe), pose.heel ? back(pose.heel) : undefined);
  }
  taperedLimb(grid, pose.shoulder, pose.elbow, 6, 5, 'C');

  torso(grid, pose.shoulder, pose.hip, facing);

  // Near leg: thigh into calf, with a knee crease and a shoe.
  taperedLimb(grid, pose.hip, pose.knee, 10, 7, 'p', 'P');
  taperedLimb(grid, pose.knee, pose.ankle, 7, 5, 'p', 'P');
  joint(grid, pose.knee, 'P');
  shoe(grid, pose.ankle, pose.toe, pose.heel);
  // Shorts hem across the thigh.
  taperedLimb(
    grid,
    pose.hip,
    [pose.hip[0] + (pose.knee[0] - pose.hip[0]) * 0.45, pose.hip[1] + (pose.knee[1] - pose.hip[1]) * 0.45],
    10,
    9,
    'p',
  );

  // Near arm, over the torso, with an elbow and a hand.
  taperedLimb(grid, pose.shoulder, pose.elbow, 7, 5, 's', 'S');
  taperedLimb(grid, pose.elbow, pose.hand, 5, 4, 's', 'S');
  joint(grid, pose.elbow, 'S');
  hand(grid, pose.hand, pose.elbow);
  // Sleeve, covering the top third of the upper arm.
  taperedLimb(
    grid,
    pose.shoulder,
    [
      pose.shoulder[0] + (pose.elbow[0] - pose.shoulder[0]) * 0.4,
      pose.shoulder[1] + (pose.elbow[1] - pose.shoulder[1]) * 0.4,
    ],
    8,
    6,
    'c',
    'C',
  );

  // Neck, then head over everything.
  // Neck: narrow at the skull, flaring into the shoulders.
  taperedLimb(grid, pose.head, pose.shoulder, 4, 8, 's', 'S');
  head(grid, pose.head, facing);

  keepLargestBody(grid);
  if (options.outline !== false) outline(grid);

  return grid;
}

/** A ground line, so poses have something to press against. */
export function ground(grid: Grid, y = GROUND_Y + 2): void {
  for (let x = 2; x < FIGURE_SIZE - 2; x++) {
    if (at(grid, x, y) === '.' || at(grid, x, y) === 'o') plot(grid, x, y, 'a');
  }
}

/**
 * Directional cue — a chevron showing which way the movement goes.
 *
 * Drawn behind the figure: it only writes where nothing has been drawn yet.
 * An arrow that paints over the body punches holes in it and leaves stray
 * pixels stranded inside the chevron, which then read as noise.
 */
export function arrow(grid: Grid, x: number, y: number, dir: 'up' | 'down'): void {
  const s = dir === 'up' ? -1 : 1;
  const mark = (px: number, py: number): void => {
    if (at(grid, px, py) === '.') plot(grid, px, py, 'y');
  };

  for (let i = 0; i < 5; i++) mark(x, y + i * s);
  mark(x - 1, y + s);
  mark(x + 1, y + s);
  mark(x - 2, y + 2 * s);
  mark(x + 2, y + 2 * s);
}

export function toRows(grid: Grid): string[] {
  return grid.map((row) => row.join(''));
}

// ---------------------------------------------------------------- animation

function lerpPoint(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Ease in and out, so a movement accelerates and settles. */
export function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

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
 * Each step eases out of the previous pose across roughly two-thirds of its
 * block, then holds — giving both halves of an instruction: the movement to
 * make, and the position to stay in.
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
      const raw = Math.min(1, (i / Math.max(1, framesPerStep - 1)) * 1.5);
      frames.push(render(lerpPose(from, pose, ease(raw)), step, raw));
    }
  });

  return frames;
}

/**
 * Push the body's landmarks apart so the figure reads at adult proportions.
 *
 * The original poses were laid out for a 32 canvas, where the head, torso and
 * legs all had to be squat to fit. Scaling those uniformly keeps the squat
 * proportions and simply makes everything bigger — the head ends up as deep as
 * the torso, which is the most obvious way for a figure to look wrong however
 * well the parts are drawn.
 *
 * This stretches the *gaps* instead: the head stays where it is, the shoulders
 * drop a little, and the hips and legs drop more, giving a torso and limbs of
 * believable length against a head that is now radius 3.
 */
function stretchY(y: number): number {
  // Authoring landmarks -> final canvas rows. These are absolute, not a scale
  // factor, because the gaps between them are the anatomy and each has to be
  // set against the size of the parts that fill it.
  //
  // The head is radius 3 with hair above, so its centre sits six rows clear of
  // the shoulder: three for the skull, three for a neck. Deriving this from a
  // uniform scale instead gave a ten-row gap and produced seven rows of bare
  // neck — a figure whose head simply merged into its torso.
  const from = [0, 6, 12, 18, 23, 26, 28, 32];
  const to = [2, 13, 19, 29, 36, 42, 44, 47];

  for (let i = 0; i < from.length - 1; i++) {
    if (y <= from[i + 1]!) {
      const span = from[i + 1]! - from[i]!;
      const t = span === 0 ? 0 : (y - from[i]!) / span;
      return to[i]! + (to[i + 1]! - to[i]!) * t;
    }
  }
  return to[to.length - 1]!;
}

/**
 * Map a pose authored on the 32 grid onto the 48 canvas, correcting its
 * proportions on the way.
 */
export function scalePose(pose: Pose, factor = 1.4, offsetY = 4): Pose {
  const s = (p: Point): Point => [p[0] * factor + offsetY, stretchY(p[1])];
  const opt = (p: Point | undefined): Point | undefined => (p ? s(p) : undefined);
  return {
    head: s(pose.head),
    shoulder: s(pose.shoulder),
    elbow: s(pose.elbow),
    hand: s(pose.hand),
    hip: s(pose.hip),
    knee: s(pose.knee),
    ankle: s(pose.ankle),
    toe: s(pose.toe),
    heel: opt(pose.heel),
    backKnee: opt(pose.backKnee),
    backAnkle: opt(pose.backAnkle),
    backToe: opt(pose.backToe),
    facing: pose.facing,
  };
}
