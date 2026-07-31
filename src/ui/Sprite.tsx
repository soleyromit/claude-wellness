/**
 * Rendering a sprite inside Ink.
 *
 * The whole frame is composed into a single pre-coloured string and handed to
 * one `<Text>`. Letting Ink manage thousands of individual coloured cells would
 * be both slow and flickery; one string per frame repaints cleanly.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { fitToBox, renderSprite, type Sprite as SpriteData } from '../render/pixel.js';
import { detectColorDepth } from '../render/palette.js';

const DEPTH = detectColorDepth();

export interface SpriteProps {
  readonly sprite: SpriteData;
  /** Frame to show. Omit to animate automatically. */
  readonly frame?: number;
  /** Milliseconds per frame when animating. */
  readonly frameMs?: number;
  /** Pause the animation without unmounting. */
  readonly paused?: boolean;
  /**
   * Terminal rows and columns the art may occupy. It is scaled down to fit
   * both; art that already fits is left alone.
   */
  readonly maxRows?: number;
  readonly maxColumns?: number;
}

/**
 * 100ms is a deliberate choice: fast enough to read as motion, slow enough
 * that a full repaint of a 24x24 sprite never saturates a slow terminal.
 */
const DEFAULT_FRAME_MS = 500;

export function Sprite({
  sprite,
  frame,
  frameMs = DEFAULT_FRAME_MS,
  paused,
  maxRows,
  maxColumns,
}: SpriteProps): React.ReactElement {
  const [tick, setTick] = useState(0);
  const controlled = frame !== undefined;
  const shown = useMemo(
    () =>
      maxRows === undefined && maxColumns === undefined
        ? sprite
        : fitToBox(sprite, maxRows, maxColumns),
    [sprite, maxRows, maxColumns],
  );

  useEffect(() => {
    if (controlled || paused) return;
    const timer = setInterval(() => setTick((t) => t + 1), frameMs);
    return () => clearInterval(timer);
  }, [controlled, paused, frameMs]);

  const index = controlled ? frame : tick;
  const text = renderSprite(shown, index, DEPTH);

  return (
    <Box flexDirection="column">
      {text.split('\n').map((line, i) => (
        // Sprite rows are positional, so the index is the correct key here.
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
}
