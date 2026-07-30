/**
 * Shared building blocks for the human figure.
 *
 * Every activity shows the same character, so the head and neck rows are
 * defined once here and each pose only authors the body below them. Beyond
 * saving repetition, this is what stops the app looking like fifteen different
 * people demonstrating fifteen different exercises.
 *
 * The canvas is 24x24. Column 0 is the left edge; the figure is centred around
 * columns 9-14.
 */

/** A fully transparent row. */
export const BLANK = '........................';

/** Head, facing forward. Rows 2-8 of a standing pose. */
export const HEAD_FRONT: readonly string[] = [
  '.........hhhhhh.........',
  '........hhhhhhhh........',
  '........hssssssh........',
  '........hsossosh........',
  '........hssssssh........',
  '.........ssssss.........',
  '..........SSSS..........',
];

/** Head, three-quarter view looking left. */
export const HEAD_LEFT: readonly string[] = [
  '........hhhhhh..........',
  '.......hhhhhhhh.........',
  '.......hsssssssh........',
  '.......hsossssss........',
  '.......hsssssssh........',
  '........ssssss..........',
  '.........SSSS...........',
];

/** Head, three-quarter view looking right. */
export const HEAD_RIGHT: readonly string[] = [
  '..........hhhhhh........',
  '.........hhhhhhhh.......',
  '........hsssssssh.......',
  '........ssssssosh.......',
  '........hsssssssh.......',
  '..........ssssss........',
  '...........SSSS.........',
];

/** Head with eyes shut — used for breathing and blink drills. */
export const HEAD_CLOSED: readonly string[] = [
  '.........hhhhhh.........',
  '........hhhhhhhh........',
  '........hssssssh........',
  '........hsSSSSsh........',
  '........hssssssh........',
  '.........ssssss.........',
  '..........SSSS..........',
];

/**
 * Assemble a 24-row frame from a head (7 rows, placed at row 2) and a body
 * (placed at row 9). Missing rows are filled with transparency, and the result
 * is validated — a mis-sized row would otherwise silently shift the art.
 */
export function frame(head: readonly string[], body: readonly string[]): string[] {
  const rows: string[] = [BLANK, BLANK];
  rows.push(...head);
  rows.push(...body);
  while (rows.length < 24) rows.push(BLANK);

  if (rows.length !== 24) {
    throw new Error(`Frame has ${rows.length} rows, expected 24`);
  }
  for (const [i, row] of rows.entries()) {
    if (row.length !== 24) {
      throw new Error(`Frame row ${i} is ${row.length} chars, expected 24: "${row}"`);
    }
  }
  return rows;
}
