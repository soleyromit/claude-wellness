/**
 * The reminder card.
 *
 * This is the one screen allowed to be eye-catching: it appears in dead time,
 * so it should be noticeable. Every option is one keypress, and dismissing is
 * always available — a reminder you can't get rid of gets the whole tool
 * uninstalled.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { Activity } from '../core/types.js';
import { getSprite } from '../sprites/index.js';
import { Sprite } from './Sprite.js';
import {
  COLORS,
  GROUP_COLORS,
  MIN_ART_ROWS,
  artRowsFor,
  textRows,
  type PaneSize,
  type Tier,
} from './theme.js';

export interface NudgeProps {
  readonly activity: Activity;
  readonly overdueMinutes: number;
  readonly tier: Tier;
  /** Cups logged today, shown when the activity is a hydration one. */
  readonly instantProgress?: { done: number; goal: number };
  /** The space available. Omit for an unbounded pane. */
  readonly pane?: PaneSize;
}

/** Tab opens the menu — the one place you browse what else there is. */
const SWAP = '[tab] something else';

export function Nudge({
  activity,
  tier,
  instantProgress,
  pane,
}: NudgeProps): React.ReactElement {
  const color = GROUP_COLORS[activity.group];

  const columns = pane?.columns ?? Number.POSITIVE_INFINITY;
  const keys = activity.instant
    ? '[space] log it   [s] snooze   [d] not today'
    : '[enter] start   [s] snooze   [d] not today';

  // The card without its picture. What is left over is the picture's.
  const chrome =
    textRows(`▶ ${activity.title}`, columns) +
    1 + // gap above the art
    1 +
    textRows(activity.cue, columns) +
    (instantProgress ? 2 : 0) +
    1 +
    textRows(keys, columns) +
    textRows(SWAP, columns);

  const artRows = artRowsFor(pane, chrome);
  const showArt = tier !== 'minimal' && artRows >= MIN_ART_ROWS;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={color}>
          ▶ {activity.title}
        </Text>
      </Box>

      {showArt && (
        <Box marginTop={1} alignItems="center" flexDirection="column">
          <Sprite sprite={getSprite(activity.sprite)} maxRows={artRows} />
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={COLORS.dim} wrap="wrap">
          {activity.cue}
        </Text>
      </Box>

      {instantProgress && (
        <Box marginTop={1}>
          <Text color={COLORS.water}>
            {'●'.repeat(Math.min(instantProgress.done, instantProgress.goal))}
            <Text color={COLORS.faint}>
              {'○'.repeat(Math.max(0, instantProgress.goal - instantProgress.done))}
            </Text>
          </Text>
          <Text color={COLORS.dim}>
            {' '}
            {instantProgress.done}/{instantProgress.goal}
          </Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color={COLORS.faint} wrap="wrap">
          {keys}
        </Text>
        <Text color={COLORS.faint} wrap="wrap">
          {SWAP}
        </Text>
      </Box>
    </Box>
  );
}
