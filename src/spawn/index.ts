/**
 * Opening the companion in a second pane.
 *
 * Terminals have no common API for splitting, so each supported one gets a
 * small adapter. Detection is by environment variable because that's the only
 * signal available from inside a shell.
 *
 * The guiding rule: **never fail loudly**. If we can't split the window, we
 * print the command for the user to run themselves. A wellness tool that
 * errors out on launch is worse than one that asks for one extra keystroke.
 */

import { spawnSync } from 'node:child_process';

export interface SpawnAdapter {
  /** Stable id, also used by `wellness doctor`. */
  readonly id: string;
  /** Human-readable name for messages. */
  readonly label: string;
  /** Whether this adapter applies to the current environment. */
  detect(env: NodeJS.ProcessEnv): boolean;
  /** Argv to run. Returning null means "cannot split here". */
  command(command: string): { file: string; args: string[] } | null;
}

/** Percentage of the window the companion pane takes. */
const PANE_PERCENT = 32;

export const tmux: SpawnAdapter = {
  id: 'tmux',
  label: 'tmux',
  detect: (env) => Boolean(env['TMUX']),
  command: (command) => ({
    file: 'tmux',
    args: ['split-window', '-h', '-p', String(PANE_PERCENT), command],
  }),
};

export const wezterm: SpawnAdapter = {
  id: 'wezterm',
  label: 'WezTerm',
  detect: (env) => Boolean(env['WEZTERM_PANE']),
  command: (command) => ({
    file: 'wezterm',
    args: [
      'cli',
      'split-pane',
      '--right',
      '--percent',
      String(PANE_PERCENT),
      '--',
      'sh',
      '-c',
      command,
    ],
  }),
};

export const kitty: SpawnAdapter = {
  id: 'kitty',
  label: 'kitty',
  detect: (env) => Boolean(env['KITTY_LISTEN_ON']) || (env['TERM'] ?? '').includes('kitty'),
  command: (command) => ({
    file: 'kitty',
    args: ['@', 'launch', '--type=window', '--keep-focus', 'sh', '-c', command],
  }),
};

/**
 * iTerm2 has no CLI, so we drive it with AppleScript. `write text` runs the
 * command in the freshly created split.
 */
export const iterm: SpawnAdapter = {
  id: 'iterm2',
  label: 'iTerm2',
  detect: (env) => env['TERM_PROGRAM'] === 'iTerm.app',
  command: (command) => ({
    file: 'osascript',
    args: [
      '-e',
      `tell application "iTerm2"
         tell current session of current window
           set newSession to (split vertically with default profile)
         end tell
         tell newSession
           write text ${appleScriptString(command)}
         end tell
       end tell`,
    ],
  }),
};

/** Terminal.app can't split, so we settle for a new tab. */
export const appleTerminal: SpawnAdapter = {
  id: 'apple-terminal',
  label: 'Terminal.app',
  detect: (env) => env['TERM_PROGRAM'] === 'Apple_Terminal',
  command: (command) => ({
    file: 'osascript',
    args: [
      '-e',
      `tell application "Terminal"
         activate
         do script ${appleScriptString(command)}
       end tell`,
    ],
  }),
};

/** Escape a string for embedding in AppleScript source. */
export function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Checked in order — most specific and most capable first. */
export const ADAPTERS: readonly SpawnAdapter[] = [
  tmux,
  wezterm,
  kitty,
  iterm,
  appleTerminal,
];

export function detectAdapter(env: NodeJS.ProcessEnv = process.env): SpawnAdapter | null {
  return ADAPTERS.find((adapter) => adapter.detect(env)) ?? null;
}

/**
 * Advice for terminals we can't drive.
 *
 * Some terminals simply have no way to split from a command — VS Code's
 * integrated terminal is the common one, and it's where a lot of people run
 * Claude Code. "Unknown terminal" is true but useless; naming the shortcut is
 * the difference between a dead end and a working setup.
 */
export function manualSplitHint(env: NodeJS.ProcessEnv = process.env): string {
  const program = (env['TERM_PROGRAM'] ?? '').toLowerCase();

  if (program === 'vscode') {
    return 'VS Code cannot split its terminal from a command — press Ctrl+Shift+5, then run:';
  }
  if (program === 'ghostty') {
    return 'Ghostty has no split CLI — press Cmd+D, then run:';
  }
  if (program === 'hyper' || program === 'alacritty') {
    return 'Open a second window, then run:';
  }
  return 'Run this yourself in a second pane:';
}

export type SpawnOutcome =
  | { readonly ok: true; readonly adapter: SpawnAdapter }
  | { readonly ok: false; readonly reason: 'no-adapter' | 'failed'; readonly detail?: string };

export interface SpawnDeps {
  /** Injected for testing; defaults to actually running the command. */
  run?: (file: string, args: string[]) => { status: number | null; stderr: string };
}

function defaultRun(file: string, args: string[]): { status: number | null; stderr: string } {
  const result = spawnSync(file, args, { encoding: 'utf8', stdio: 'pipe' });
  return { status: result.error ? 1 : result.status, stderr: result.stderr ?? String(result.error ?? '') };
}

/**
 * Try to open `command` in a second pane.
 *
 * Callers are expected to fall back to printing the command themselves when
 * this returns `ok: false`.
 */
export function spawnPane(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
  deps: SpawnDeps = {},
): SpawnOutcome {
  const adapter = detectAdapter(env);
  if (!adapter) return { ok: false, reason: 'no-adapter' };

  const spec = adapter.command(command);
  if (!spec) return { ok: false, reason: 'no-adapter' };

  const run = deps.run ?? defaultRun;
  try {
    const { status, stderr } = run(spec.file, spec.args);
    if (status === 0) return { ok: true, adapter };
    return { ok: false, reason: 'failed', detail: stderr.trim() || `exit code ${status}` };
  } catch (error) {
    return { ok: false, reason: 'failed', detail: String(error) };
  }
}
