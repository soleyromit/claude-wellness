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
} as const;

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
 * Layout tier, chosen from the pane width. Side panes are often very narrow,
 * so this is not an edge case — it's the common case.
 */
export type Tier = 'full' | 'compact' | 'minimal';

export function tierFor(columns: number): Tier {
  if (columns >= 80) return 'full';
  if (columns >= 50) return 'compact';
  return 'minimal';
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
