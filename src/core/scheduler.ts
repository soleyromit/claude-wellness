/**
 * Deciding what to surface, and when.
 *
 * The whole point of the app is that reminders land in *dead time* — the
 * seconds you're already losing while Claude works — instead of interrupting
 * you mid-thought. So a group becoming due doesn't fire a nudge; it makes the
 * group *eligible*, and the nudge waits for Claude to start thinking.
 *
 * The escape hatch is `graceMinutes`: if something has been eligible far too
 * long and Claude never went busy (you spent an hour in your editor), we
 * surface it anyway rather than silently dropping the reminder.
 *
 * This module is pure — it takes the clock, config, log and Claude's state as
 * arguments and returns a decision. That makes every rule below directly
 * testable without waiting on real time.
 */

import { ACTIVITIES, activitiesInGroup } from './activities.js';
import { lastEventTs } from './progress.js';
import { dayBounds } from './progress.js';
import {
  ACTIVITY_GROUPS,
  type Activity,
  type ActivityGroup,
  type ClaudeState,
  type Config,
  type LogEvent,
} from './types.js';

const MINUTE = 60_000;

/** Why a nudge is or isn't happening — surfaced by `wellness doctor`. */
export type SkipReason =
  | 'quiet-hours'
  | 'cooldown'
  | 'nothing-due'
  | 'waiting-for-claude'
  | 'no-activities-enabled';

export interface Nudge {
  readonly activity: Activity;
  readonly group: ActivityGroup;
  /** How many minutes past due this group is. */
  readonly overdueMinutes: number;
}

export type Decision =
  | { readonly kind: 'nudge'; readonly nudge: Nudge }
  | { readonly kind: 'wait'; readonly reason: SkipReason };

/** `"22:00"` -> minutes since local midnight. */
export function parseTimeOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

export function minutesSinceMidnight(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Quiet hours normally wrap midnight (22:00 to 08:00), so the window is
 * "outside the gap" rather than "between the two times".
 */
export function inQuietHours(config: Config, now: number): boolean {
  if (!config.quietHours) return false;

  const start = parseTimeOfDay(config.quietHours.start);
  const end = parseTimeOfDay(config.quietHours.end);
  const nowMinutes = minutesSinceMidnight(now);

  if (start === end) return false; // zero-length window, not all-day
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}

/** Snoozes carry an expiry in `meta.untilTs`; the newest one wins. */
export function snoozedUntil(events: readonly LogEvent[], group: ActivityGroup): number {
  let until = 0;
  for (const e of events) {
    if (e.type !== 'snoozed') continue;
    if (activityGroupOf(e.activity) !== group) continue;
    const ts = e.meta?.['untilTs'];
    if (typeof ts === 'number' && ts > until) until = ts;
  }
  return until;
}

function activityGroupOf(activityId: string): ActivityGroup | undefined {
  return ACTIVITIES.find((a) => a.id === activityId)?.group;
}

/** A group skipped today is out until tomorrow — `[d]` means "not today". */
export function dismissedToday(
  events: readonly LogEvent[],
  group: ActivityGroup,
  now: number,
): boolean {
  const { start, end } = dayBounds(now);
  return events.some(
    (e) =>
      e.type === 'skipped' &&
      e.ts >= start &&
      e.ts < end &&
      activityGroupOf(e.activity) === group &&
      e.meta?.['scope'] === 'day',
  );
}

/**
 * When a group's clock last reset.
 *
 * Both completing *and* being shown a nudge reset it — otherwise dismissing a
 * nudge would leave the group permanently overdue and it would re-fire on
 * every single Claude turn.
 */
export function lastGroupActivityTs(
  events: readonly LogEvent[],
  group: ActivityGroup,
): number | null {
  return lastEventTs(
    events,
    (e) =>
      (e.type === 'completed' || e.type === 'shown' || e.type === 'skipped') &&
      activityGroupOf(e.activity) === group,
  );
}

/** Minutes past due, or null if the group isn't due yet. */
export function overdueMinutes(
  events: readonly LogEvent[],
  config: Config,
  group: ActivityGroup,
  now: number,
  sessionStart: number,
): number | null {
  const groupConfig = config.groups[group];
  if (!groupConfig.enabled) return null;

  // With no history, count from when the companion started rather than from
  // the epoch — otherwise every group is instantly overdue by decades and the
  // user gets buried on first launch.
  const last = lastGroupActivityTs(events, group) ?? sessionStart;
  const elapsed = (now - last) / MINUTE;
  const over = elapsed - groupConfig.everyMinutes;
  return over >= 0 ? over : null;
}

/**
 * Pick the activity within a group that was done least recently, so the
 * rotation gives variety instead of the same stretch every time.
 */
export function pickActivity(
  events: readonly LogEvent[],
  config: Config,
  group: ActivityGroup,
): Activity | null {
  const pool = activitiesInGroup(group).filter(
    (a) => config.activities[a.id] !== false,
  );
  if (pool.length === 0) return null;

  let best: Activity | null = null;
  let bestTs = Infinity;
  for (const activity of pool) {
    // Never done ranks oldest, so new activities surface first.
    const last = lastEventTs(events, (e) => e.type === 'completed' && e.activity === activity.id);
    const ts = last ?? -Infinity;
    if (ts < bestTs) {
      bestTs = ts;
      best = activity;
    }
  }
  return best;
}

export interface DecideInput {
  readonly events: readonly LogEvent[];
  readonly config: Config;
  readonly claude: ClaudeState;
  readonly now: number;
  /** When the companion started — the baseline for groups with no history. */
  readonly sessionStart: number;
  /** When we last showed a nudge, for the global cooldown. */
  readonly lastNudgeTs: number | null;
}

/**
 * The one decision function. Returns either the nudge to show or why we're
 * holding off.
 */
export function decide(input: DecideInput): Decision {
  const { events, config, claude, now, sessionStart, lastNudgeTs } = input;

  if (inQuietHours(config, now)) return { kind: 'wait', reason: 'quiet-hours' };

  if (
    lastNudgeTs !== null &&
    (now - lastNudgeTs) / MINUTE < config.cooldownMinutes
  ) {
    return { kind: 'wait', reason: 'cooldown' };
  }

  const enabledGroups = ACTIVITY_GROUPS.filter((g) => config.groups[g].enabled);
  if (enabledGroups.length === 0) {
    return { kind: 'wait', reason: 'no-activities-enabled' };
  }

  // Rank every eligible group by how overdue it is; most overdue wins.
  const candidates: Nudge[] = [];
  for (const group of enabledGroups) {
    if (snoozedUntil(events, group) > now) continue;
    if (dismissedToday(events, group, now)) continue;

    const over = overdueMinutes(events, config, group, now, sessionStart);
    if (over === null) continue;

    const activity = pickActivity(events, config, group);
    if (!activity) continue; // whole pool switched off

    candidates.push({ activity, group, overdueMinutes: over });
  }

  if (candidates.length === 0) return { kind: 'wait', reason: 'nothing-due' };

  candidates.sort((a, b) => b.overdueMinutes - a.overdueMinutes);
  const top = candidates[0]!;

  // The core rule: wait for dead time, unless it's drifted past grace.
  if (claude !== 'busy' && top.overdueMinutes < config.graceMinutes) {
    return { kind: 'wait', reason: 'waiting-for-claude' };
  }

  return { kind: 'nudge', nudge: top };
}

/**
 * Minutes until the next group comes due, for the dashboard's "next up" line.
 * Null when nothing is scheduled.
 */
export function nextDueIn(
  events: readonly LogEvent[],
  config: Config,
  now: number,
  sessionStart: number,
): { group: ActivityGroup; minutes: number } | null {
  let best: { group: ActivityGroup; minutes: number } | null = null;

  for (const group of ACTIVITY_GROUPS) {
    const groupConfig = config.groups[group];
    if (!groupConfig.enabled) continue;

    const last = lastGroupActivityTs(events, group) ?? sessionStart;
    const dueAt = last + groupConfig.everyMinutes * MINUTE;
    const snooze = snoozedUntil(events, group);
    const effectiveDueAt = Math.max(dueAt, snooze);
    const minutes = (effectiveDueAt - now) / MINUTE;

    if (best === null || minutes < best.minutes) best = { group, minutes };
  }

  return best;
}
