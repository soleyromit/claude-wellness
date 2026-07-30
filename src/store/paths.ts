/**
 * Every path the app touches, in one place.
 *
 * The data directory is overridable via `CLAUDE_WELLNESS_HOME` so tests can run
 * against a temp directory without going anywhere near the real `~`.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  return env['CLAUDE_WELLNESS_HOME'] ?? join(homedir(), '.claude-wellness');
}

export function configPath(env?: NodeJS.ProcessEnv): string {
  return join(dataDir(env), 'config.json');
}

export function logPath(env?: NodeJS.ProcessEnv): string {
  return join(dataDir(env), 'log.jsonl');
}

/** Directory holding the shell scripts the Claude Code hooks invoke. */
export function hooksDir(env?: NodeJS.ProcessEnv): string {
  return join(dataDir(env), 'hooks');
}

/** Runtime signal directory: the busy flag lives here. */
export function runDir(env?: NodeJS.ProcessEnv): string {
  return join(dataDir(env), 'run');
}

/** Present (and recent) means Claude Code is working on a prompt. */
export function busyFlagPath(env?: NodeJS.ProcessEnv): string {
  return join(runDir(env), 'busy');
}

/** Claude Code's own settings file, where we register the hooks. */
export function claudeSettingsPath(env: NodeJS.ProcessEnv = process.env): string {
  return env['CLAUDE_WELLNESS_SETTINGS'] ?? join(homedir(), '.claude', 'settings.json');
}
