/**
 * Getting noticed without being obnoxious.
 *
 * The companion lives in a narrow side pane while your eyes are on the Claude
 * pane, so silently swapping its contents doesn't register. These are the two
 * cheapest signals that actually work:
 *
 *  - **The bell.** One control character. Terminals turn it into a tab flash, a
 *    dock bounce, or a soft sound depending on the user's own settings — which
 *    is the right place for that decision to live, not here.
 *  - **The tab title.** Survives the pane being narrow, scrolled, or in a
 *    background tab, because it renders in the tab bar rather than the pane.
 *
 * Both are plain ANSI, so there is no dependency, no permission prompt and
 * nothing platform-specific. Everything here is a pure string plus one write,
 * so the escape sequences can be asserted in tests without a terminal.
 */

/** ASCII BEL. */
export const BELL = String.fromCharCode(0x07);

/** ASCII ESC. */
export const ESC = String.fromCharCode(0x1b);

/** OSC 0: set both the window and tab title. */
export function titleSequence(title: string): string {
  // Strip control characters — an activity title is trusted, but a title
  // containing an escape could otherwise break out of the sequence.
  const safe = title.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 60);
  return `${ESC}]0;${safe}${BELL}`;
}

export interface AttentionOptions {
  readonly bell?: boolean;
  readonly title?: boolean;
}

/**
 * Build the escape sequence announcing a nudge. Returns an empty string when
 * both signals are disabled, so callers can skip the write entirely.
 */
export function nudgeSequence(
  activityTitle: string,
  options: AttentionOptions = {},
): string {
  const { bell = true, title = true } = options;
  let out = '';
  if (title) out += titleSequence(`▶ ${activityTitle}`);
  // Bell last, so the title is already set when the terminal flashes the tab.
  if (bell) out += BELL;
  return out;
}

/** Restore the idle title once the nudge is resolved. */
export function idleSequence(options: AttentionOptions = {}): string {
  return options.title === false ? '' : titleSequence('wellness');
}

/**
 * Write a sequence to the terminal.
 *
 * Split from the sequence builders so the interesting logic stays pure; this
 * is the only part that touches a stream.
 */
export function emit(sequence: string, stream: NodeJS.WriteStream | undefined = process.stdout): void {
  if (!sequence || !stream) return;
  // Never write escapes into a pipe or a file — they would be captured as
  // literal junk by anything redirecting the companion's output.
  if (!stream.isTTY) return;
  stream.write(sequence);
}
