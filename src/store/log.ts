/**
 * The append-only event log.
 *
 * Every completion, skip and snooze is one line of JSON. Streaks, XP, rings,
 * the heatmap and the pet's mood are all *derived* from this file — nothing is
 * stored denormalised, so those numbers cannot drift out of sync with reality.
 *
 * Append-only also means concurrent writers (several Claude sessions, or the
 * companion plus a CLI command) can't clobber each other's history.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LogEvent, LogEventType } from '../core/types.js';
import { logPath } from './paths.js';

/** Parse JSONL, skipping any line that isn't a well-formed event. */
export function parseLog(contents: string): LogEvent[] {
  const events: LogEvent[] = [];
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isLogEvent(parsed)) events.push(parsed);
    } catch {
      // A partially-written final line is expected if we read mid-append.
      // Dropping it is correct; the next append will still be valid.
    }
  }
  return events;
}

function isLogEvent(v: unknown): v is LogEvent {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Partial<LogEvent>;
  return (
    typeof e.ts === 'number' &&
    Number.isFinite(e.ts) &&
    typeof e.activity === 'string' &&
    isEventType(e.type)
  );
}

function isEventType(v: unknown): v is LogEventType {
  return v === 'shown' || v === 'completed' || v === 'skipped' || v === 'snoozed';
}

export function loadLog(env?: NodeJS.ProcessEnv): LogEvent[] {
  try {
    return parseLog(readFileSync(logPath(env), 'utf8'));
  } catch {
    return [];
  }
}

export function appendEvent(event: LogEvent, env?: NodeJS.ProcessEnv): void {
  const path = logPath(env);
  mkdirSync(dirname(path), { recursive: true });
  // A single write of one line under the pipe-buffer size is atomic enough in
  // practice for the append-only case, and avoids needing a lock file.
  appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf8');
}
