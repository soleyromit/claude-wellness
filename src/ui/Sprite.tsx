/**
 * Rendering a sprite inside Ink.
 *
 * The whole frame is composed into a single pre-coloured string and handed to
 * one `<Text>`. Letting Ink manage thousands of individual coloured cells would
 * be both slow and flickery; one string per frame repaints cleanly.
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { renderSprite, type Sprite as SpriteData } from '../render/pixel.js';
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
}

/**
 * 100ms is a deliberate choice: fast enough to read as motion, slow enough
 * that a full repaint of a 24x24 sprite never saturates a slow terminal.
 */
const DEFAULT_FRAME_MS = 500;

export function Sprite({ sprite, frame, frameMs = DEFAULT_FRAME_MS, paused }: SpriteProps): React.ReactElement {
  const [tick, setTick] = useState(0);
  const controlled = frame !== undefined;

  useEffect(() => {
    if (controlled || paused) return;
    const timer = setInterval(() => setTick((t) => t + 1), frameMs);
    return () => clearInterval(timer);
  }, [controlled, paused, frameMs]);

  const index = controlled ? frame : tick;
  const text = renderSprite(sprite, index, DEPTH);

  return (
    <Box flexDirection="column">
      {text.split('\n').map((line, i) => (
        // Sprite rows are positional, so the index is the correct key here.
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
}
