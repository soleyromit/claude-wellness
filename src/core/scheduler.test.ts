import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from './activities.js';
import { defaultConfig, setActivityEnabled, setGroupConfig } from '../store/config.js';
import { addDays } from './progress.js';
import {
  decide,
  isDue,
  selectableActivities,
  dismissedToday,
  inQuietHours,
  lastGroupActivityTs,
  minutesSinceMidnight,
  nextDueIn,
  overdueMinutes,
  parseTimeOfDay,
  pickActivity,
  snoozedUntil,
  type DecideInput,
} from './scheduler.js';
import type { ActivityGroup, Config, LogEvent } from './types.js';

const MINUTE = 60_000;
/** Fixed local 2pm — comfortably outside the default 22:00-08:00 quiet hours. */
const NOW = new Date(2026, 6, 30, 14, 0, 0).getTime();

/** Only hydration enabled, every 45 minutes. */
function hydrationOnly(): Config {
  let config = defaultConfig();
  for (const g of ['eyes', 'stretch', 'exercise', 'breathing', 'posture'] as ActivityGroup[]) {
    config = setGroupConfig(config, g, { enabled: false });
  }
  return config;
}

function input(overrides: Partial<DecideInput> = {}): DecideInput {
  return {
    events: [],
    config: hydrationOnly(),
    claude: 'busy',
    now: NOW,
    sessionStart: NOW - 60 * MINUTE, // an hour ago, so things are due
    lastNudgeTs: null,
    ...overrides,
  };
}

describe('parseTimeOfDay / minutesSinceMidnight', () => {
  it('converts a time string to minutes', () => {
    expect(parseTimeOfDay('00:00')).toBe(0);
    expect(parseTimeOfDay('08:30')).toBe(510);
    expect(parseTimeOfDay('23:59')).toBe(1439);
  });

  it('reads minutes off a timestamp', () => {
    expect(minutesSinceMidnight(new Date(2026, 0, 1, 14, 30).getTime())).toBe(870);
  });
});

describe('inQuietHours', () => {
  const config = defaultConfig(); // 22:00 - 08:00

  it('is quiet late at night and early in the morning', () => {
    expect(inQuietHours(config, new Date(2026, 0, 1, 23, 0).getTime())).toBe(true);
    expect(inQuietHours(config, new Date(2026, 0, 1, 3, 0).getTime())).toBe(true);
    expect(inQuietHours(config, new Date(2026, 0, 1, 22, 0).getTime())).toBe(true);
  });

  it('is not quiet during the working day', () => {
    expect(inQuietHours(config, new Date(2026, 0, 1, 14, 0).getTime())).toBe(false);
    expect(inQuietHours(config, new Date(2026, 0, 1, 8, 0).getTime())).toBe(false);
    expect(inQuietHours(config, new Date(2026, 0, 1, 21, 59).getTime())).toBe(false);
  });

  it('handles a window that does not wrap midnight', () => {
    const daytime = { ...config, quietHours: { start: '12:00', end: '13:00' } };
    expect(inQuietHours(daytime, new Date(2026, 0, 1, 12, 30).getTime())).toBe(true);
    expect(inQuietHours(daytime, new Date(2026, 0, 1, 14, 0).getTime())).toBe(false);
  });

  it('is never quiet when disabled', () => {
    expect(inQuietHours({ ...config, quietHours: null }, new Date(2026, 0, 1, 3, 0).getTime())).toBe(
      false,
    );
  });

  it('treats a zero-length window as disabled rather than always-on', () => {
    const zero = { ...config, quietHours: { start: '09:00', end: '09:00' } };
    expect(inQuietHours(zero, new Date(2026, 0, 1, 9, 0).getTime())).toBe(false);
  });
});

describe('snoozedUntil', () => {
  it('is zero with no snoozes', () => {
    expect(snoozedUntil([], 'hydration')).toBe(0);
  });

  it('returns the latest expiry for the group', () => {
    const events: LogEvent[] = [
      { ts: NOW, type: 'snoozed', activity: 'water', meta: { untilTs: NOW + 5 * MINUTE } },
      { ts: NOW, type: 'snoozed', activity: 'water', meta: { untilTs: NOW + 20 * MINUTE } },
    ];
    expect(snoozedUntil(events, 'hydration')).toBe(NOW + 20 * MINUTE);
  });

  it('does not leak across groups', () => {
    const events: LogEvent[] = [
      { ts: NOW, type: 'snoozed', activity: 'water', meta: { untilTs: NOW + 20 * MINUTE } },
    ];
    expect(snoozedUntil(events, 'stretch')).toBe(0);
  });
});

describe('dismissedToday', () => {
  it('is false without a day-scoped skip', () => {
    const events: LogEvent[] = [{ ts: NOW, type: 'skipped', activity: 'water' }];
    expect(dismissedToday(events, 'hydration', NOW)).toBe(false);
  });

  it('is true for a day-scoped skip today', () => {
    const events: LogEvent[] = [
      { ts: NOW, type: 'skipped', activity: 'water', meta: { scope: 'day' } },
    ];
    expect(dismissedToday(events, 'hydration', NOW)).toBe(true);
  });

  it('expires with the calendar day', () => {
    const events: LogEvent[] = [
      { ts: addDays(NOW, -1), type: 'skipped', activity: 'water', meta: { scope: 'day' } },
    ];
    expect(dismissedToday(events, 'hydration', NOW)).toBe(false);
  });
});

describe('lastGroupActivityTs', () => {
  it('is null with no history', () => {
    expect(lastGroupActivityTs([], 'hydration')).toBeNull();
  });

  it('counts shown nudges too, so a dismissed nudge does not re-fire forever', () => {
    const events: LogEvent[] = [{ ts: NOW, type: 'shown', activity: 'water' }];
    expect(lastGroupActivityTs(events, 'hydration')).toBe(NOW);
  });

  it('takes the most recent of any resetting event', () => {
    const events: LogEvent[] = [
      { ts: NOW - 10 * MINUTE, type: 'completed', activity: 'water' },
      { ts: NOW - 2 * MINUTE, type: 'shown', activity: 'water' },
    ];
    expect(lastGroupActivityTs(events, 'hydration')).toBe(NOW - 2 * MINUTE);
  });

  it('ignores other groups', () => {
    const events: LogEvent[] = [{ ts: NOW, type: 'completed', activity: 'stretch-wrists' }];
    expect(lastGroupActivityTs(events, 'hydration')).toBeNull();
  });
});

describe('overdueMinutes', () => {
  const config = hydrationOnly(); // hydration every 45m

  it('is null before the interval has elapsed', () => {
    const events: LogEvent[] = [{ ts: NOW - 10 * MINUTE, type: 'completed', activity: 'water' }];
    expect(overdueMinutes(events, config, 'hydration', NOW, NOW)).toBeNull();
  });

  it('reports how far past due once the interval elapses', () => {
    const events: LogEvent[] = [{ ts: NOW - 50 * MINUTE, type: 'completed', activity: 'water' }];
    expect(overdueMinutes(events, config, 'hydration', NOW, NOW)).toBeCloseTo(5);
  });

  it('is null for a disabled group', () => {
    const off = setGroupConfig(config, 'hydration', { enabled: false });
    expect(overdueMinutes([], off, 'hydration', NOW, NOW - 999 * MINUTE)).toBeNull();
  });

  it('measures from session start when there is no history, not from the epoch', () => {
    // Fresh install: nothing should be due the instant the companion launches.
    expect(overdueMinutes([], config, 'hydration', NOW, NOW)).toBeNull();
    // ...but it becomes due once the interval passes.
    expect(overdueMinutes([], config, 'hydration', NOW, NOW - 46 * MINUTE)).toBeCloseTo(1);
  });
});

describe('pickActivity', () => {
  it('returns null when the whole pool is switched off', () => {
    let config = defaultConfig();
    config = setActivityEnabled(config, 'water', false);
    expect(pickActivity([], config, 'hydration')).toBeNull();
  });

  it('prefers an activity never done over one done recently', () => {
    const events: LogEvent[] = [
      { ts: NOW, type: 'completed', activity: 'eyes-20-20-20' },
    ];
    expect(pickActivity(events, defaultConfig(), 'eyes')!.id).toBe('eyes-blink');
  });

  it('rotates to the least recently done', () => {
    const events: LogEvent[] = [
      { ts: NOW - 60 * MINUTE, type: 'completed', activity: 'eyes-20-20-20' },
      { ts: NOW - 5 * MINUTE, type: 'completed', activity: 'eyes-blink' },
    ];
    expect(pickActivity(events, defaultConfig(), 'eyes')!.id).toBe('eyes-20-20-20');
  });

  it('skips activities the user removed from the pool', () => {
    const config = setActivityEnabled(defaultConfig(), 'eyes-20-20-20', false);
    const picked = pickActivity([], config, 'eyes');
    expect(picked!.id).toBe('eyes-blink');
  });

  it('only picks from the requested group', () => {
    expect(pickActivity([], defaultConfig(), 'exercise')!.group).toBe('exercise');
  });
});

describe('decide', () => {
  it('nudges when something is overdue and Claude is busy', () => {
    const decision = decide(input());
    expect(decision.kind).toBe('nudge');
    if (decision.kind === 'nudge') {
      expect(decision.nudge.group).toBe('hydration');
      expect(decision.nudge.activity.id).toBe('water');
    }
  });

  it('holds off during quiet hours even when overdue', () => {
    const night = new Date(2026, 6, 30, 23, 0, 0).getTime();
    const decision = decide(input({ now: night, sessionStart: night - 120 * MINUTE }));
    expect(decision).toEqual({ kind: 'wait', reason: 'quiet-hours' });
  });

  it('respects the global cooldown so short prompts cannot pile up', () => {
    const decision = decide(input({ lastNudgeTs: NOW - 1 * MINUTE }));
    expect(decision).toEqual({ kind: 'wait', reason: 'cooldown' });
  });

  it('nudges again once the cooldown has passed', () => {
    expect(decide(input({ lastNudgeTs: NOW - 6 * MINUTE })).kind).toBe('nudge');
  });

  it('waits when nothing is due yet', () => {
    const decision = decide(input({ sessionStart: NOW }));
    expect(decision).toEqual({ kind: 'wait', reason: 'nothing-due' });
  });

  it('waits for Claude rather than interrupting when only mildly overdue', () => {
    // 5 minutes overdue, grace is 15 — not urgent enough to interrupt.
    const decision = decide(input({ claude: 'idle', sessionStart: NOW - 50 * MINUTE }));
    expect(decision).toEqual({ kind: 'wait', reason: 'waiting-for-claude' });
  });

  it('surfaces anyway once past the grace period, so reminders are not lost', () => {
    // 20 minutes overdue with grace 15 — Claude may never go busy.
    const decision = decide(input({ claude: 'idle', sessionStart: NOW - 65 * MINUTE }));
    expect(decision.kind).toBe('nudge');
  });

  it('reports when every group is disabled', () => {
    let config = hydrationOnly();
    config = setGroupConfig(config, 'hydration', { enabled: false });
    expect(decide(input({ config }))).toEqual({ kind: 'wait', reason: 'no-activities-enabled' });
  });

  it('skips a snoozed group', () => {
    const events: LogEvent[] = [
      { ts: NOW, type: 'snoozed', activity: 'water', meta: { untilTs: NOW + 10 * MINUTE } },
    ];
    expect(decide(input({ events })).kind).toBe('wait');
  });

  it('resumes after the snooze expires', () => {
    const events: LogEvent[] = [
      { ts: NOW - 20 * MINUTE, type: 'snoozed', activity: 'water', meta: { untilTs: NOW - MINUTE } },
    ];
    expect(decide(input({ events })).kind).toBe('nudge');
  });

  it('skips a group dismissed for the day', () => {
    const events: LogEvent[] = [
      { ts: NOW, type: 'skipped', activity: 'water', meta: { scope: 'day' } },
    ];
    expect(decide(input({ events }))).toEqual({ kind: 'wait', reason: 'nothing-due' });
  });

  it('picks the most overdue group when several are eligible', () => {
    // Eyes every 20m, hydration every 45m; session started 3h ago so both are
    // overdue, but hydration by less.
    const config = defaultConfig();
    const events: LogEvent[] = [
      { ts: NOW - 30 * MINUTE, type: 'completed', activity: 'water' }, // hydration not yet due
      { ts: NOW - 200 * MINUTE, type: 'completed', activity: 'eyes-blink' }, // eyes badly overdue
    ];
    const decision = decide(input({ config, events, sessionStart: NOW - 180 * MINUTE }));
    expect(decision.kind).toBe('nudge');
    if (decision.kind === 'nudge') expect(decision.nudge.group).toBe('eyes');
  });

  it('falls through to the next group when the top one has an empty pool', () => {
    let config = defaultConfig();
    // Disable every eyes activity, leaving the group enabled but unusable.
    config = setActivityEnabled(config, 'eyes-20-20-20', false);
    config = setActivityEnabled(config, 'eyes-blink', false);

    const decision = decide(input({ config, sessionStart: NOW - 300 * MINUTE }));
    expect(decision.kind).toBe('nudge');
    if (decision.kind === 'nudge') expect(decision.nudge.group).not.toBe('eyes');
  });

  it('reports overdue minutes on the nudge', () => {
    const decision = decide(input({ sessionStart: NOW - 50 * MINUTE }));
    if (decision.kind !== 'nudge') throw new Error('expected a nudge');
    expect(decision.nudge.overdueMinutes).toBeCloseTo(5);
  });
});

describe('selectableActivities', () => {
  it('lists every activity in every enabled group', () => {
    const all = selectableActivities([], defaultConfig(), NOW, NOW);
    // Posture is off by default; everything else should be offered.
    expect(all.some((a) => a.group === 'posture')).toBe(false);
    expect(all.some((a) => a.group === 'hydration')).toBe(true);
    expect(all.some((a) => a.group === 'exercise')).toBe(true);
  });

  it('excludes groups the user switched off', () => {
    const all = selectableActivities([], hydrationOnly(), NOW, NOW);
    expect(all.map((a) => a.group)).toEqual(['hydration']);
  });

  it('excludes individual activities removed from the pool', () => {
    const config = setActivityEnabled(defaultConfig(), 'exercise-plank', false);
    const all = selectableActivities([], config, NOW, NOW);
    expect(all.some((a) => a.id === 'exercise-plank')).toBe(false);
    expect(all.some((a) => a.id === 'exercise-squats')).toBe(true);
  });

  it('offers not-yet-due activities too, so you are never stuck', () => {
    // Nothing is due a second after startup, but you should still be able to
    // choose something deliberately.
    expect(selectableActivities([], defaultConfig(), NOW, NOW).length).toBeGreaterThan(0);
  });

  it('ranks the most overdue group first', () => {
    const events: LogEvent[] = [
      { ts: NOW - 5 * MINUTE, type: 'completed', activity: 'water' },
      { ts: NOW - 300 * MINUTE, type: 'completed', activity: 'eyes-blink' },
    ];
    const all = selectableActivities(events, defaultConfig(), NOW, NOW - 300 * MINUTE);
    expect(all[0]!.group).toBe('eyes');
  });

  it('pulls a preferred group to the front when cycling within it', () => {
    const all = selectableActivities([], defaultConfig(), NOW, NOW, 'breathing');
    expect(all[0]!.group).toBe('breathing');
    expect(all[1]!.group).toBe('breathing');
  });

  it('is empty when nothing at all is enabled', () => {
    let config = hydrationOnly();
    config = setGroupConfig(config, 'hydration', { enabled: false });
    expect(selectableActivities([], config, NOW, NOW)).toEqual([]);
  });

  it('returns a stable order for the same inputs', () => {
    const a = selectableActivities([], defaultConfig(), NOW, NOW).map((x) => x.id);
    const b = selectableActivities([], defaultConfig(), NOW, NOW).map((x) => x.id);
    expect(a).toEqual(b);
  });
});

describe('isDue', () => {
  it('is false before the interval elapses', () => {
    const water = ACTIVITIES.find((a) => a.id === 'water')!;
    expect(isDue([], hydrationOnly(), water, NOW, NOW)).toBe(false);
  });

  it('is true once the group is overdue', () => {
    const water = ACTIVITIES.find((a) => a.id === 'water')!;
    expect(isDue([], hydrationOnly(), water, NOW, NOW - 60 * MINUTE)).toBe(true);
  });
});

describe('nextDueIn', () => {
  it('is null when no group is enabled', () => {
    let config = hydrationOnly();
    config = setGroupConfig(config, 'hydration', { enabled: false });
    expect(nextDueIn([], config, NOW, NOW)).toBeNull();
  });

  it('counts down to the next due group', () => {
    const next = nextDueIn([], hydrationOnly(), NOW, NOW);
    expect(next!.group).toBe('hydration');
    expect(next!.minutes).toBeCloseTo(45);
  });

  it('goes negative once overdue', () => {
    const next = nextDueIn([], hydrationOnly(), NOW, NOW - 50 * MINUTE);
    expect(next!.minutes).toBeCloseTo(-5);
  });

  it('picks the soonest across groups', () => {
    // Eyes at 20m is sooner than hydration at 45m.
    expect(nextDueIn([], defaultConfig(), NOW, NOW)!.group).toBe('eyes');
  });

  it('defers to an active snooze', () => {
    const events: LogEvent[] = [
      { ts: NOW, type: 'snoozed', activity: 'water', meta: { untilTs: NOW + 90 * MINUTE } },
    ];
    const next = nextDueIn(events, hydrationOnly(), NOW, NOW);
    expect(next!.minutes).toBeCloseTo(90);
  });
});
