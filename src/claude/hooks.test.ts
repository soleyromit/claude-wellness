import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BUSY_EVENT,
  HOOK_MARKER,
  busyScriptPath,
  hookCommand,
  hooksInstalled,
  idleScriptPath,
  install,
  installHooks,
  readSettings,
  uninstall,
  uninstallHooks,
  writeHookScripts,
  type ClaudeSettings,
} from './hooks.js';

let home: string;
let settingsPath: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'wh-'));
  settingsPath = join(home, 'settings.json');
  env = {
    // Deliberately NOT named ".claude-wellness". Uninstall must find our hooks
    // by marker, not by guessing at the data directory's name — matching on the
    // path silently orphans hooks whenever the data directory moves.
    CLAUDE_WELLNESS_HOME: join(home, 'relocated-data'),
    CLAUDE_WELLNESS_SETTINGS: settingsPath,
  };
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

/**
 * A realistic settings file: the user's own Stop hook from claude-games,
 * plus unrelated top-level keys. This mirrors the real file this tool will be
 * pointed at, and is the regression case that matters most.
 */
function realisticSettings(): ClaudeSettings {
  return {
    permissions: { allow: ['Bash(gh auth:*)', 'Bash(npm --version)'] },
    model: 'opus[1m]',
    hooks: {
      Stop: [
        {
          hooks: [
            {
              type: 'command',
              command: '/Users/someone/Documents/GitHub/claude-games/hooks/claude-done.sh',
            },
          ],
        },
      ],
    },
    enabledPlugins: { 'superpowers@claude-plugins-official': true },
    theme: 'dark',
  };
}

describe('installHooks', () => {
  it('registers a busy hook and idle hooks', () => {
    const after = installHooks({}, env);
    expect(after.hooks?.[BUSY_EVENT]?.[0]?.hooks?.[0]?.command).toBe(
      hookCommand(busyScriptPath(env)),
    );
    expect(after.hooks?.['Stop']?.[0]?.hooks?.[0]?.command).toBe(
      hookCommand(idleScriptPath(env)),
    );
    expect(after.hooks?.['SessionEnd']?.[0]?.hooks?.[0]?.command).toBe(
      hookCommand(idleScriptPath(env)),
    );
  });

  it('tags every command with the marker so uninstall can find them', () => {
    const after = installHooks({}, env);
    const commands = Object.values(after.hooks!).flatMap((matchers) =>
      matchers.flatMap((m) => m.hooks.map((h) => h.command)),
    );
    expect(commands).toHaveLength(3);
    for (const command of commands) {
      expect(command).toContain(HOOK_MARKER);
    }
  });

  it('quotes the script path so a directory with spaces still works', () => {
    const spaced = {
      CLAUDE_WELLNESS_HOME: '/tmp/my data/wellness',
      CLAUDE_WELLNESS_SETTINGS: settingsPath,
    };
    const command = installHooks({}, spaced).hooks![BUSY_EVENT]![0]!.hooks[0]!.command;
    expect(command).toBe(`"/tmp/my data/wellness/hooks/busy.sh" ${HOOK_MARKER}`);
  });

  it('appends to an existing Stop hook instead of replacing it', () => {
    const after = installHooks(realisticSettings(), env);
    const stop = after.hooks!['Stop']!;

    expect(stop).toHaveLength(2);
    expect(stop[0]!.hooks[0]!.command).toContain('claude-games');
    expect(stop[1]!.hooks[0]!.command).toBe(hookCommand(idleScriptPath(env)));
  });

  it('leaves unrelated top-level settings untouched', () => {
    const before = realisticSettings();
    const after = installHooks(before, env);

    expect(after['permissions']).toEqual(before['permissions']);
    expect(after['model']).toBe('opus[1m]');
    expect(after['enabledPlugins']).toEqual(before['enabledPlugins']);
    expect(after['theme']).toBe('dark');
  });

  it('does not mutate the settings it was given', () => {
    const before = realisticSettings();
    const snapshot = JSON.stringify(before);
    installHooks(before, env);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('is idempotent — installing twice does not duplicate entries', () => {
    const once = installHooks(realisticSettings(), env);
    const twice = installHooks(once, env);
    expect(twice).toEqual(once);
    expect(twice.hooks!['Stop']).toHaveLength(2);
  });

  it('preserves other tools hooks on events we also use', () => {
    const settings: ClaudeSettings = {
      hooks: {
        UserPromptSubmit: [{ hooks: [{ type: 'command', command: '/other/tool.sh' }] }],
      },
    };
    const after = installHooks(settings, env);
    const commands = after.hooks![BUSY_EVENT]!.flatMap((m) => m.hooks.map((h) => h.command));
    expect(commands).toContain('/other/tool.sh');
    expect(commands).toContain(hookCommand(busyScriptPath(env)));
  });

  it('preserves matchers on events we do not touch', () => {
    const settings: ClaudeSettings = {
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/audit.sh' }] }],
      },
    };
    const after = installHooks(settings, env);
    expect(after.hooks!['PreToolUse']).toEqual(settings.hooks!['PreToolUse']);
  });
});

describe('uninstallHooks', () => {
  it('removes only our entries and keeps the claude-games hook', () => {
    const original = realisticSettings();
    const after = uninstallHooks(installHooks(original, env));

    expect(after.hooks!['Stop']).toHaveLength(1);
    expect(after.hooks!['Stop']![0]!.hooks[0]!.command).toContain('claude-games');
  });

  it('round-trips a realistic settings file back to exactly its original state', () => {
    const original = realisticSettings();
    const restored = uninstallHooks(installHooks(structuredClone(original), env));
    expect(restored).toEqual(original);
  });

  it('drops event keys that only contained our hooks', () => {
    const after = uninstallHooks(installHooks({}, env));
    expect(after.hooks).toBeUndefined();
  });

  it('removes the hooks key entirely when it becomes empty', () => {
    const after = uninstallHooks(installHooks({ model: 'opus' }, env));
    expect('hooks' in after).toBe(false);
    expect(after['model']).toBe('opus');
  });

  it('keeps the hooks key when other tools still have hooks', () => {
    const settings: ClaudeSettings = {
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/a.sh' }] }] },
    };
    const after = uninstallHooks(installHooks(settings, env));
    expect(after.hooks!['PreToolUse']).toEqual(settings.hooks!['PreToolUse']);
    expect(after.hooks![BUSY_EVENT]).toBeUndefined();
  });

  it('is a no-op on settings that never had our hooks', () => {
    const settings = realisticSettings();
    expect(uninstallHooks(structuredClone(settings))).toEqual(settings);
  });

  it('is a no-op when there are no hooks at all', () => {
    expect(uninstallHooks({ model: 'opus' })).toEqual({ model: 'opus' });
  });

  it('is idempotent', () => {
    const once = uninstallHooks(installHooks(realisticSettings(), env));
    expect(uninstallHooks(structuredClone(once))).toEqual(once);
  });

  it('survives malformed hook entries rather than throwing', () => {
    const settings = {
      hooks: {
        Stop: [{ hooks: [{ type: 'command' }] }, { noHooksKey: true }],
        Weird: 'not-an-array',
      },
    } as unknown as ClaudeSettings;
    expect(() => uninstallHooks(settings)).not.toThrow();
  });
});

describe('hooksInstalled', () => {
  it('is false on a fresh settings file', () => {
    expect(hooksInstalled({}, env)).toBe(false);
  });

  it('is true after install', () => {
    expect(hooksInstalled(installHooks({}, env), env)).toBe(true);
  });

  it('is false again after uninstall', () => {
    expect(hooksInstalled(uninstallHooks(installHooks({}, env)), env)).toBe(false);
  });

  it('is false if only some of the events are registered', () => {
    const partial = installHooks({}, env);
    delete partial.hooks!['SessionEnd'];
    expect(hooksInstalled(partial, env)).toBe(false);
  });
});

describe('writeHookScripts', () => {
  it('writes both scripts and makes them executable', () => {
    writeHookScripts(env);

    const busy = busyScriptPath(env);
    const idle = idleScriptPath(env);
    expect(existsSync(busy)).toBe(true);
    expect(existsSync(idle)).toBe(true);
    expect(statSync(busy).mode & 0o111).toBeTruthy();
    expect(statSync(idle).mode & 0o111).toBeTruthy();
  });

  it('writes shell scripts that invoke no Node, keeping prompt latency low', () => {
    writeHookScripts(env);
    const busy = readFileSync(busyScriptPath(env), 'utf8');
    expect(busy.startsWith('#!/bin/sh')).toBe(true);
    expect(busy).not.toContain('node');
  });

  it('places scripts under the data directory so npm upgrades cannot break the path', () => {
    expect(busyScriptPath(env)).toContain('relocated-data');
    expect(busyScriptPath(env)).not.toContain('node_modules');
    expect(idleScriptPath(env)).not.toContain('node_modules');
  });
});

describe('install and uninstall on disk', () => {
  it('creates a settings file when none exists', () => {
    const result = install(env);
    expect(result.alreadyInstalled).toBe(false);
    expect(hooksInstalled(readSettings(settingsPath), env)).toBe(true);
  });

  it('reports when hooks were already present', () => {
    install(env);
    expect(install(env).alreadyInstalled).toBe(true);
  });

  it('round-trips a real settings file on disk without losing anything', () => {
    const original = realisticSettings();
    writeFileSync(settingsPath, `${JSON.stringify(original, null, 2)}\n`, 'utf8');

    install(env);
    const installed = readSettings(settingsPath);
    expect(installed.hooks!['Stop']).toHaveLength(2);

    const result = uninstall(env);
    expect(result.removed).toBe(true);
    expect(readSettings(settingsPath)).toEqual(original);
  });

  it('leaves the claude-games Stop hook working throughout', () => {
    writeFileSync(settingsPath, JSON.stringify(realisticSettings()), 'utf8');

    const gamesHook = () =>
      (readSettings(settingsPath).hooks?.['Stop'] ?? [])
        .flatMap((m) => m.hooks.map((h) => h.command))
        .filter((c) => c.includes('claude-games'));

    expect(gamesHook()).toHaveLength(1);
    install(env);
    expect(gamesHook()).toHaveLength(1);
    uninstall(env);
    expect(gamesHook()).toHaveLength(1);
  });

  it('uninstalls from a data directory that is not named .claude-wellness', () => {
    // Regression: uninstall used to match on the path substring
    // ".claude-wellness/hooks/", so relocating the data directory left the
    // hooks permanently registered and unfindable.
    expect(busyScriptPath(env)).not.toContain('.claude-wellness');

    install(env);
    expect(hooksInstalled(readSettings(settingsPath), env)).toBe(true);

    const result = uninstall(env);
    expect(result.removed).toBe(true);
    expect(hooksInstalled(readSettings(settingsPath), env)).toBe(false);
    expect(readSettings(settingsPath).hooks).toBeUndefined();
  });

  it('reports nothing removed when we were never installed', () => {
    writeFileSync(settingsPath, JSON.stringify(realisticSettings()), 'utf8');
    expect(uninstall(env).removed).toBe(false);
  });

  it('leaves no temp file behind', () => {
    install(env);
    expect(existsSync(`${settingsPath}.claude-wellness.tmp`)).toBe(false);
  });

  it('does not delete the data directory on uninstall', () => {
    install(env);
    uninstall(env);
    expect(existsSync(busyScriptPath(env))).toBe(true);
  });

  it('recovers from a corrupt settings file rather than throwing', () => {
    writeFileSync(settingsPath, '{ broken json', 'utf8');
    expect(() => install(env)).not.toThrow();
    expect(hooksInstalled(readSettings(settingsPath), env)).toBe(true);
  });
});
