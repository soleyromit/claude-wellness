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
import { COLORS, GROUP_COLORS, type Tier } from './theme.js';

export interface NudgeProps {
  readonly activity: Activity;
  readonly overdueMinutes: number;
  readonly tier: Tier;
  /** Cups logged today, shown when the activity is a hydration one. */
  readonly instantProgress?: { done: number; goal: number };
  /** How many activities you can Tab between, and where you are in them. */
  readonly alternativeCount?: number;
  readonly alternativeIndex?: number;
}

export function Nudge({
  activity,
  tier,
  instantProgress,
  alternativeCount = 1,
  alternativeIndex = 0,
}: NudgeProps): React.ReactElement {
  const color = GROUP_COLORS[activity.group];
  const canSwap = alternativeCount > 1;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={color}>
          ▶ {activity.title}
        </Text>
        {canSwap && (
          <Text color={COLORS.faint}>
            {'  '}
            {alternativeIndex + 1}/{alternativeCount}
          </Text>
        )}
      </Box>

      {tier !== 'minimal' && (
        <Box marginTop={1} alignItems="center" flexDirection="column">
          <Sprite sprite={getSprite(activity.sprite)} />
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
          {activity.instant
            ? '[space] log it   [s] snooze   [d] not today'
            : '[enter] start   [s] snooze   [d] not today'}
        </Text>
        {canSwap && (
          <Text color={COLORS.faint} wrap="wrap">
            [tab] something else
          </Text>
        )}
      </Box>
    </Box>
  );
}
