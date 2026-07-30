import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { busyFlagPath, runDir } from '../store/paths.js';
import { ClaudeSignal, STALE_AFTER_MS, readClaudeState, stateFromFlag } from './signal.js';

let home: string;
let env: NodeJS.ProcessEnv;
const NOW = new Date(2026, 6, 30, 14, 0, 0).getTime();

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'wellness-signal-'));
  env = { CLAUDE_WELLNESS_HOME: home };
  mkdirSync(runDir(env), { recursive: true });
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

/** Write a busy flag stamped `ageMs` in the past, the way busy.sh would. */
function writeBusyFlag(ageMs = 0): void {
  const seconds = Math.floor((NOW - ageMs) / 1000);
  writeFileSync(busyFlagPath(env), `${seconds}\n`, 'utf8');
}

describe('stateFromFlag', () => {
  it('is idle when the flag is absent', () => {
    expect(stateFromFlag(null, NOW)).toBe('idle');
  });

  it('is busy for a freshly written flag', () => {
    const contents = `${Math.floor(NOW / 1000)}`;
    expect(stateFromFlag({ mtimeMs: NOW, contents }, NOW)).toBe('busy');
  });

  it('goes idle once the flag is stale, so a killed session cannot wedge it', () => {
    const contents = `${Math.floor((NOW - STALE_AFTER_MS - 1000) / 1000)}`;
    expect(stateFromFlag({ mtimeMs: NOW, contents }, NOW)).toBe('idle');
  });

  it('trusts the written timestamp over mtime', () => {
    // mtime says "just now", contents say "ages ago" — contents win.
    const old = `${Math.floor((NOW - STALE_AFTER_MS - 5000) / 1000)}`;
    expect(stateFromFlag({ mtimeMs: NOW, contents: old }, NOW)).toBe('idle');
  });

  it('falls back to mtime when the contents are unusable', () => {
    expect(stateFromFlag({ mtimeMs: NOW, contents: 'garbage' }, NOW)).toBe('busy');
    expect(stateFromFlag({ mtimeMs: NOW, contents: '' }, NOW)).toBe('busy');
    expect(stateFromFlag({ mtimeMs: NOW - STALE_AFTER_MS - 1, contents: '' }, NOW)).toBe('idle');
  });

  it('honours a custom staleness window', () => {
    const contents = `${Math.floor((NOW - 5000) / 1000)}`;
    expect(stateFromFlag({ mtimeMs: NOW, contents }, NOW, 1000)).toBe('idle');
    expect(stateFromFlag({ mtimeMs: NOW, contents }, NOW, 60_000)).toBe('busy');
  });

  it('tolerates surrounding whitespace from the shell redirect', () => {
    const contents = `  ${Math.floor(NOW / 1000)}  \n`;
    expect(stateFromFlag({ mtimeMs: NOW, contents }, NOW)).toBe('busy');
  });
});

describe('readClaudeState', () => {
  it('is idle with no flag file', () => {
    expect(readClaudeState(NOW, env)).toBe('idle');
  });

  it('is busy when the flag is present and fresh', () => {
    writeBusyFlag();
    expect(readClaudeState(NOW, env)).toBe('busy');
  });

  it('is idle again once the flag is removed', () => {
    writeBusyFlag();
    unlinkSync(busyFlagPath(env));
    expect(readClaudeState(NOW, env)).toBe('idle');
  });

  it('is idle when the run directory does not exist at all', () => {
    rmSync(runDir(env), { recursive: true, force: true });
    expect(readClaudeState(NOW, env)).toBe('idle');
  });
});

describe('ClaudeSignal', () => {
  it('starts idle', () => {
    const signal = new ClaudeSignal(env);
    expect(signal.current).toBe('idle');
  });

  it('picks up a busy flag on refresh', () => {
    const signal = new ClaudeSignal(env);
    writeBusyFlag();
    expect(signal.refresh(NOW)).toBe('busy');
    expect(signal.current).toBe('busy');
  });

  it('notifies subscribers on transition', () => {
    const signal = new ClaudeSignal(env);
    const seen: string[] = [];
    signal.subscribe((s) => seen.push(s));

    writeBusyFlag();
    signal.refresh(NOW);
    unlinkSync(busyFlagPath(env));
    signal.refresh(NOW);

    expect(seen).toEqual(['busy', 'idle']);
  });

  it('does not re-notify when the state is unchanged', () => {
    const signal = new ClaudeSignal(env);
    const seen: string[] = [];
    signal.subscribe((s) => seen.push(s));

    writeBusyFlag();
    signal.refresh(NOW);
    signal.refresh(NOW);
    signal.refresh(NOW);

    expect(seen).toEqual(['busy']);
  });

  it('stops notifying after unsubscribe', () => {
    const signal = new ClaudeSignal(env);
    const seen: string[] = [];
    const unsubscribe = signal.subscribe((s) => seen.push(s));

    unsubscribe();
    writeBusyFlag();
    signal.refresh(NOW);

    expect(seen).toEqual([]);
  });

  it('creates the run directory on start so watching can attach', () => {
    rmSync(runDir(env), { recursive: true, force: true });
    const signal = new ClaudeSignal(env);
    signal.start();
    expect(signal.current).toBe('idle');
    signal.stop();
  });

  it('can be started and stopped without leaking handles', () => {
    const signal = new ClaudeSignal(env);
    signal.start();
    signal.start(); // second start is a no-op
    signal.stop();
    signal.stop(); // second stop is safe
    expect(signal.current).toBe('idle');
  });
});
