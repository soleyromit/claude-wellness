/**
 * Everything the dashboard shows, derived from the raw event log.
 *
 * All of it is pure and recomputed from scratch. Nothing here is cached to
 * disk, so streaks and rings can never disagree with the history that produced
 * them — the classic failure mode for habit trackers.
 */

import { getActivity } from './activities.js';
import { ACTIVITY_GROUPS, type ActivityGroup, type Config, type LogEvent } from './types.js';

/** Local calendar day as `YYYY-MM-DD`. Local, not UTC — a day is where you are. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Midnight-to-midnight bounds of the local day containing `ts`. */
export function dayBounds(ts: number): { start: number; end: number } {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

/** Shift a timestamp by whole days, staying correct across DST boundaries. */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

export function completionsOn(events: readonly LogEvent[], ts: number): LogEvent[] {
  const { start, end } = dayBounds(ts);
  return events.filter((e) => e.type === 'completed' && e.ts >= start && e.ts < end);
}

/**
 * How many units an event is worth.
 *
 * Instant activities carry a count in `meta` — logging three cups of water at
 * once is three units toward the hydration ring, not one.
 */
export function eventUnits(event: LogEvent): number {
  const count = event.meta?.['count'];
  if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
    return Math.floor(count);
  }
  return 1;
}

export interface Ring {
  readonly group: ActivityGroup;
  readonly done: number;
  readonly goal: number;
  /** 0..1, clamped. */
  readonly progress: number;
  readonly closed: boolean;
}

/** One ring per enabled group, for the day containing `ts`. */
export function ringsFor(
  events: readonly LogEvent[],
  config: Config,
  ts: number,
): Ring[] {
  const today = completionsOn(events, ts);

  const rings: Ring[] = [];
  for (const group of ACTIVITY_GROUPS) {
    const groupConfig = config.groups[group];
    if (!groupConfig.enabled) continue;

    const done = today
      .filter((e) => getActivity(e.activity)?.group === group)
      .reduce((sum, e) => sum + eventUnits(e), 0);

    const goal = Math.max(1, groupConfig.dailyGoal);
    rings.push({
      group,
      done,
      goal,
      progress: Math.min(1, done / goal),
      closed: done >= goal,
    });
  }
  return rings;
}

/** Total units needed across all enabled groups to fully close the day. */
export function dailyTarget(config: Config): number {
  return ACTIVITY_GROUPS.filter((g) => config.groups[g].enabled).reduce(
    (sum, g) => sum + Math.max(1, config.groups[g].dailyGoal),
    0,
  );
}

/** Groups with at least one completion on the day containing `ts`. */
export function groupsTouchedOn(
  events: readonly LogEvent[],
  ts: number,
): Set<ActivityGroup> {
  const touched = new Set<ActivityGroup>();
  for (const e of completionsOn(events, ts)) {
    const group = getActivity(e.activity)?.group;
    if (group) touched.add(group);
  }
  return touched;
}

/**
 * How many distinct groups a day needs for the streak to survive it.
 *
 * Deliberately measured in *breadth*, not volume. Counting units punishes you
 * for tuning your goals upward — raise the hydration target and suddenly your
 * streak is harder to keep, which is exactly backwards. Breadth also matches
 * what a streak is for: proving you kept the routine going, not that you hit a
 * quota. The rings already show volume.
 */
export function streakThreshold(config: Config): number {
  const enabled = ACTIVITY_GROUPS.filter((g) => config.groups[g].enabled).length;
  return Math.max(1, Math.ceil(enabled / 2));
}

export function unitsOn(events: readonly LogEvent[], ts: number): number {
  return completionsOn(events, ts).reduce((sum, e) => sum + eventUnits(e), 0);
}

export function dayCounts(events: readonly LogEvent[], config: Config, ts: number): boolean {
  return groupsTouchedOn(events, ts).size >= streakThreshold(config);
}

export interface Streaks {
  readonly current: number;
  readonly longest: number;
}

/**
 * Current and longest streak, in days.
 *
 * Today is special-cased: a day you haven't finished yet must not break the
 * streak, so an incomplete today is skipped rather than counted as a miss.
 */
export function computeStreaks(
  events: readonly LogEvent[],
  config: Config,
  now: number,
): Streaks {
  const qualifying = new Set<string>();
  const threshold = streakThreshold(config);

  const groupsByDay = new Map<string, Set<ActivityGroup>>();
  for (const e of events) {
    if (e.type !== 'completed') continue;
    const group = getActivity(e.activity)?.group;
    if (!group) continue;
    const key = dayKey(e.ts);
    let set = groupsByDay.get(key);
    if (!set) {
      set = new Set();
      groupsByDay.set(key, set);
    }
    set.add(group);
  }
  for (const [key, groups] of groupsByDay) {
    if (groups.size >= threshold) qualifying.add(key);
  }

  // Current: walk backwards from today.
  let current = 0;
  let cursor = now;
  if (!qualifying.has(dayKey(now))) {
    cursor = addDays(now, -1); // today isn't over — don't count it as a miss
  }
  while (qualifying.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  // Longest: scan the sorted set of qualifying days for consecutive runs.
  const sorted = [...qualifying].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of sorted) {
    if (previous !== null && dayKey(addDays(dateFromKey(previous), 1)) === key) {
      run++;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previous = key;
  }

  return { current, longest: Math.max(longest, current) };
}

function dateFromKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getTime();
}

/**
 * XP per completion, weighted by effort. Getting out of the chair should be
 * worth meaningfully more than logging a cup of water.
 */
export const XP_BY_GROUP: Readonly<Record<ActivityGroup, number>> = {
  exercise: 25,
  stretch: 15,
  breathing: 10,
  posture: 5,
  eyes: 5,
  hydration: 5,
};

export function totalXp(events: readonly LogEvent[]): number {
  let xp = 0;
  for (const e of events) {
    if (e.type !== 'completed') continue;
    const group = getActivity(e.activity)?.group;
    if (!group) continue;
    xp += XP_BY_GROUP[group] * eventUnits(e);
  }
  return xp;
}

export interface Level {
  readonly level: number;
  readonly xp: number;
  /** XP earned into the current level. */
  readonly intoLevel: number;
  /** XP required to span the current level. */
  readonly levelSpan: number;
  readonly progress: number;
}

/**
 * Levels widen as they go, so early ones arrive quickly and later ones mean
 * something. Level n starts at 50*(n-1)^2 XP.
 */
export function xpToLevelStart(level: number): number {
  return 50 * (level - 1) ** 2;
}

export function computeLevel(xp: number): Level {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const start = xpToLevelStart(level);
  const next = xpToLevelStart(level + 1);
  const levelSpan = next - start;
  const intoLevel = xp - start;
  return {
    level,
    xp,
    intoLevel,
    levelSpan,
    progress: levelSpan === 0 ? 0 : intoLevel / levelSpan,
  };
}

export interface HeatmapDay {
  readonly key: string;
  readonly ts: number;
  readonly units: number;
  readonly target: number;
  /** 0..1, clamped. */
  readonly intensity: number;
  readonly counted: boolean;
}

/** The last `days` calendar days, oldest first, for the stats view. */
export function heatmap(
  events: readonly LogEvent[],
  config: Config,
  now: number,
  days = 7,
): HeatmapDay[] {
  const target = dailyTarget(config);
  const out: HeatmapDay[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const ts = addDays(now, -i);
    const units = unitsOn(events, ts);
    out.push({
      key: dayKey(ts),
      ts,
      units,
      target,
      intensity: target === 0 ? 0 : Math.min(1, units / target),
      counted: dayCounts(events, config, ts),
    });
  }
  return out;
}

/** Timestamp of the most recent matching event, or null. */
export function lastEventTs(
  events: readonly LogEvent[],
  predicate: (e: LogEvent) => boolean,
): number | null {
  let latest: number | null = null;
  for (const e of events) {
    if (predicate(e) && (latest === null || e.ts > latest)) latest = e.ts;
  }
  return latest;
}
