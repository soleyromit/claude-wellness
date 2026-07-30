/**
 * Registering (and un-registering) the Claude Code hooks.
 *
 * This module edits a file the user owns and that other tools also write to,
 * so it is deliberately conservative:
 *
 *  - Install *appends* to existing hook arrays; it never replaces them.
 *  - Uninstall removes only entries whose command points inside our own hooks
 *    directory. Everything else in the file is preserved byte-for-byte where
 *    possible, including unrelated hooks from other tools.
 *  - Both operations are idempotent.
 *
 * The hooks themselves are plain `sh` scripts rather than Node entry points.
 * `UserPromptSubmit` runs on every single prompt, so paying ~40ms of Node
 * startup there would be a tax on the user's whole workflow; a shell script
 * costs low single-digit milliseconds.
 */

import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { claudeSettingsPath, dataDir, hooksDir, runDir } from '../store/paths.js';

/** Hook events we register against. */
export const BUSY_EVENT = 'UserPromptSubmit';
export const IDLE_EVENTS = ['Stop', 'SessionEnd'] as const;

/**
 * Every command we register carries this trailing shell comment, and it is the
 * sole thing uninstall matches on.
 *
 * The obvious alternative — matching the script path — silently fails the
 * moment the data directory moves, leaving orphaned hooks in the user's
 * settings with no way to find them. A comment is inert to `sh`, survives any
 * relocation, and makes the entry self-explanatory to anyone reading the file.
 */
export const HOOK_MARKER = '# claude-wellness';

/** The exact command string registered for a given hook script. */
export function hookCommand(scriptPath: string): string {
  return `"${scriptPath}" ${HOOK_MARKER}`;
}

export interface HookCommand {
  type: 'command';
  command: string;
  [key: string]: unknown;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookCommand[];
  [key: string]: unknown;
}

export interface ClaudeSettings {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
}

export function busyScriptPath(env?: NodeJS.ProcessEnv): string {
  return join(hooksDir(env), 'busy.sh');
}

export function idleScriptPath(env?: NodeJS.ProcessEnv): string {
  return join(hooksDir(env), 'idle.sh');
}

/**
 * The scripts live under the data directory, not inside node_modules, so the
 * path registered in settings.json stays valid across npm upgrades and
 * reinstalls. That stable path doubles as the uninstall marker.
 */
export function busyScript(env?: NodeJS.ProcessEnv): string {
  const run = runDir(env);
  return `#!/bin/sh
# claude-wellness: signals that Claude Code started working on a prompt.
# Kept dependency-free and Node-free — this runs on every prompt you submit.
mkdir -p '${run}' 2>/dev/null
date +%s > '${run}/busy' 2>/dev/null
exit 0
`;
}

export function idleScript(env?: NodeJS.ProcessEnv): string {
  const run = runDir(env);
  return `#!/bin/sh
# claude-wellness: signals that Claude Code finished.
rm -f '${run}/busy' 2>/dev/null
exit 0
`;
}

/** Write the two hook scripts, creating the directory tree as needed. */
export function writeHookScripts(env?: NodeJS.ProcessEnv): void {
  mkdirSync(hooksDir(env), { recursive: true });
  mkdirSync(runDir(env), { recursive: true });

  const busy = busyScriptPath(env);
  const idle = idleScriptPath(env);
  writeFileSync(busy, busyScript(env), 'utf8');
  writeFileSync(idle, idleScript(env), 'utf8');
  chmodSync(busy, 0o755);
  chmodSync(idle, 0o755);
}

export function readSettings(path: string): ClaudeSettings {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as ClaudeSettings;
    }
  } catch {
    // Missing or unreadable — treat as empty and let the caller write a fresh file.
  }
  return {};
}

export function writeSettings(path: string, settings: ClaudeSettings): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.claude-wellness.tmp`;
  writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

function isOurs(command: string): boolean {
  return command.includes(HOOK_MARKER);
}

/**
 * Add one command to an event's hook list, replacing any previous entry of
 * ours for that event so repeated `init` runs don't stack up duplicates.
 */
function addHook(settings: ClaudeSettings, event: string, command: string): ClaudeSettings {
  const hooks = { ...(settings.hooks ?? {}) };
  const existing = Array.isArray(hooks[event]) ? hooks[event] : [];

  // Drop our own prior entries for this event, keep everyone else's untouched.
  const preserved = existing
    .map((matcher) => ({
      ...matcher,
      hooks: (matcher.hooks ?? []).filter((h) => !isOurs(h.command ?? '')),
    }))
    .filter((matcher) => (matcher.hooks ?? []).length > 0);

  hooks[event] = [...preserved, { hooks: [{ type: 'command', command }] }];
  return { ...settings, hooks };
}

/** Register both hooks. Pure: takes settings in, returns new settings out. */
export function installHooks(settings: ClaudeSettings, env?: NodeJS.ProcessEnv): ClaudeSettings {
  let next = addHook(settings, BUSY_EVENT, hookCommand(busyScriptPath(env)));
  for (const event of IDLE_EVENTS) {
    next = addHook(next, event, hookCommand(idleScriptPath(env)));
  }
  return next;
}

/**
 * Remove every hook of ours, leaving all other hooks exactly as they were.
 *
 * Empty matchers and empty event arrays are pruned so we don't leave litter
 * behind, and the `hooks` key itself is dropped if we emptied it — but only if
 * it was empty, never if the user has other hooks.
 */
export function uninstallHooks(settings: ClaudeSettings): ClaudeSettings {
  if (!settings.hooks) return settings;

  const hooks: Record<string, HookMatcher[]> = {};

  for (const [event, matchers] of Object.entries(settings.hooks)) {
    if (!Array.isArray(matchers)) {
      hooks[event] = matchers;
      continue;
    }

    const kept = matchers
      .map((matcher) => {
        if (!Array.isArray(matcher?.hooks)) return matcher;
        return { ...matcher, hooks: matcher.hooks.filter((h) => !isOurs(h?.command ?? '')) };
      })
      .filter((matcher) => !Array.isArray(matcher?.hooks) || matcher.hooks.length > 0);

    if (kept.length > 0) hooks[event] = kept;
  }

  const next: ClaudeSettings = { ...settings };
  if (Object.keys(hooks).length > 0) {
    next.hooks = hooks;
  } else {
    delete next.hooks;
  }
  return next;
}

/** True if our hooks are currently registered for every event we need. */
export function hooksInstalled(settings: ClaudeSettings, env?: NodeJS.ProcessEnv): boolean {
  const busy = hookCommand(busyScriptPath(env));
  const idle = hookCommand(idleScriptPath(env));

  const hasCommand = (event: string, command: string): boolean =>
    (settings.hooks?.[event] ?? []).some((m) =>
      (m?.hooks ?? []).some((h) => h?.command === command),
    );

  return hasCommand(BUSY_EVENT, busy) && IDLE_EVENTS.every((e) => hasCommand(e, idle));
}

export interface InstallResult {
  readonly settingsPath: string;
  readonly alreadyInstalled: boolean;
}

/** Write the scripts and register the hooks on disk. */
export function install(env?: NodeJS.ProcessEnv): InstallResult {
  const path = claudeSettingsPath(env ?? process.env);
  const before = readSettings(path);
  const alreadyInstalled = hooksInstalled(before, env);

  writeHookScripts(env);
  writeSettings(path, installHooks(before, env));

  return { settingsPath: path, alreadyInstalled };
}

export interface UninstallResult {
  readonly settingsPath: string;
  readonly removed: boolean;
  readonly dataDir: string;
}

/** Remove the hooks from disk. Leaves the data directory alone. */
export function uninstall(env?: NodeJS.ProcessEnv): UninstallResult {
  const path = claudeSettingsPath(env ?? process.env);
  const before = readSettings(path);
  const after = uninstallHooks(before);
  const removed = JSON.stringify(before) !== JSON.stringify(after);

  if (removed) writeSettings(path, after);

  return { settingsPath: path, removed, dataDir: dataDir(env) };
}
