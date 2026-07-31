/**
 * `wellness init`, `wellness uninstall` and `wellness doctor`.
 *
 * These are the commands that touch the user's machine, so each one reports
 * exactly what it did and where. `uninstall` in particular has to be trustworthy
 * — the promise that you can remove this cleanly is what makes it reasonable to
 * install in the first place.
 */

import { existsSync, rmSync } from 'node:fs';
import {
  busyScriptPath,
  hooksInstalled,
  idleScriptPath,
  install,
  readSettings,
  uninstall,
} from '../claude/hooks.js';
import { readClaudeState } from '../claude/signal.js';
import { detectColorDepth } from '../render/palette.js';
import { detectAdapter, manualSplitHint, spawnPane } from '../spawn/index.js';
import { claudeSettingsPath, dataDir } from '../store/paths.js';
import { loadConfig } from '../store/config.js';
import { ACTIVITY_GROUPS } from '../core/types.js';

/** The command a second pane should run. */
export const WATCH_COMMAND = 'wellness watch';

export interface InitOptions {
  readonly spawn?: boolean;
  readonly env?: NodeJS.ProcessEnv;
}

export function runInit(options: InitOptions = {}): string {
  const env = options.env ?? process.env;
  const lines: string[] = [];

  const result = install(env);
  lines.push('');
  lines.push('  claude-wellness');
  lines.push('');
  lines.push(
    result.alreadyInstalled
      ? '  ✓ Hooks already registered (refreshed)'
      : '  ✓ Hooks registered',
  );
  lines.push(`    ${result.settingsPath}`);
  lines.push(`    scripts in ${dataDir(env)}/hooks/`);
  lines.push('');

  if (options.spawn === false) {
    lines.push('  Start the companion in a second pane:');
    lines.push(`    ${WATCH_COMMAND}`);
    lines.push('');
    return lines.join('\n');
  }

  const outcome = spawnPane(WATCH_COMMAND, env);
  if (outcome.ok) {
    lines.push(`  ✓ Companion opened in a new ${outcome.adapter.label} pane`);
  } else {
    lines.push(
      outcome.reason === 'no-adapter'
        ? `  ! ${manualSplitHint(env)}`
        : `  ! Could not open a pane (${outcome.detail ?? 'unknown error'}). Run it yourself:`,
    );
    lines.push(`      ${WATCH_COMMAND}`);
  }

  lines.push('');
  lines.push('  Edit your routine with `wellness config`.');
  lines.push('  Remove everything with `wellness uninstall`.');
  lines.push('');
  return lines.join('\n');
}

export interface UninstallOptions {
  readonly purge?: boolean;
  readonly env?: NodeJS.ProcessEnv;
}

export function runUninstall(options: UninstallOptions = {}): string {
  const env = options.env ?? process.env;
  const lines: string[] = [];
  const result = uninstall(env);

  lines.push('');
  lines.push(
    result.removed
      ? '  ✓ Hooks removed from Claude Code'
      : '  · No claude-wellness hooks were registered',
  );
  lines.push(`    ${result.settingsPath}`);
  lines.push('    Other tools\' hooks were left untouched.');

  if (options.purge) {
    const dir = dataDir(env);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      lines.push(`  ✓ Deleted all data and history (${dir})`);
    }
  } else {
    lines.push('');
    lines.push(`  Your history is kept at ${dataDir(env)}`);
    lines.push('  Use `wellness uninstall --purge` to delete it too.');
  }

  lines.push('');
  lines.push('  Then remove the package with: npm rm -g claude-wellness');
  lines.push('');
  return lines.join('\n');
}

export function runDoctor(env: NodeJS.ProcessEnv = process.env, now = Date.now()): string {
  const lines: string[] = [];
  const settingsPath = claudeSettingsPath(env);
  const settings = readSettings(settingsPath);

  const check = (ok: boolean, label: string, detail?: string): void => {
    lines.push(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
  };

  lines.push('');
  lines.push('  claude-wellness doctor');
  lines.push('');

  check(existsSync(settingsPath), 'Claude Code settings found', settingsPath);
  check(hooksInstalled(settings, env), 'Hooks registered', hooksInstalled(settings, env) ? '' : 'run `wellness init`');
  check(existsSync(busyScriptPath(env)), 'busy hook script present');
  check(existsSync(idleScriptPath(env)), 'idle hook script present');

  const adapter = detectAdapter(env);
  check(
    adapter !== null,
    'Terminal supports auto-split',
    adapter ? adapter.label : manualSplitHint(env).replace(/:$/, ''),
  );

  const depth = detectColorDepth(env);
  check(
    depth === 24,
    `Colour depth: ${depth === 24 ? 'truecolor' : `${depth}-bit`}`,
    depth === 24 ? '' : 'art will be approximated',
  );

  const config = loadConfig(env);
  const enabled = ACTIVITY_GROUPS.filter((g) => config.groups[g].enabled);
  check(enabled.length > 0, `${enabled.length} activity groups enabled`, enabled.join(', '));

  lines.push('');
  lines.push(`  Claude is currently: ${readClaudeState(now, env)}`);
  lines.push(`  Data directory: ${dataDir(env)}`);
  lines.push('');
  return lines.join('\n');
}
