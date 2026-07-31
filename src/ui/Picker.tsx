/**
 * Choose an activity yourself.
 *
 * Laid out as three columns — groups, then the activities in the selected
 * group, then a preview of whatever is highlighted.
 *
 * A flat list was fine at seventeen activities and stops being fine well
 * before thirty: you scroll past things you'd have picked, and there is no way
 * to answer "what stretches are there?" without reading every row. Columns
 * keep the visible list to one group's worth however many exist in total, and
 * the group column doubles as a summary of what's due.
 *
 * The preview matters as much as the list. Picking from titles alone means
 * committing to an activity before knowing what it involves.
 *
 * Narrow panes drop columns from the right — preview first, then the activity
 * list — rather than squeezing all three.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { GROUP_LABELS } from '../core/activities.js';
import type { Activity, ActivityGroup } from '../core/types.js';
import { getSprite } from '../sprites/index.js';
import { Sprite } from './Sprite.js';
import { COLORS, GROUP_COLORS, GROUP_GLYPHS, type Tier } from './theme.js';

export type PickerColumn = 'groups' | 'activities';

export interface PickerProps {
  /** Every selectable activity, already ordered most-overdue-first. */
  readonly activities: readonly Activity[];
  readonly dueIds: ReadonlySet<string>;
  readonly column: PickerColumn;
  readonly groupIndex: number;
  readonly activityIndex: number;
  readonly tier: Tier;
}

export interface GroupEntry {
  readonly group: ActivityGroup;
  readonly activities: readonly Activity[];
  readonly dueCount: number;
}

/**
 * Bucket the flat list into groups, keeping the order the scheduler produced
 * so the most overdue group stays at the top.
 */
export function groupActivities(
  activities: readonly Activity[],
  dueIds: ReadonlySet<string>,
): GroupEntry[] {
  const order: ActivityGroup[] = [];
  const byGroup = new Map<ActivityGroup, Activity[]>();

  for (const activity of activities) {
    if (!byGroup.has(activity.group)) {
      byGroup.set(activity.group, []);
      order.push(activity.group);
    }
    byGroup.get(activity.group)!.push(activity);
  }

  return order.map((group) => {
    const list = byGroup.get(group)!;
    return {
      group,
      activities: list,
      dueCount: list.filter((a) => dueIds.has(a.id)).length,
    };
  });
}

/** Rows visible in the activity column before it scrolls. */
const WINDOW = 9;

export function Picker({
  activities,
  dueIds,
  column,
  groupIndex,
  activityIndex,
  tier,
}: PickerProps): React.ReactElement {
  const groups = groupActivities(activities, dueIds);

  if (groups.length === 0) {
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

  const groupEntry = groups[Math.min(groupIndex, groups.length - 1)]!;
  const inGroup = groupEntry.activities;
  const selected = inGroup[Math.min(activityIndex, inGroup.length - 1)]!;

  const showPreview = tier === 'full';
  const showActivities = tier !== 'minimal' || column === 'activities';
  const showGroups = tier !== 'minimal' || column === 'groups';

  const start = Math.max(0, Math.min(activityIndex - Math.floor(WINDOW / 2), inGroup.length - WINDOW));
  const offset = Math.max(0, start);
  const visible = inGroup.slice(offset, offset + WINDOW);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={COLORS.accent}>
          pick something
        </Text>
        <Text color={COLORS.faint}>
          {'  '}
          {activities.length} available
        </Text>
      </Box>

      <Box marginTop={1}>
        {showGroups && (
          <Box flexDirection="column" marginRight={2}>
            {groups.map((entry, i) => {
              const active = i === groupIndex;
              // Only the focused column shows a cursor, so it's always clear
              // which one the arrow keys are driving.
              const focused = active && column === 'groups';
              return (
                <Box key={entry.group}>
                  <Text color={focused ? COLORS.accent : COLORS.faint}>
                    {focused ? '❯ ' : '  '}
                  </Text>
                  <Text color={GROUP_COLORS[entry.group]}>
                    {GROUP_GLYPHS[entry.group]}{' '}
                  </Text>
                  <Box width={11}>
                    <Text bold={active} color={active ? COLORS.text : COLORS.dim}>
                      {GROUP_LABELS[entry.group]}
                    </Text>
                  </Box>
                  <Text color={entry.dueCount > 0 ? COLORS.warn : COLORS.faint}>
                    {entry.dueCount > 0 ? `${entry.dueCount} due` : `${entry.activities.length}`}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}

        {showActivities && (
          <Box flexDirection="column" marginRight={showPreview ? 2 : 0}>
            {visible.map((activity, i) => {
              const index = offset + i;
              const active = index === activityIndex;
              const focused = active && column === 'activities';
              return (
                <Box key={activity.id}>
                  <Text color={focused ? COLORS.accent : COLORS.faint}>
                    {focused ? '❯ ' : '  '}
                  </Text>
                  <Box width={showPreview ? 22 : 26}>
                    <Text
                      bold={focused}
                      color={
                        column === 'activities'
                          ? active
                            ? COLORS.text
                            : COLORS.dim
                          : COLORS.faint
                      }
                    >
                      {activity.title}
                    </Text>
                  </Box>
                  {dueIds.has(activity.id) && <Text color={COLORS.warn}>due</Text>}
                </Box>
              );
            })}
            {inGroup.length > WINDOW && (
              <Text color={COLORS.faint}>
                {'  '}
                +{inGroup.length - WINDOW} more
              </Text>
            )}
          </Box>
        )}

        {showPreview && (
          <Box flexDirection="column" alignItems="center">
            {/* Keyed on the activity so the animation restarts when you move. */}
            <Sprite key={selected.id} sprite={getSprite(selected.sprite)} frameMs={140} />
          </Box>
        )}
      </Box>

      {tier !== 'minimal' && (
        <Box marginTop={1}>
          <Text color={COLORS.dim} wrap="wrap">
            {selected.cue}
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={COLORS.faint}>
          {column === 'groups'
            ? '↑↓ group · → activities · [enter] start · [esc] back'
            : '↑↓ choose · ← groups · [enter] start · [esc] back'}
        </Text>
      </Box>
    </Box>
  );
}
