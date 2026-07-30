/**
 * Reading and writing the user's routine.
 *
 * The loader is deliberately forgiving: a corrupt or partial config falls back
 * to defaults rather than crashing the companion, because this thing runs
 * unattended in a side pane where a stack trace would just sit there unread.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ACTIVITY_GROUPS, type ActivityGroup, type Config, type GroupConfig } from '../core/types.js';
import { DEFAULT_GROUP_CONFIG } from '../core/activities.js';
import { configPath } from './paths.js';

export function defaultConfig(): Config {
  return {
    version: 1,
    quietHours: { start: '22:00', end: '08:00' },
    groups: { ...DEFAULT_GROUP_CONFIG },
    activities: {},
    graceMinutes: 15,
    cooldownMinutes: 5,
    gamification: { enabled: true, pet: 'cactus' },
  };
}

/**
 * Merge whatever was on disk over the defaults.
 *
 * Unknown keys are dropped and missing ones filled in, so a config written by
 * an older version keeps working after an upgrade.
 */
export function normalizeConfig(raw: unknown): Config {
  const base = defaultConfig();
  if (typeof raw !== 'object' || raw === null) return base;

  const input = raw as Partial<Config>;

  const groups = {} as Record<ActivityGroup, GroupConfig>;
  for (const group of ACTIVITY_GROUPS) {
    const fallback = base.groups[group];
    const given = input.groups?.[group];
    groups[group] = {
      enabled: typeof given?.enabled === 'boolean' ? given.enabled : fallback.enabled,
      everyMinutes:
        isPositiveNumber(given?.everyMinutes) ? given.everyMinutes : fallback.everyMinutes,
      dailyGoal: isPositiveNumber(given?.dailyGoal) ? given.dailyGoal : fallback.dailyGoal,
    };
  }

  const activities: Record<string, boolean> = {};
  if (input.activities && typeof input.activities === 'object') {
    for (const [id, on] of Object.entries(input.activities)) {
      if (typeof on === 'boolean') activities[id] = on;
    }
  }

  return {
    version: 1,
    quietHours: normalizeQuietHours(input.quietHours, base.quietHours),
    groups,
    activities,
    graceMinutes: isNonNegativeNumber(input.graceMinutes) ? input.graceMinutes : base.graceMinutes,
    cooldownMinutes: isNonNegativeNumber(input.cooldownMinutes)
      ? input.cooldownMinutes
      : base.cooldownMinutes,
    gamification: {
      enabled:
        typeof input.gamification?.enabled === 'boolean'
          ? input.gamification.enabled
          : base.gamification.enabled,
      pet:
        typeof input.gamification?.pet === 'string' && input.gamification.pet.length > 0
          ? input.gamification.pet
          : base.gamification.pet,
    },
  };
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isNonNegativeNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function normalizeQuietHours(
  given: Config['quietHours'] | undefined,
  fallback: Config['quietHours'],
): Config['quietHours'] {
  if (given === null) return null; // explicitly disabled
  if (given === undefined) return fallback;
  if (isTimeString(given.start) && isTimeString(given.end)) {
    return { start: given.start, end: given.end };
  }
  return fallback;
}

export function isTimeString(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export function loadConfig(env?: NodeJS.ProcessEnv): Config {
  try {
    return normalizeConfig(JSON.parse(readFileSync(configPath(env), 'utf8')));
  } catch {
    // Missing, unreadable, or malformed — defaults keep the companion running.
    return defaultConfig();
  }
}

export function saveConfig(config: Config, env?: NodeJS.ProcessEnv): void {
  const path = configPath(env);
  mkdirSync(dirname(path), { recursive: true });

  // Write-then-rename so a crash mid-write can't leave a truncated config that
  // silently resets the user's routine on next start.
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

/** Whether a given activity is in its group's rotation pool. Default is in. */
export function isActivityEnabled(config: Config, activityId: string): boolean {
  return config.activities[activityId] !== false;
}

export function setActivityEnabled(config: Config, activityId: string, enabled: boolean): Config {
  return { ...config, activities: { ...config.activities, [activityId]: enabled } };
}

export function setGroupConfig(
  config: Config,
  group: ActivityGroup,
  patch: Partial<GroupConfig>,
): Config {
  return {
    ...config,
    groups: { ...config.groups, [group]: { ...config.groups[group], ...patch } },
  };
}
