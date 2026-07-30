/**
 * Watching for "Claude is thinking".
 *
 * The hooks drop a `busy` file when a prompt starts and delete it when Claude
 * stops. This module turns that file into a state the UI can subscribe to.
 *
 * Two robustness details:
 *
 *  - `fs.watch` is unreliable across platforms and filesystems (network mounts,
 *    some Docker volumes), so a slow poll backs it up. Missing a transition is
 *    worse than an occasional redundant check.
 *  - A stale flag is treated as idle. If a Claude session is killed hard, its
 *    `Stop` hook never runs and the flag would otherwise stick "busy" forever,
 *    which would suppress the grace-period escape hatch and quietly stop all
 *    reminders.
 */

import { readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { mkdirSync } from 'node:fs';
import type { ClaudeState } from '../core/types.js';
import { busyFlagPath, runDir } from '../store/paths.js';

/** How long a busy flag can sit untouched before we stop believing it. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

const POLL_INTERVAL_MS = 1000;

/** Decide the state from the flag's contents and age. Pure, so it's testable. */
export function stateFromFlag(
  flag: { mtimeMs: number; contents: string } | null,
  now: number,
  staleAfterMs = STALE_AFTER_MS,
): ClaudeState {
  if (!flag) return 'idle';

  // The script writes a unix timestamp; prefer it over mtime because it
  // survives filesystems with coarse mtime granularity.
  const written = Number.parseInt(flag.contents.trim(), 10);
  const stamp = Number.isFinite(written) && written > 0 ? written * 1000 : flag.mtimeMs;

  return now - stamp > staleAfterMs ? 'idle' : 'busy';
}

export function readClaudeState(now: number, env?: NodeJS.ProcessEnv): ClaudeState {
  const path = busyFlagPath(env);
  try {
    const stat = statSync(path);
    return stateFromFlag({ mtimeMs: stat.mtimeMs, contents: readFileSync(path, 'utf8') }, now);
  } catch {
    return 'idle'; // absent flag means not busy
  }
}

export type StateListener = (state: ClaudeState) => void;

/**
 * Watches the run directory and reports transitions.
 *
 * Only *changes* are emitted, so subscribers don't need to dedupe.
 */
export class ClaudeSignal {
  private state: ClaudeState = 'idle';
  private watcher: FSWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly listeners = new Set<StateListener>();
  private readonly env: NodeJS.ProcessEnv | undefined;

  constructor(env?: NodeJS.ProcessEnv) {
    this.env = env;
  }

  get current(): ClaudeState {
    return this.state;
  }

  start(): void {
    if (this.timer) return;

    const dir = runDir(this.env);
    // The directory may not exist yet if the companion starts before the first
    // prompt; create it so fs.watch has something to attach to.
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Non-fatal: polling still works once the hooks create it.
    }

    this.refresh();

    try {
      this.watcher = watch(dir, () => this.refresh());
    } catch {
      // Platform doesn't support watching here — the poll below covers us.
    }

    this.timer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
    // Don't hold the process open on this timer alone.
    this.timer.unref?.();
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  /** Subscribe to transitions. Returns an unsubscribe function. */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Re-read the flag and notify if the state changed. */
  refresh(now = Date.now()): ClaudeState {
    const next = readClaudeState(now, this.env);
    if (next !== this.state) {
      this.state = next;
      for (const listener of this.listeners) listener(next);
    }
    return next;
  }
}
