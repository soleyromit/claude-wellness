/**
 * Choose an activity yourself.
 *
 * Groups run across the top as tabs; the selected group's activities fill a
 * list below, with a preview of the highlighted one beside it.
 *
 * Two decisions carry the layout:
 *
 *  - **Tabs, not a column.** Three side-by-side columns of text ate the width
 *    of a side pane and left the activity titles cramped. Groups are short and
 *    there are few of them, so a row costs one line and gives the list its
 *    width back.
 *  - **Selection is a filled band, not a caret.** A `❯` is easy to lose in a
 *    narrow pane seen from the corner of your eye. A full-width highlight is
 *    what every terminal list does, and it is legible at a glance.
 *
 * The visible list stays one group's worth however many activities exist in
 * total, which is the point of grouping at all.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { GROUP_LABELS } from '../core/activities.js';
import type { Activity, ActivityGroup } from '../core/types.js';
import { downscale } from '../render/pixel.js';
import { getSprite } from '../sprites/index.js';
import { Sprite } from './Sprite.js';
import { COLORS, GROUP_COLORS, GROUP_GLYPHS, fit, type Tier } from './theme.js';

export type PickerColumn = 'groups' | 'activities';

export interface PickerProps {
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
 * so the most overdue group stays first.
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

const WINDOW = 7;

/** A group tab. Selected tabs are filled; the rest are quiet. */
function Tab({
  entry,
  selected,
  focused,
}: {
  entry: GroupEntry;
  selected: boolean;
  focused: boolean;
}): React.ReactElement {
  const colour = GROUP_COLORS[entry.group];
  const label = `${GROUP_GLYPHS[entry.group]} ${GROUP_LABELS[entry.group]}${
    entry.dueCount > 0 ? ` ${entry.dueCount}` : ''
  }`;

  return (
    <Box marginRight={1}>
      <Text
        backgroundColor={selected ? (focused ? COLORS.selection : COLORS.selectionMuted) : undefined}
        color={selected ? colour : COLORS.faint}
        bold={selected}
      >
        {` ${label} `}
      </Text>
    </Box>
  );
}

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
  const activeIndex = Math.min(activityIndex, inGroup.length - 1);
  const selected = inGroup[activeIndex]!;
  const preview = React.useMemo(() => {
    const sprite = getSprite(selected.sprite);
    return sprite.height > 32 ? downscale(sprite, 2) : sprite;
  }, [selected.sprite]);

  const showPreview = tier === 'full';
  // Wide enough for the longest title ("Wrist & finger stretch") without
  // clipping. The preview is halved, so there is room for both.
  const listWidth = showPreview ? 30 : tier === 'compact' ? 32 : 26;

  const start = Math.max(0, Math.min(activeIndex - Math.floor(WINDOW / 2), inGroup.length - WINDOW));
  const offset = Math.max(0, start);
  const visible = inGroup.slice(offset, offset + WINDOW);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={COLORS.accent}>
          pick something
        </Text>
        <Text color={COLORS.faint}>
          {'   '}
          {activities.length} available
        </Text>
      </Box>

      {/* Group tabs. Wrapping keeps them usable in a narrow pane. */}
      <Box marginTop={1} flexWrap="wrap">
        {groups.map((entry, i) => (
          <Tab
            key={entry.group}
            entry={entry}
            selected={i === groupIndex}
            focused={column === 'groups'}
          />
        ))}
      </Box>

      <Box marginTop={1}>
        <Box flexDirection="column" marginRight={showPreview ? 2 : 0}>
          {visible.map((activity, i) => {
            const index = offset + i;
            const active = index === activeIndex;
            const focused = active && column === 'activities';
            const due = dueIds.has(activity.id);
            const label = fit(` ${activity.title}`, listWidth - 4);

            return (
              <Box key={activity.id}>
                <Text
                  backgroundColor={
                    active ? (focused ? COLORS.selection : COLORS.selectionMuted) : undefined
                  }
                  color={active ? COLORS.text : COLORS.dim}
                  bold={focused}
                >
                  {label}
                </Text>
                <Text
                  backgroundColor={
                    active ? (focused ? COLORS.selection : COLORS.selectionMuted) : undefined
                  }
                  color={due ? COLORS.warn : COLORS.faint}
                >
                  {fit(due ? 'due' : '', 4)}
                </Text>
              </Box>
            );
          })}

          {inGroup.length > WINDOW && (
            <Text color={COLORS.faint}> +{inGroup.length - WINDOW} more</Text>
          )}
        </Box>

        {showPreview && (
          <Box
            borderStyle="round"
            borderColor={COLORS.rule}
            paddingX={1}
            flexDirection="column"
            alignItems="center"
          >
            {/* Halved: a full-size figure is twenty-four rows and swamps the
                list it is meant to illustrate. Keyed on the activity so the
                animation restarts when the selection moves. */}
            <Sprite key={selected.id} sprite={preview} frameMs={140} />
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
            ? '←→ group   ↓ activities   [enter] start   [esc] back'
            : '↑↓ choose   ↑ groups   [enter] start   [esc] back'}
        </Text>
      </Box>
    </Box>
  );
}
