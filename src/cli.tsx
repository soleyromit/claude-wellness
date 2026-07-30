#!/usr/bin/env node
/**
 * Command dispatch.
 *
 * Argument parsing is hand-rolled: the surface is six subcommands and two
 * flags, and a dependency-free CLI keeps install fast and the tree small.
 */

import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { ConfigEditor } from './ui/ConfigEditor.js';
import { runDoctor, runInit, runUninstall } from './commands/setup.js';
import { renderStats } from './commands/stats.js';

const HELP = `
  claude-wellness — stretch, hydrate and move while Claude works

  Usage
    wellness [command] [options]

  Commands
    watch            Run the companion (default)
    init             Register the Claude Code hooks and open a pane
    config           Edit your routine — add or remove activities
    stats            Streaks, level and the last two weeks
    doctor           Check the setup and report what's wrong
    uninstall        Remove the hooks from Claude Code

  Options
    --no-spawn       With init: don't try to open a pane
    --purge          With uninstall: also delete your history
    -h, --help       Show this
    -v, --version    Show the version

  Getting started
    wellness init

  Then keep the companion pane open beside Claude Code. When Claude starts
  working on a prompt, anything due surfaces there instead of interrupting you.
`;

const VERSION = '0.1.0';

export function run(argv: readonly string[] = process.argv.slice(2)): void {
  const args = [...argv];
  const flags = new Set(args.filter((a) => a.startsWith('-')));
  const command = args.find((a) => !a.startsWith('-')) ?? 'watch';

  if (flags.has('-h') || flags.has('--help') || command === 'help') {
    process.stdout.write(HELP);
    return;
  }
  if (flags.has('-v') || flags.has('--version') || command === 'version') {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  switch (command) {
    case 'watch':
      render(<App />);
      return;

    case 'config':
      render(<ConfigEditor />);
      return;

    case 'init':
      process.stdout.write(runInit({ spawn: !flags.has('--no-spawn') }));
      return;

    case 'uninstall':
      process.stdout.write(runUninstall({ purge: flags.has('--purge') }));
      return;

    case 'doctor':
      process.stdout.write(runDoctor());
      return;

    case 'stats':
      process.stdout.write(renderStats());
      return;

    default:
      process.stderr.write(`\n  Unknown command: ${command}\n${HELP}`);
      process.exitCode = 1;
  }
}

run();
