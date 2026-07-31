/**
 * Visual language for the TUI.
 *
 * Colours are hex so they match the sprite palette exactly — the UI chrome and
 * the pixel art should look like they came from the same place. Ink downsamples
 * automatically on terminals that can't do truecolor.
 */

import type { ActivityGroup } from '../core/types.js';

export const COLORS = {
  text: '#d7dee8',
  dim: '#8d99ae',
  faint: '#5a6474',
  accent: '#5b8dd6',
  success: '#6bbf59',
  warn: '#ffd166',
  danger: '#ef6f6c',
  water: '#2f9fd8',
  /**
   * Selection fill. A full-width band is how a terminal list shows what is
   * selected — a lone caret is easy to lose, especially in a narrow pane
   * glanced at from the corner of your eye.
   */
  selection: '#22304a',
  selectionMuted: '#1b2230',
  rule: '#2a3140',
} as const;

/** Pad or clip to an exact width so a highlighted row fills it evenly. */
export function fit(text: string, width: number): string {
  if (text.length === width) return text;
  if (text.length < width) return text + ' '.repeat(width - text.length);
  return width <= 1 ? text.slice(0, width) : `${text.slice(0, width - 1)}…`;
}

/** Each group gets a colour, used consistently by rings, stats and nudges. */
export const GROUP_COLORS: Readonly<Record<ActivityGroup, string>> = {
  hydration: '#2f9fd8',
  eyes: '#7fd4f5',
  stretch: '#6bbf59',
  exercise: '#ef6f6c',
  breathing: '#b388ff',
  posture: '#ffd166',
};

/** Single-character glyphs for each group, for tight layouts. */
export const GROUP_GLYPHS: Readonly<Record<ActivityGroup, string>> = {
  hydration: '◆',
  eyes: '◉',
  stretch: '✦',
  exercise: '▲',
  breathing: '◌',
  posture: '▮',
};

/**
 * Layout tier, chosen from the pane size. Side panes are often very small, so
 * this is not an edge case — it's the common case.
 */
export type Tier = 'full' | 'compact' | 'minimal';

/** The space a screen has to lay itself out in. */
export interface PaneSize {
  readonly columns: number;
  readonly rows: number;
}

const TIERS: readonly Tier[] = ['minimal', 'compact', 'full'];

/**
 * Height matters as much as width. A pane can be a hundred columns wide and
 * still be twelve rows tall, and art that doesn't fit is worse than no art:
 * the terminal scrolls, and everything above the fold — the tabs, the title,
 * whatever you had selected — silently leaves the screen.
 *
 * Whichever axis is tighter wins, so a short pane drops a tier the same way a
 * narrow one does.
 */
export function tierFor(columns: number, rows: number = Number.POSITIVE_INFINITY): Tier {
  const byWidth: Tier = columns >= 80 ? 'full' : columns >= 50 ? 'compact' : 'minimal';
  const byHeight: Tier = rows >= 24 ? 'full' : rows >= 14 ? 'compact' : 'minimal';
  return TIERS.indexOf(byWidth) <= TIERS.indexOf(byHeight) ? byWidth : byHeight;
}

/**
 * Rows a line of text occupies once the pane wraps it.
 *
 * Screens size their art from what the text leaves behind, so this has to
 * match what Ink actually does — greedy word wrap, breaking mid-word only when
 * a single word is wider than the pane. `ui.test.tsx` checks it against Ink's
 * own output rather than trusting the description.
 */
export function textRows(text: string, columns: number): number {
  if (columns <= 0) return 1;

  let rows = 1;
  let used = 0;

  /** A word wider than the pane, spilled across rows one character at a time. */
  const spill = (word: string): void => {
    const characters = [...word];
    for (const [index, character] of characters.entries()) {
      if (used + 1 > columns) {
        rows += 1;
        used = 0;
      }
      used += [...character].length;
      if (used === columns && index < characters.length - 1) {
        rows += 1;
        used = 0;
      }
    }
  };

  for (const [index, word] of text.split(' ').entries()) {
    const length = [...word].length;

    if (index > 0) {
      // The separating space starts a new row if this one is already full.
      if (used >= columns) {
        rows += 1;
        used = 0;
      }
      used += 1;
    }

    if (length > columns) {
      // Start on a fresh row if breaking here would cost an extra one.
      const breaksHere = 1 + Math.floor((length - (columns - used) - 1) / columns);
      if (Math.floor((length - 1) / columns) < breaksHere) {
        rows += 1;
        used = 0;
      }
      spill(word);
      continue;
    }

    // A word that no longer fits moves to the next row whole.
    if (used > 0 && length > 0 && used + length > columns) {
      rows += 1;
      used = 0;
    }
    used += length;
  }

  return rows;
}

/**
 * Below this, art is a smudge rather than a picture, so screens drop it and
 * keep the words instead.
 */
export const MIN_ART_ROWS = 3;

/** Rows left for art once the text around it has taken its share. */
export function artRowsFor(pane: PaneSize | undefined, chromeRows: number): number {
  if (!pane) return Number.POSITIVE_INFINITY;
  return pane.rows - chromeRows;
}

/** A horizontal bar built from block glyphs. */
export function bar(progress: number, width: number): string {
  const clamped = Math.max(0, Math.min(1, progress));
  const filled = Math.round(clamped * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

/** Human-friendly relative time, e.g. "in 12m" or "3m ago". */
export function formatMinutes(minutes: number): string {
  const rounded = Math.round(Math.abs(minutes));
  const unit = rounded >= 60 ? `${Math.floor(rounded / 60)}h ${rounded % 60}m` : `${rounded}m`;
  return minutes >= 0 ? `in ${unit}` : `${unit} overdue`;
}
