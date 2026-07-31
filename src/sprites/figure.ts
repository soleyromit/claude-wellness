/**
 * A side-view articulated figure.
 *
 * Exercise poses were originally drawn front-on, and they were unreadable: a
 * squat, a lunge and a calf raise all reduce to "person standing" once a 24px
 * figure is halved to twelve terminal rows. Recognition at this size comes
 * almost entirely from silhouette, and front-on hides the two joints that
 * distinguish these movements — the hip hinge and the knee bend.
 *
 * So poses are defined here as joint positions on a 32x32 side view, and the
 * limbs are drawn between them. That buys three things a hand-drawn pose can't:
 * the body is always connected, the same figure appears in every exercise, and
 * poses can be exaggerated freely without redrawing anything.
 *
 * Everything is authored in flat mid-tones; `shadeFrames` adds the rim lighting.
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
  /** Near leg, drawn in front. */
  readonly knee: Point;
  readonly ankle: Point;
  readonly toe: Point;
  /**
   * Back of the foot. Drawing the heel separately from the toe is what makes a
   * calf raise legible — without it, "on the toes" and "flat" differ by a pixel
   * of overall height and read as the same pose.
   */
  readonly heel?: Point;
  /** Far leg. Omit for poses where the legs are together. */
  readonly backKnee?: Point;
  readonly backAnkle?: Point;
  readonly backToe?: Point;
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

/** A limb: a line from a to b, `thickness` pixels wide. */
export function limb(grid: Grid, a: Point, b: Point, thickness: number, tone: string): void {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const half = (thickness - 1) / 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    // Thicken across the axis the limb travels least, so a vertical limb gets
    // width and a horizontal one gets height.
    const vertical = Math.abs(y1 - y0) >= Math.abs(x1 - x0);
    for (let d = -half; d <= half; d += 1) {
      if (vertical) plot(grid, x + d, y, tone);
      else plot(grid, x, y + d, tone);
    }
  }
}

/** A filled circle, for the head. */
export function disc(grid: Grid, centre: Point, radius: number, tone: string): void {
  const [cx, cy] = centre;
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius + 1) plot(grid, cx + x, cy + y, tone);
    }
  }
}

/**
 * Draw a full figure from a pose.
 *
 * Order matters: the far leg goes down first so the near leg overlaps it, which
 * is what reads as depth in a side view.
 */
export function drawPose(pose: Pose, tone: { limbs?: string } = {}): Grid {
  const grid = blankFigure();
  const legTone = tone.limbs ?? 'p';

  // Far leg, in shadow so it sits behind.
  if (pose.backKnee && pose.backAnkle) {
    limb(grid, pose.hip, pose.backKnee, 4, 'P');
    limb(grid, pose.backKnee, pose.backAnkle, 3, 'P');
    if (pose.backToe) limb(grid, pose.backAnkle, pose.backToe, 2, 'o');
  }

  // Neck, so the head is joined to the body rather than floating above it.
  limb(grid, pose.head, pose.shoulder, 3, 's');

  // Torso.
  limb(grid, pose.shoulder, pose.hip, 6, 'c');

  // Near leg. The shin is narrower than the thigh: legs taper, and a shin as
  // wide as the foot leaves stray pixels either side of it once the foot is
  // drawn over the top.
  limb(grid, pose.hip, pose.knee, 5, legTone);
  limb(grid, pose.knee, pose.ankle, 3, legTone);
  limb(grid, pose.ankle, pose.toe, 2, 'o');
  if (pose.heel) limb(grid, pose.ankle, pose.heel, 2, 'o');

  // Arm, over the torso.
  limb(grid, pose.shoulder, pose.elbow, 3, 's');
  limb(grid, pose.elbow, pose.hand, 3, 's');

  // Head last so nothing overlaps the face.
  disc(grid, pose.head, 3, 's');
  const [hx, hy] = pose.head;
  // Hair across the top and back of the skull, facing right.
  for (let x = -3; x <= 1; x++) {
    plot(grid, hx + x, hy - 3, 'h');
    if (x <= -1) plot(grid, hx + x, hy - 2, 'h');
  }
  plot(grid, hx - 3, hy - 1, 'h');
  plot(grid, hx + 2, hy, 'o'); // eye

  return grid;
}

/** A ground line, so poses have something to press against. */
export function ground(grid: Grid, y = GROUND_Y + 1): void {
  for (let x = 2; x < FIGURE_SIZE - 2; x++) plot(grid, x, y, 'a');
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
