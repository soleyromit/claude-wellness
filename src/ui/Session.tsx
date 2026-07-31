/**
 * The guided session.
 *
 * The sprite frame is driven by the current *step*, not by a free-running
 * timer, so the art and the instruction stay in lockstep: when it says "breathe
 * in", the box is growing. Following the animation is the exercise.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { frameFor, type SessionPlan, type SessionState } from '../core/session.js';
import { getSprite } from '../sprites/index.js';
import { Sprite } from './Sprite.js';
import {
  COLORS,
  GROUP_COLORS,
  MIN_ART_ROWS,
  artRowsFor,
  bar,
  textRows,
  type PaneSize,
  type Tier,
} from './theme.js';

export interface SessionProps {
  readonly plan: SessionPlan;
  readonly state: SessionState;
  readonly tier: Tier;
  /** Elapsed session time, so smooth sprites can track it continuously. */
  readonly elapsedMs: number;
  /** The space available. Omit for an unbounded pane. */
  readonly pane?: PaneSize;
}

const KEYS = '[space] skip step   [q] stop';

export function Session({
  plan,
  state,
  tier,
  elapsedMs,
  pane,
}: SessionProps): React.ReactElement {
  const { activity } = plan;
  const color = GROUP_COLORS[activity.group];
  const sprite = getSprite(activity.sprite);
  const frame = frameFor(plan, state, sprite.frames.length, elapsedMs);
  const barWidth = tier === 'full' ? 24 : 14;

  const columns = pane?.columns ?? Number.POSITIVE_INFINITY;
  // The instruction and the clock are the session; the figure illustrates it.
  const chrome =
    textRows(activity.title, columns) +
    1 + // gap above the art
    1 +
    textRows(state.entry.label, columns) +
    1 + // countdown and step bar
    1 +
    1 + // overall bar
    1 +
    textRows(KEYS, columns);

  const artRows = artRowsFor(pane, chrome);
  const showArt = tier !== 'minimal' && artRows >= MIN_ART_ROWS;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={color}>
          {activity.title}
        </Text>
        {plan.reps > 1 && (
          <Text color={COLORS.faint}>
            {'  '}
            rep {state.entry.rep + 1}/{plan.reps}
          </Text>
        )}
      </Box>

      {showArt && (
        <Box marginTop={1} flexDirection="column" alignItems="center">
          <Sprite sprite={sprite} frame={frame} maxRows={artRows} />
        </Box>
      )}

      <Box marginTop={1}>
        <Text bold color={COLORS.text} wrap="wrap">
          {state.entry.label}
        </Text>
      </Box>

      <Box>
        <Text color={color}>{state.secondsLeft}s</Text>
        <Text color={COLORS.faint}> {bar(state.stepProgress, barWidth)}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color={COLORS.faint}>overall {bar(state.totalProgress, barWidth)}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color={COLORS.faint}>{KEYS}</Text>
      </Box>
    </Box>
  );
}

export interface CompleteProps {
  readonly title: string;
  readonly xp: number;
  readonly tier: Tier;
}

/** Brief confirmation after finishing, so a completion feels like something. */
export function SessionComplete({ title, xp }: CompleteProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={COLORS.success}>
          ✓ {title}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={COLORS.warn}>+{xp} xp</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={COLORS.faint}>back to work</Text>
      </Box>
    </Box>
  );
}
