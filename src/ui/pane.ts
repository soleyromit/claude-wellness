/**
 * How much room the companion actually has.
 *
 * Panes get resized constantly — split, unsplit, dragged narrower — and the
 * layout depends on both axes, so this is read live rather than sampled once
 * at startup.
 */

import { useEffect, useState } from 'react';
import { useStdout } from 'ink';
import type { PaneSize } from './theme.js';

/** What to assume when there is no TTY to ask, e.g. under a test runner. */
const FALLBACK: PaneSize = { columns: 80, rows: 24 };

export function usePaneSize(): PaneSize {
  const { stdout } = useStdout();

  const measure = (): PaneSize => ({
    columns: stdout?.columns ?? FALLBACK.columns,
    rows: stdout?.rows ?? FALLBACK.rows,
  });

  const [size, setSize] = useState<PaneSize>(measure);

  useEffect(() => {
    if (!stdout) return;
    const onResize = (): void => setSize(measure);
    stdout.on('resize', onResize);
    // The size can have changed between the first render and this effect.
    onResize();
    return () => {
      stdout.off('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stdout]);

  return size;
}

/**
 * The space inside a screen's own padding.
 *
 * A row is held back on top of that: a frame exactly as tall as the terminal
 * scrolls it by one line on every repaint, which shows up as a permanent
 * flicker in a pane that sits open all day.
 */
export function insetPane(pane: PaneSize, padding = 1): PaneSize {
  return {
    columns: Math.max(1, pane.columns - padding * 2),
    rows: Math.max(1, pane.rows - padding * 2 - 1),
  };
}
