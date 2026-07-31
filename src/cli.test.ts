import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The version appears in package.json and in the CLI's `--version` output.
 * Nothing forces them to agree at build time, and a stale `--version` is the
 * kind of thing nobody notices until a user reports a bug against the wrong
 * release. This is the cheapest possible guard.
 */
describe('version', () => {
  it('matches between package.json and the CLI', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    const cli = readFileSync(new URL('./cli.tsx', import.meta.url), 'utf8');
    const declared = /const VERSION = '([^']+)'/.exec(cli)?.[1];

    expect(declared).toBe(pkg.version);
  });
});
