import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../store/config.js';
import { computePet } from './pet.js';
import { addDays } from './progress.js';
import { ACTIVITY_GROUPS, type ActivityGroup, type Config, type LogEvent } from './types.js';

const NOON = new Date(2026, 6, 30, 12, 0, 0).getTime();

/** Exactly four groups enabled, so adherence lands on clean quarters. */
const ENABLED: ActivityGroup[] = ['hydration', 'eyes', 'stretch', 'exercise'];

/** One activity per enabled group, in the same order. */
const ONE_PER_GROUP = ['water', 'eyes-blink', 'stretch-wrists', 'exercise-squats'] as const;

function config(): Config {
  const base = defaultConfig();
  const groups = { ...base.groups };
  for (const g of ACTIVITY_GROUPS) {
    groups[g] = { ...groups[g], enabled: ENABLED.includes(g) };
  }
  return { ...base, groups };
}

function done(activity: string, ts: number): LogEvent {
  return { ts, type: 'completed', activity };
}

/** Touch `groupCount` distinct groups on the given day. */
function dayTouching(groupCount: number, ts: number): LogEvent[] {
  return ONE_PER_GROUP.slice(0, groupCount).map((id) => done(id, ts));
}

/** `groupCount` groups touched on each of the three complete days before today. */
function history(groupCount: number): LogEvent[] {
  return [1, 2, 3].flatMap((i) => dayTouching(groupCount, addDays(NOON, -i)));
}

describe('computePet', () => {
  it('starts new users neutral rather than sad', () => {
    const pet = computePet([], config(), NOON);
    expect(pet.mood).toBe('ok');
    expect(pet.message).toMatch(/New here/);
  });

  it('treats a log with no completions as new', () => {
    const events: LogEvent[] = [{ ts: NOON, type: 'skipped', activity: 'water' }];
    expect(computePet(events, config(), NOON).mood).toBe('ok');
  });

  it('thrives when the whole routine is kept up', () => {
    expect(computePet(history(4), config(), NOON).mood).toBe('thriving');
  });

  it('is ok on about half the routine', () => {
    expect(computePet(history(2), config(), NOON).mood).toBe('ok');
  });

  it('wilts when only one corner of the routine is touched', () => {
    expect(computePet(history(1), config(), NOON).mood).toBe('wilting');
  });

  it('is sad when the routine has been abandoned', () => {
    const events = dayTouching(4, addDays(NOON, -30));
    expect(computePet(events, config(), NOON).mood).toBe('sad');
  });

  it('never worsens because today is only half over', () => {
    // Three strong days, nothing yet today — still thriving.
    expect(computePet(history(4), config(), NOON).mood).toBe('thriving');
  });

  it('lets a good today lift the mood one step', () => {
    const withoutToday = computePet(history(1), config(), NOON);
    const withToday = computePet([...history(1), ...dayTouching(2, NOON)], config(), NOON);
    expect(withoutToday.mood).toBe('wilting');
    expect(withToday.mood).toBe('ok');
  });

  it('does not lift past thriving', () => {
    const events = [...history(4), ...dayTouching(4, NOON)];
    expect(computePet(events, config(), NOON).mood).toBe('thriving');
  });

  it('reports adherence as the fraction of the routine kept', () => {
    expect(computePet(history(4), config(), NOON).adherence).toBe(1);
    expect(computePet(history(2), config(), NOON).adherence).toBe(0.5);
    expect(computePet(dayTouching(4, addDays(NOON, -30)), config(), NOON).adherence).toBe(0);
  });

  it('agrees with the streak rule rather than scoring volume separately', () => {
    // Hammering one group all day is not the same as keeping the routine.
    const manyOfOne = [1, 2, 3].flatMap((i) =>
      Array.from({ length: 20 }, (_, n) => done('water', addDays(NOON, -i) + n)),
    );
    expect(computePet(manyOfOne, config(), NOON).mood).toBe('wilting');
  });

  it('ignores completions in groups the user has disabled', () => {
    // Posture is off in this config, so doing it cannot prop the pet up.
    const events = [1, 2, 3].flatMap((i) => [done('posture-check', addDays(NOON, -i))]);
    expect(computePet(events, config(), NOON).adherence).toBe(0);
  });

  it('does not punish you for days before you installed it', () => {
    // Regression: the trailing window scored the two days before first use as
    // zeros, so a good first day still produced a dying plant.
    const firstDay = dayTouching(3, NOON);
    const pet = computePet(firstDay, config(), NOON);
    expect(pet.mood).not.toBe('sad');
    expect(pet.mood).not.toBe('wilting');
  });

  it('still starts a first-day user neutral if they have barely done anything', () => {
    const pet = computePet(dayTouching(1, NOON), config(), NOON);
    expect(pet.mood).toBe('ok');
  });

  it('rewards a strong first day', () => {
    expect(computePet(dayTouching(4, NOON), config(), NOON).mood).toBe('thriving');
  });

  it('starts judging properly once there is history to judge', () => {
    // Used it well yesterday, nothing today — the window now has a real day in
    // it, so the score reflects that rather than being waived.
    const events = [...dayTouching(4, addDays(NOON, -1))];
    expect(computePet(events, config(), NOON).mood).toBe('thriving');

    const neglected = [...dayTouching(1, addDays(NOON, -1))];
    expect(computePet(neglected, config(), NOON).mood).toBe('wilting');
  });

  it('always carries a message', () => {
    for (const count of [1, 2, 4]) {
      expect(computePet(history(count), config(), NOON).message.length).toBeGreaterThan(0);
    }
  });
});
