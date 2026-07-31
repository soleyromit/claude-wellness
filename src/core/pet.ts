/**
 * The pixel companion.
 *
 * The pet's mood mirrors your recent adherence: keep up the routine and it
 * thrives, ignore it for a few days and it visibly wilts. It's the retention
 * hook — an abstract streak counter is easy to ignore, a sad cactus isn't.
 *
 * Two deliberate fairness rules:
 *  - A brand-new user starts neutral, not sad. Being scolded before you've had
 *    a chance to do anything is a terrible first impression.
 *  - Today can only *improve* the mood, never worsen it. At 9am you've barely
 *    had the chance to hit your targets, and being punished for that would make
 *    the pet feel arbitrary.
 */

import { addDays, groupsTouchedOn } from './progress.js';
import { ACTIVITY_GROUPS, type Config, type LogEvent } from './types.js';

export type PetMood = 'thriving' | 'ok' | 'wilting' | 'sad';

/** Worst to best, so a mood can be nudged up an index. */
const MOOD_ORDER: readonly PetMood[] = ['sad', 'wilting', 'ok', 'thriving'];

/** How many complete days of history feed the mood. */
const HISTORY_DAYS = 3;

export interface PetState {
  readonly mood: PetMood;
  /** 0..1 adherence over the trailing complete days. */
  readonly adherence: number;
  readonly message: string;
}

/**
 * A day's score, measured the same way streaks are: how much of your routine
 * you touched, not how many units you racked up.
 *
 * These two must agree. A five-day streak sitting next to a dying plant reads
 * as a bug, and the user is right to think so — it means the app is scoring the
 * same behaviour two different ways.
 */
function ratioOn(events: readonly LogEvent[], config: Config, ts: number): number {
  const enabled = ACTIVITY_GROUPS.filter((g) => config.groups[g].enabled).length;
  if (enabled === 0) return 1;

  const touched = [...groupsTouchedOn(events, ts)].filter(
    (g) => config.groups[g].enabled,
  ).length;
  return Math.min(1, touched / enabled);
}

function moodFromAdherence(adherence: number): PetMood {
  if (adherence >= 0.75) return 'thriving';
  if (adherence >= 0.45) return 'ok';
  if (adherence >= 0.2) return 'wilting';
  return 'sad';
}

const MESSAGES: Readonly<Record<PetMood, string>> = {
  thriving: 'Thriving. Keep this up.',
  ok: 'Doing alright. A little more movement would help.',
  wilting: 'Wilting a bit. You have been sitting too long.',
  sad: 'Not doing great. Start with one cup of water.',
};

export function computePet(
  events: readonly LogEvent[],
  config: Config,
  now: number,
): PetState {
  const completions = events.filter((e) => e.type === 'completed');
  if (completions.length === 0) {
    return {
      mood: 'ok',
      adherence: 0,
      message: 'New here. Complete anything to get started.',
    };
  }

  // Only count days you actually had the app. Averaging over a fixed window
  // means the days before you installed it score zero, so someone who used it
  // properly on their first day is greeted by a dying plant — which is both
  // wrong and the fastest possible way to get the thing uninstalled.
  const firstDay = dayStart(Math.min(...completions.map((e) => e.ts)));

  const scored: number[] = [];
  for (let i = 1; i <= HISTORY_DAYS; i++) {
    const day = addDays(now, -i);
    if (dayStart(day) < firstDay) continue;
    scored.push(ratioOn(events, config, day));
  }

  const todayRatio = ratioOn(events, config, now);

  // Still on day one: judge today on its own rather than against days that
  // never existed.
  if (scored.length === 0) {
    const mood = moodFromAdherence(Math.max(todayRatio, 0.45));
    return { mood, adherence: todayRatio, message: MESSAGES[mood] };
  }

  const adherence = scored.reduce((a, b) => a + b, 0) / scored.length;
  let mood = moodFromAdherence(adherence);

  // Today pulls upward only.
  if (todayRatio >= 0.5) {
    const idx = MOOD_ORDER.indexOf(mood);
    mood = MOOD_ORDER[Math.min(idx + 1, MOOD_ORDER.length - 1)]!;
  }

  return { mood, adherence, message: MESSAGES[mood] };
}

/** Local midnight of the day containing `ts`. */
function dayStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
