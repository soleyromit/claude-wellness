/**
 * Choose an activity yourself.
 *
 * The scheduler deciding for you is right when it interrupts — you shouldn't
 * have to make a decision mid-task. It's wrong as the *only* option, because
 * whether you can drop and do push-ups right now depends on things the
 * scheduler can't see. This is the deliberate path: everything you've enabled,
 * ordered most-useful-first, one keypress to start.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { GROUP_LABELS } from '../core/activities.js';
import type { Activity } from '../core/types.js';
import { COLORS, GROUP_COLORS, GROUP_GLYPHS, type Tier } from './theme.js';

export interface PickerProps {
  readonly activities: readonly Activity[];
  readonly dueIds: ReadonlySet<string>;
  readonly cursor: number;
  readonly tier: Tier;
}

/** Rows visible at once, so a long list scrolls rather than overflowing. */
const WINDOW = 8;

export function Picker({ activities, dueIds, cursor, tier }: PickerProps): React.ReactElement {
  if (activities.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold color={COLORS.accent}>
          pick something
        </Text>
        <Box marginTop={1}>
          <Text color={COLORS.dim}>
            Nothing is enabled. Run `wellness config` to switch something on.
          </Text>
        </Box>
      </Box>
    );
  }

  // Keep the cursor inside a sliding window so long lists stay navigable.
  const start = Math.max(0, Math.min(cursor - Math.floor(WINDOW / 2), activities.length - WINDOW));
  const visible = activities.slice(Math.max(0, start), Math.max(0, start) + WINDOW);
  const offset = Math.max(0, start);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={COLORS.accent}>
          pick something
        </Text>
        <Text color={COLORS.faint}>
          {'  '}
          {cursor + 1}/{activities.length}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {visible.map((activity, i) => {
          const index = offset + i;
          const selected = index === cursor;
          const due = dueIds.has(activity.id);
          return (
            <Box key={activity.id}>
              <Text color={selected ? COLORS.accent : COLORS.faint}>{selected ? '❯ ' : '  '}</Text>
              <Text color={GROUP_COLORS[activity.group]}>{GROUP_GLYPHS[activity.group]} </Text>
              <Box width={tier === 'full' ? 24 : 18}>
                <Text bold={selected} color={selected ? COLORS.text : COLORS.dim}>
                  {activity.title}
                </Text>
              </Box>
              {tier === 'full' && (
                <Text color={COLORS.faint}>{GROUP_LABELS[activity.group].toLowerCase()}</Text>
              )}
              {due && <Text color={COLORS.warn}> · due</Text>}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color={COLORS.faint}>↑↓ choose · [enter] start · [esc] back</Text>
      </Box>
    </Box>
  );
}
