import { describe, expect, it } from 'vitest';
import {
  ADAPTERS,
  appleScriptString,
  appleTerminal,
  detectAdapter,
  iterm,
  kitty,
  spawnPane,
  tmux,
  wezterm,
} from './index.js';

describe('detectAdapter', () => {
  it('detects tmux', () => {
    expect(detectAdapter({ TMUX: '/tmp/tmux-501/default,123,0' })?.id).toBe('tmux');
  });

  it('detects WezTerm', () => {
    expect(detectAdapter({ WEZTERM_PANE: '0' })?.id).toBe('wezterm');
  });

  it('detects kitty by socket or TERM', () => {
    expect(detectAdapter({ KITTY_LISTEN_ON: 'unix:/tmp/k' })?.id).toBe('kitty');
    expect(detectAdapter({ TERM: 'xterm-kitty' })?.id).toBe('kitty');
  });

  it('detects iTerm2', () => {
    expect(detectAdapter({ TERM_PROGRAM: 'iTerm.app' })?.id).toBe('iterm2');
  });

  it('detects Terminal.app', () => {
    expect(detectAdapter({ TERM_PROGRAM: 'Apple_Terminal' })?.id).toBe('apple-terminal');
  });

  it('returns null in an unsupported terminal instead of guessing', () => {
    expect(detectAdapter({ TERM: 'xterm-256color' })).toBeNull();
    expect(detectAdapter({})).toBeNull();
  });

  it('prefers tmux when running inside tmux inside another terminal', () => {
    // This is the common case: tmux inside iTerm2. Splitting the tmux pane is
    // what the user means, not opening a new iTerm split around it.
    expect(detectAdapter({ TMUX: '/tmp/x', TERM_PROGRAM: 'iTerm.app' })?.id).toBe('tmux');
  });

  it('every adapter has a distinct id', () => {
    const ids = ADAPTERS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('adapter commands', () => {
  it('tmux splits horizontally at a fixed percentage', () => {
    const spec = tmux.command('wellness watch')!;
    expect(spec.file).toBe('tmux');
    expect(spec.args).toContain('split-window');
    expect(spec.args).toContain('wellness watch');
  });

  it('wezterm splits to the right', () => {
    const spec = wezterm.command('wellness watch')!;
    expect(spec.file).toBe('wezterm');
    expect(spec.args.slice(0, 3)).toEqual(['cli', 'split-pane', '--right']);
  });

  it('kitty launches a window without stealing focus', () => {
    const spec = kitty.command('wellness watch')!;
    expect(spec.file).toBe('kitty');
    expect(spec.args).toContain('--keep-focus');
  });

  it('iTerm2 drives AppleScript and splits vertically', () => {
    const spec = iterm.command('wellness watch')!;
    expect(spec.file).toBe('osascript');
    expect(spec.args[1]).toContain('split vertically');
    expect(spec.args[1]).toContain('wellness watch');
  });

  it('Terminal.app opens a new tab since it cannot split', () => {
    const spec = appleTerminal.command('wellness watch')!;
    expect(spec.file).toBe('osascript');
    expect(spec.args[1]).toContain('do script');
  });
});

describe('appleScriptString', () => {
  it('quotes a plain string', () => {
    expect(appleScriptString('wellness watch')).toBe('"wellness watch"');
  });

  it('escapes embedded quotes so a crafted path cannot break out of the script', () => {
    expect(appleScriptString('a"b')).toBe('"a\\"b"');
  });

  it('escapes backslashes', () => {
    expect(appleScriptString('a\\b')).toBe('"a\\\\b"');
  });
});

describe('spawnPane', () => {
  it('reports success when the adapter command succeeds', () => {
    const outcome = spawnPane('wellness watch', { TMUX: '/tmp/x' }, {
      run: () => ({ status: 0, stderr: '' }),
    });
    expect(outcome).toEqual({ ok: true, adapter: tmux });
  });

  it('reports no-adapter in an unsupported terminal rather than throwing', () => {
    const outcome = spawnPane('wellness watch', { TERM: 'xterm' }, {
      run: () => ({ status: 0, stderr: '' }),
    });
    expect(outcome).toEqual({ ok: false, reason: 'no-adapter' });
  });

  it('reports failure with detail when the command exits non-zero', () => {
    const outcome = spawnPane('wellness watch', { TMUX: '/tmp/x' }, {
      run: () => ({ status: 1, stderr: 'no server running' }),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('failed');
      expect(outcome.detail).toBe('no server running');
    }
  });

  it('never throws when the binary is missing', () => {
    const outcome = spawnPane('wellness watch', { TMUX: '/tmp/x' }, {
      run: () => {
        throw new Error('ENOENT');
      },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('failed');
  });

  it('falls back to an exit-code message when stderr is empty', () => {
    const outcome = spawnPane('wellness watch', { TMUX: '/tmp/x' }, {
      run: () => ({ status: 3, stderr: '' }),
    });
    if (!outcome.ok) expect(outcome.detail).toBe('exit code 3');
  });
});
