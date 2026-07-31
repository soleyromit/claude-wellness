/**
 * Choose an activity yourself.
 *
 * The scheduler deciding for you is right when it interrupts — you shouldn't
 * have to make a decision mid-task. It's wrong as the *only* option, because
 * whether you can drop and do push-ups right now depends on things the
 * scheduler can't see.
 *
 * The list is paired with a live preview of whatever is highlighted. Picking
 * from titles alone means committing to an activity before you know what it
 * involves; seeing the animation as you arrow through is the difference between
 * a menu and a catalogue. In panes too narrow to hold both, the preview is
 * dropped rather than the list squeezed.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { GROUP_LABELS } from '../core/activities.js';
import type { Activity } from '../core/types.js';
import { getSprite } from '../sprites/index.js';
import { Sprite } from './Sprite.js';
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

  const selected = activities[Math.min(cursor, activities.length - 1)]!;
  // A 32px sprite is 16 terminal lines; only offer the preview where the pane
  // can hold it beside the list without either being cramped.
  const showPreview = tier === 'full';

  const start = Math.max(0, Math.min(cursor - Math.floor(WINDOW / 2), activities.length - WINDOW));
  const offset = Math.max(0, start);
  const visible = activities.slice(offset, offset + WINDOW);

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

      <Box marginTop={1}>
        <Box flexDirection="column" marginRight={showPreview ? 2 : 0}>
          {visible.map((activity, i) => {
            const index = offset + i;
            const isSelected = index === cursor;
            const due = dueIds.has(activity.id);
            return (
              <Box key={activity.id}>
                <Text color={isSelected ? COLORS.accent : COLORS.faint}>
                  {isSelected ? '❯ ' : '  '}
                </Text>
                <Text color={GROUP_COLORS[activity.group]}>
                  {GROUP_GLYPHS[activity.group]}{' '}
                </Text>
                {/* Without a preview competing for width, give the titles the
                    space back rather than truncating them to "Sit-to-sta…". */}
                <Box width={showPreview ? 22 : 26}>
                  <Text bold={isSelected} color={isSelected ? COLORS.text : COLORS.dim}>
                    {activity.title}
                  </Text>
                </Box>
                {due && <Text color={COLORS.warn}>due</Text>}
              </Box>
            );
          })}
        </Box>

        {showPreview && (
          <Box flexDirection="column" alignItems="center">
            {/* Keyed on the activity so the animation restarts when you move. */}
            <Sprite key={selected.id} sprite={getSprite(selected.sprite)} frameMs={160} />
          </Box>
        )}
      </Box>

      {showPreview && (
        <Box marginTop={1} flexDirection="column">
          <Text color={GROUP_COLORS[selected.group]}>
            {GROUP_LABELS[selected.group]}
          </Text>
          <Text color={COLORS.dim} wrap="wrap">
            {selected.cue}
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={COLORS.faint}>↑↓ choose · [enter] start · [esc] back</Text>
      </Box>
    </Box>
  );
}
