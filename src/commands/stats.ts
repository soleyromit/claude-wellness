/**
 * `wellness stats` — streaks, level and a week at a glance.
 *
 * Printed rather than rendered as a TUI: it's a report you read once and close,
 * and plain output can be piped or screenshotted.
 */

import { GROUP_LABELS } from '../core/activities.js';
import {
  computeLevel,
  computeStreaks,
  dailyTarget,
  heatmap,
  ringsFor,
  totalXp,
} from '../core/progress.js';
import { computePet } from '../core/pet.js';
import { loadConfig } from '../store/config.js';
import { loadLog } from '../store/log.js';

/** Five shades of block, so a week reads as a gradient at a glance. */
const SHADES = ['·', '░', '▒', '▓', '█'] as const;

export function shadeFor(intensity: number): string {
  if (intensity <= 0) return SHADES[0];
  const index = Math.min(SHADES.length - 1, Math.ceil(intensity * (SHADES.length - 1)));
  return SHADES[index]!;
}

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export function renderStats(now = Date.now(), env?: NodeJS.ProcessEnv): string {
  const config = loadConfig(env);
  const events = loadLog(env);

  const lines: string[] = [];
  const streaks = computeStreaks(events, config, now);
  const level = computeLevel(totalXp(events));
  const pet = computePet(events, config, now);

  lines.push('');
  lines.push('  wellness');
  lines.push('');

  if (events.length === 0) {
    lines.push('  No history yet. Run `wellness` in a second pane to get started.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`  Level ${level.level}   ${level.xp} xp total`);
  lines.push(`  Streak ${streaks.current} days   (best ${streaks.longest})`);
  lines.push(`  Companion: ${pet.mood}`);
  lines.push('');

  lines.push('  Last 14 days');
  const days = heatmap(events, config, now, 14);
  const strip = days.map((d) => shadeFor(d.intensity)).join(' ');
  const labels = days
    .map((d) => DAY_INITIALS[new Date(d.ts).getDay()]!)
    .join(' ');
  lines.push(`    ${strip}`);
  lines.push(`    ${labels}`);
  lines.push(`    target ${dailyTarget(config)} units/day`);
  lines.push('');

  lines.push('  Today');
  for (const ring of ringsFor(events, config, now)) {
    const label = GROUP_LABELS[ring.group].padEnd(10);
    const filled = Math.round(ring.progress * 12);
    const bar = '█'.repeat(filled) + '░'.repeat(12 - filled);
    lines.push(`    ${label} ${bar} ${ring.done}/${ring.goal}${ring.closed ? ' ✓' : ''}`);
  }
  lines.push('');

  return lines.join('\n');
}
