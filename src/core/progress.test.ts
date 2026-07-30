import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../store/config.js';
import {
  addDays,
  computeLevel,
  computeStreaks,
  dailyTarget,
  dayBounds,
  dayKey,
  eventUnits,
  heatmap,
  lastEventTs,
  ringsFor,
  streakThreshold,
  totalXp,
  unitsOn,
} from './progress.js';
import type { Config, LogEvent } from './types.js';

/** A fixed local noon so tests never straddle a day boundary. */
const NOON = new Date(2026, 6, 30, 12, 0, 0).getTime();

function completed(activity: string, ts: number, meta?: Record<string, unknown>): LogEvent {
  return meta ? { ts, type: 'completed', activity, meta } : { ts, type: 'completed', activity };
}

/** Only hydration enabled, goal 4 — keeps arithmetic in the tests obvious. */
function simpleConfig(): Config {
  const base = defaultConfig();
  const groups = { ...base.groups };
  for (const g of Object.keys(groups) as (keyof typeof groups)[]) {
    groups[g] = { ...groups[g], enabled: g === 'hydration' };
  }
  groups.hydration = { ...groups.hydration, dailyGoal: 4 };
  return { ...base, groups };
}

describe('dayKey / dayBounds / addDays', () => {
  it('formats a local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });

  it('brackets the local day containing a timestamp', () => {
    const { start, end } = dayBounds(NOON);
    expect(dayKey(start)).toBe('2026-07-30');
    expect(start).toBeLessThan(NOON);
    expect(end).toBeGreaterThan(NOON);
    expect(dayKey(end - 1)).toBe('2026-07-30');
  });

  it('moves whole calendar days in both directions', () => {
    expect(dayKey(addDays(NOON, -1))).toBe('2026-07-29');
    expect(dayKey(addDays(NOON, 1))).toBe('2026-07-31');
  });

  it('crosses month boundaries correctly', () => {
    const firstOfMonth = new Date(2026, 7, 1, 12).getTime();
    expect(dayKey(addDays(firstOfMonth, -1))).toBe('2026-07-31');
  });
});

describe('eventUnits', () => {
  it('is one by default', () => {
    expect(eventUnits(completed('water', NOON))).toBe(1);
  });

  it('honours an explicit count so logging 3 cups counts as 3', () => {
    expect(eventUnits(completed('water', NOON, { count: 3 }))).toBe(3);
  });

  it('ignores nonsense counts rather than corrupting the totals', () => {
    expect(eventUnits(completed('water', NOON, { count: 0 }))).toBe(1);
    expect(eventUnits(completed('water', NOON, { count: -5 }))).toBe(1);
    expect(eventUnits(completed('water', NOON, { count: 'lots' }))).toBe(1);
    expect(eventUnits(completed('water', NOON, { count: Infinity }))).toBe(1);
  });
});

describe('ringsFor', () => {
  it('only includes enabled groups', () => {
    const rings = ringsFor([], simpleConfig(), NOON);
    expect(rings.map((r) => r.group)).toEqual(['hydration']);
  });

  it('counts only completions from the given day', () => {
    const events = [
      completed('water', NOON),
      completed('water', addDays(NOON, -1)),
      completed('water', addDays(NOON, 1)),
    ];
    expect(ringsFor(events, simpleConfig(), NOON)[0]!.done).toBe(1);
  });

  it('ignores non-completion events', () => {
    const events: LogEvent[] = [
      { ts: NOON, type: 'shown', activity: 'water' },
      { ts: NOON, type: 'skipped', activity: 'water' },
      { ts: NOON, type: 'snoozed', activity: 'water' },
    ];
    expect(ringsFor(events, simpleConfig(), NOON)[0]!.done).toBe(0);
  });

  it('attributes completions to the right group', () => {
    const config = defaultConfig();
    const events = [completed('exercise-squats', NOON), completed('water', NOON)];
    const rings = ringsFor(events, config, NOON);
    expect(rings.find((r) => r.group === 'exercise')!.done).toBe(1);
    expect(rings.find((r) => r.group === 'hydration')!.done).toBe(1);
    expect(rings.find((r) => r.group === 'stretch')!.done).toBe(0);
  });

  it('reports progress and closes at the goal', () => {
    const config = simpleConfig();
    const two = ringsFor([completed('water', NOON, { count: 2 })], config, NOON)[0]!;
    expect(two.progress).toBe(0.5);
    expect(two.closed).toBe(false);

    const four = ringsFor([completed('water', NOON, { count: 4 })], config, NOON)[0]!;
    expect(four.closed).toBe(true);
  });

  it('clamps progress at 1 when you overshoot', () => {
    const ring = ringsFor([completed('water', NOON, { count: 99 })], simpleConfig(), NOON)[0]!;
    expect(ring.progress).toBe(1);
    expect(ring.done).toBe(99);
  });

  it('ignores unknown activity ids left over from an older version', () => {
    const rings = ringsFor([completed('removed-activity', NOON)], simpleConfig(), NOON);
    expect(rings[0]!.done).toBe(0);
  });
});

describe('dailyTarget and streakThreshold', () => {
  it('sums the goals of enabled groups only', () => {
    expect(dailyTarget(simpleConfig())).toBe(4);
  });

  it('requires half your enabled groups to count toward a streak', () => {
    // simpleConfig enables one group, so one group is enough.
    expect(streakThreshold(simpleConfig())).toBe(1);
    // The defaults enable five groups, so three of them.
    expect(streakThreshold(defaultConfig())).toBe(3);
  });

  it('does not get harder just because you raised a daily goal', () => {
    const modest = simpleConfig();
    const ambitious = {
      ...modest,
      groups: { ...modest.groups, hydration: { ...modest.groups.hydration, dailyGoal: 20 } },
    };
    expect(streakThreshold(ambitious)).toBe(streakThreshold(modest));
  });

  it('always requires at least one unit', () => {
    const config = defaultConfig();
    const groups = { ...config.groups };
    for (const g of Object.keys(groups) as (keyof typeof groups)[]) {
      groups[g] = { ...groups[g], enabled: false };
    }
    expect(streakThreshold({ ...config, groups })).toBe(1);
  });
});

describe('computeStreaks', () => {
  const config = simpleConfig(); // one group enabled, so threshold = 1

  it('is zero with no history', () => {
    expect(computeStreaks([], config, NOON)).toEqual({ current: 0, longest: 0 });
  });

  it('counts consecutive qualifying days ending today', () => {
    const events = [0, 1, 2].map((i) => completed('water', addDays(NOON, -i)));
    expect(computeStreaks(events, config, NOON).current).toBe(3);
  });

  it('does not break the streak just because today is unfinished', () => {
    // Nothing done today yet, but the three days before all qualified.
    const events = [1, 2, 3].map((i) => completed('water', addDays(NOON, -i)));
    expect(computeStreaks(events, config, NOON).current).toBe(3);
  });

  it('breaks when a day is genuinely missed', () => {
    const events = [
      completed('water', addDays(NOON, -1)),
      // -2 missed entirely
      completed('water', addDays(NOON, -3)),
    ];
    expect(computeStreaks(events, config, NOON).current).toBe(1);
  });

  it('reports the longest historical run even after it ends', () => {
    const events = [-10, -9, -8, -7, 0].map((i) => completed('water', addDays(NOON, i)));
    const streaks = computeStreaks(events, config, NOON);
    expect(streaks.current).toBe(1);
    expect(streaks.longest).toBe(4);
  });

  it('needs breadth across groups, not just repetition of one', () => {
    const config = defaultConfig(); // five groups, so three are needed
    const onlyWater = [completed('water', NOON), completed('water', NOON + 1000)];
    expect(computeStreaks(onlyWater, config, NOON).current).toBe(0);

    const threeGroups = [
      completed('water', NOON),
      completed('stretch-wrists', NOON),
      completed('eyes-blink', NOON),
    ];
    expect(computeStreaks(threeGroups, config, NOON).current).toBe(1);
  });

  it('does not double-count two activities from the same group', () => {
    const config = defaultConfig(); // needs three distinct groups
    const events = [
      completed('eyes-blink', NOON),
      completed('eyes-20-20-20', NOON),
      completed('water', NOON),
    ];
    expect(computeStreaks(events, config, NOON).current).toBe(0);
  });
});

describe('totalXp and computeLevel', () => {
  it('weights harder activities more', () => {
    expect(totalXp([completed('exercise-squats', NOON)])).toBe(25);
    expect(totalXp([completed('stretch-wrists', NOON)])).toBe(15);
    expect(totalXp([completed('water', NOON)])).toBe(5);
  });

  it('multiplies by unit count', () => {
    expect(totalXp([completed('water', NOON, { count: 3 })])).toBe(15);
  });

  it('only counts completions', () => {
    expect(totalXp([{ ts: NOON, type: 'skipped', activity: 'exercise-squats' }])).toBe(0);
  });

  it('ignores unknown activities', () => {
    expect(totalXp([completed('gone', NOON)])).toBe(0);
  });

  it('starts at level 1 and climbs on a widening curve', () => {
    expect(computeLevel(0).level).toBe(1);
    expect(computeLevel(49).level).toBe(1);
    expect(computeLevel(50).level).toBe(2);
    expect(computeLevel(200).level).toBe(3);
    expect(computeLevel(450).level).toBe(4);
  });

  it('reports progress within the current level', () => {
    const level = computeLevel(100); // level 2 spans 50..200
    expect(level.level).toBe(2);
    expect(level.intoLevel).toBe(50);
    expect(level.levelSpan).toBe(150);
    expect(level.progress).toBeCloseTo(1 / 3);
  });
});

describe('heatmap', () => {
  it('returns the requested number of days, oldest first', () => {
    const days = heatmap([], simpleConfig(), NOON, 7);
    expect(days).toHaveLength(7);
    expect(days[0]!.key).toBe(dayKey(addDays(NOON, -6)));
    expect(days[6]!.key).toBe(dayKey(NOON));
  });

  it('scores intensity against the daily target and flags counted days', () => {
    const events = [completed('water', NOON, { count: 2 })];
    const today = heatmap(events, simpleConfig(), NOON, 3)[2]!;
    expect(today.units).toBe(2);
    expect(today.intensity).toBe(0.5);
    expect(today.counted).toBe(true); // threshold is 2
  });

  it('clamps intensity when the target is exceeded', () => {
    const events = [completed('water', NOON, { count: 50 })];
    expect(heatmap(events, simpleConfig(), NOON, 1)[0]!.intensity).toBe(1);
  });
});

describe('unitsOn and lastEventTs', () => {
  it('totals units for a day', () => {
    const events = [completed('water', NOON), completed('water', NOON, { count: 2 })];
    expect(unitsOn(events, NOON)).toBe(3);
  });

  it('finds the most recent matching event', () => {
    const events = [
      completed('water', NOON - 5000),
      completed('water', NOON - 1000),
      completed('stretch-wrists', NOON),
    ];
    expect(lastEventTs(events, (e) => e.activity === 'water')).toBe(NOON - 1000);
  });

  it('returns null when nothing matches', () => {
    expect(lastEventTs([], () => true)).toBeNull();
    expect(lastEventTs([completed('water', NOON)], (e) => e.activity === 'nope')).toBeNull();
  });
});
