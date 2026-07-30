import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  defaultConfig,
  isActivityEnabled,
  isTimeString,
  loadConfig,
  normalizeConfig,
  saveConfig,
  setActivityEnabled,
  setGroupConfig,
} from './config.js';
import { appendEvent, loadLog, parseLog } from './log.js';
import { configPath, dataDir, logPath } from './paths.js';

let home: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'wellness-test-'));
  env = { CLAUDE_WELLNESS_HOME: home };
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('paths', () => {
  it('respects the home override so tests never touch the real ~', () => {
    expect(dataDir(env)).toBe(home);
    expect(configPath(env)).toBe(join(home, 'config.json'));
    expect(logPath(env)).toBe(join(home, 'log.jsonl'));
  });
});

describe('normalizeConfig', () => {
  it('returns defaults for junk input', () => {
    expect(normalizeConfig(null)).toEqual(defaultConfig());
    expect(normalizeConfig('nonsense')).toEqual(defaultConfig());
    expect(normalizeConfig(42)).toEqual(defaultConfig());
  });

  it('fills in groups missing from an older config', () => {
    const partial = { version: 1, groups: { hydration: { enabled: false, everyMinutes: 10, dailyGoal: 2 } } };
    const config = normalizeConfig(partial);
    expect(config.groups.hydration).toEqual({ enabled: false, everyMinutes: 10, dailyGoal: 2 });
    // Untouched groups keep their defaults rather than vanishing.
    expect(config.groups.stretch).toEqual(defaultConfig().groups.stretch);
  });

  it('rejects invalid intervals instead of scheduling every zero minutes', () => {
    const config = normalizeConfig({
      groups: { hydration: { enabled: true, everyMinutes: 0, dailyGoal: -3 } },
    });
    expect(config.groups.hydration.everyMinutes).toBe(defaultConfig().groups.hydration.everyMinutes);
    expect(config.groups.hydration.dailyGoal).toBe(defaultConfig().groups.hydration.dailyGoal);
  });

  it('keeps explicit null quiet hours as disabled', () => {
    expect(normalizeConfig({ quietHours: null }).quietHours).toBeNull();
  });

  it('falls back on malformed quiet hours', () => {
    expect(normalizeConfig({ quietHours: { start: '25:00', end: 'x' } }).quietHours).toEqual(
      defaultConfig().quietHours,
    );
  });

  it('keeps valid quiet hours', () => {
    expect(normalizeConfig({ quietHours: { start: '23:30', end: '07:15' } }).quietHours).toEqual({
      start: '23:30',
      end: '07:15',
    });
  });

  it('drops non-boolean activity pool entries', () => {
    const config = normalizeConfig({ activities: { water: false, bogus: 'yes' } });
    expect(config.activities).toEqual({ water: false });
  });
});

describe('isTimeString', () => {
  it('accepts 24-hour times', () => {
    expect(isTimeString('00:00')).toBe(true);
    expect(isTimeString('23:59')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isTimeString('24:00')).toBe(false);
    expect(isTimeString('9:00')).toBe(false);
    expect(isTimeString('12:60')).toBe(false);
    expect(isTimeString(900)).toBe(false);
  });
});

describe('config round-trip', () => {
  it('returns defaults when nothing has been saved', () => {
    expect(loadConfig(env)).toEqual(defaultConfig());
  });

  it('saves and reloads a config unchanged', () => {
    const config = setGroupConfig(defaultConfig(), 'stretch', { everyMinutes: 42 });
    saveConfig(config, env);
    expect(loadConfig(env)).toEqual(config);
  });

  it('creates the data directory if it does not exist', () => {
    saveConfig(defaultConfig(), env);
    expect(readFileSync(configPath(env), 'utf8')).toContain('"version": 1');
  });

  it('falls back to defaults rather than crashing on a corrupt file', () => {
    mkdirSync(home, { recursive: true });
    writeFileSync(configPath(env), '{ this is not json', 'utf8');
    expect(loadConfig(env)).toEqual(defaultConfig());
  });

  it('leaves no temp file behind', () => {
    saveConfig(defaultConfig(), env);
    expect(() => readFileSync(`${configPath(env)}.tmp`, 'utf8')).toThrow();
  });
});

describe('activity pool helpers', () => {
  it('treats unlisted activities as enabled so upgrades add them automatically', () => {
    expect(isActivityEnabled(defaultConfig(), 'brand-new-activity')).toBe(true);
  });

  it('honours an explicit opt-out', () => {
    const config = setActivityEnabled(defaultConfig(), 'stretch-wrists', false);
    expect(isActivityEnabled(config, 'stretch-wrists')).toBe(false);
  });

  it('can re-enable', () => {
    let config = setActivityEnabled(defaultConfig(), 'stretch-wrists', false);
    config = setActivityEnabled(config, 'stretch-wrists', true);
    expect(isActivityEnabled(config, 'stretch-wrists')).toBe(true);
  });

  it('does not mutate the input config', () => {
    const original = defaultConfig();
    setActivityEnabled(original, 'water', false);
    setGroupConfig(original, 'hydration', { everyMinutes: 1 });
    expect(original).toEqual(defaultConfig());
  });
});

describe('parseLog', () => {
  it('parses one event per line', () => {
    const contents = ['{"ts":1,"type":"completed","activity":"water"}', '{"ts":2,"type":"skipped","activity":"eyes-blink"}'].join('\n');
    expect(parseLog(contents)).toHaveLength(2);
  });

  it('ignores blank lines', () => {
    expect(parseLog('\n\n{"ts":1,"type":"completed","activity":"water"}\n\n')).toHaveLength(1);
  });

  it('skips a truncated final line rather than throwing', () => {
    const contents = '{"ts":1,"type":"completed","activity":"water"}\n{"ts":2,"type":"comp';
    expect(parseLog(contents)).toHaveLength(1);
  });

  it('rejects structurally invalid events', () => {
    const contents = [
      '{"ts":"nope","type":"completed","activity":"water"}',
      '{"ts":1,"type":"invented","activity":"water"}',
      '{"ts":1,"type":"completed"}',
      'null',
      '[]',
    ].join('\n');
    expect(parseLog(contents)).toHaveLength(0);
  });

  it('preserves meta', () => {
    const [event] = parseLog('{"ts":1,"type":"completed","activity":"water","meta":{"count":3}}');
    expect(event!.meta).toEqual({ count: 3 });
  });
});

describe('log round-trip', () => {
  it('is empty when nothing has been logged', () => {
    expect(loadLog(env)).toEqual([]);
  });

  it('appends events in order and reads them back', () => {
    appendEvent({ ts: 1, type: 'completed', activity: 'water' }, env);
    appendEvent({ ts: 2, type: 'completed', activity: 'stretch-wrists' }, env);

    const events = loadLog(env);
    expect(events).toHaveLength(2);
    expect(events[0]!.activity).toBe('water');
    expect(events[1]!.activity).toBe('stretch-wrists');
  });

  it('never rewrites history, only appends', () => {
    appendEvent({ ts: 1, type: 'completed', activity: 'water' }, env);
    const first = readFileSync(logPath(env), 'utf8');
    appendEvent({ ts: 2, type: 'completed', activity: 'water' }, env);
    expect(readFileSync(logPath(env), 'utf8').startsWith(first)).toBe(true);
  });

  it('creates the data directory on first append', () => {
    appendEvent({ ts: 1, type: 'completed', activity: 'water' }, env);
    expect(loadLog(env)).toHaveLength(1);
  });
});
