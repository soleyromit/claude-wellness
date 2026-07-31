/**
 * Choose an activity yourself.
 *
 * Groups run across the top as tabs; the selected group's activities fill a
 * grid of tiles below, each showing its own art.
 *
 * A tile grid rather than a list because a text row is one terminal line, which
 * is two pixels of height — nowhere near enough for a picture. Tiles give every
 * item a visual at a size where it still reads, and fit more of them in the
 * same space than a list plus one large preview did.
 *
 * Every activity appears, including ones switched out of the routine: turning
 * something off should mean "stop reminding me", not "hide it from me". A mark
 * distinguishes what gets reminded automatically from what is yours to start.
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
  /** Activities the scheduler will remind you about on its own. */
  readonly autoIds: ReadonlySet<string>;
  readonly column: PickerColumn;
  readonly groupIndex: number;
  readonly activityIndex: number;
  readonly tier: Tier;
}

export interface GroupEntry {
  readonly group: ActivityGroup;
  readonly activities: readonly Activity[];
  readonly dueCount: number;
  readonly autoCount: number;
}

export function groupActivities(
  activities: readonly Activity[],
  dueIds: ReadonlySet<string>,
  autoIds: ReadonlySet<string> = new Set(),
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
      autoCount: list.filter((a) => autoIds.has(a.id)).length,
    };
  });
}

/** Sprite pixels per tile. 16 is eight terminal rows — small but still legible. */
const TILE_PX = 16;
const TILE_WIDTH = TILE_PX + 2;

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
  // A group with nothing on the routine is dimmed, not hidden.
  const off = entry.autoCount === 0;
  const label = `${GROUP_GLYPHS[entry.group]} ${GROUP_LABELS[entry.group]}${
    entry.dueCount > 0 ? ` ${entry.dueCount}` : ''
  }`;

  return (
    <Box marginRight={1}>
      <Text
        backgroundColor={selected ? (focused ? COLORS.selection : COLORS.selectionMuted) : undefined}
        color={selected ? (off ? COLORS.dim : colour) : COLORS.faint}
        bold={selected}
      >
        {` ${label} `}
      </Text>
    </Box>
  );
}

/** One activity: its art, its name, and whether it is part of the routine. */
function Tile({
  activity,
  selected,
  due,
  auto,
}: {
  activity: Activity;
  selected: boolean;
  due: boolean;
  auto: boolean;
}): React.ReactElement {
  const sprite = getSprite(activity.sprite);
  const factor = Math.max(1, Math.round(sprite.height / TILE_PX));
  const thumb = React.useMemo(() => downscale(sprite, factor), [sprite, factor]);

  return (
    <Box flexDirection="column" marginRight={1}>
      {/* Only the selected tile animates. Every tile moving at once turns the
          menu into a wall of motion you cannot read. */}
      <Sprite sprite={thumb} frame={selected ? undefined : 0} frameMs={160} />

      <Text
        backgroundColor={selected ? COLORS.selection : undefined}
        color={selected ? COLORS.text : auto ? COLORS.dim : COLORS.faint}
        bold={selected}
      >
        {fit(` ${activity.short ?? activity.title}`, TILE_WIDTH)}
      </Text>
      <Text color={due ? COLORS.warn : COLORS.faint}>
        {fit(due ? ' ▲ due now' : auto ? ' ◷ auto' : ' · manual', TILE_WIDTH)}
      </Text>
    </Box>
  );
}

export function Picker({
  activities,
  dueIds,
  autoIds,
  column,
  groupIndex,
  activityIndex,
  tier,
}: PickerProps): React.ReactElement {
  const groups = groupActivities(activities, dueIds, autoIds);

  if (groups.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold color={COLORS.accent}>
          pick something
        </Text>
        <Box marginTop={1}>
          <Text color={COLORS.dim}>Nothing to show. Run `wellness config`.</Text>
        </Box>
      </Box>
    );
  }

  const groupEntry = groups[Math.min(groupIndex, groups.length - 1)]!;
  const inGroup = groupEntry.activities;
  const activeIndex = Math.min(activityIndex, inGroup.length - 1);
  const selected = inGroup[activeIndex]!;

  // Narrow panes drop to fewer tiles per row rather than shrinking them below
  // the size at which the art means anything.
  const perRow = tier === 'full' ? 3 : tier === 'compact' ? 2 : 1;
  const rows: Activity[][] = [];
  for (let i = 0; i < inGroup.length; i += perRow) {
    rows.push(inGroup.slice(i, i + perRow));
  }

  const autoCount = activities.filter((a) => autoIds.has(a.id)).length;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={COLORS.accent}>
          pick something
        </Text>
        <Text color={COLORS.faint}>
          {'   '}
          {autoCount} auto · {activities.length - autoCount} manual
        </Text>
      </Box>

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

      <Box marginTop={1} flexDirection="column">
        {rows.map((row, r) => (
          <Box key={r}>
            {row.map((activity, c) => (
              <Tile
                key={activity.id}
                activity={activity}
                selected={r * perRow + c === activeIndex && column === 'activities'}
                due={dueIds.has(activity.id)}
                auto={autoIds.has(activity.id)}
              />
            ))}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={COLORS.dim} wrap="wrap">
          {selected.cue}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={COLORS.faint}>
          {column === 'groups'
            ? '←→ group   ↓ pick   [enter] start   [esc] back'
            : '←→↑↓ move   [enter] start   [esc] back'}
        </Text>
      </Box>
    </Box>
  );
}
