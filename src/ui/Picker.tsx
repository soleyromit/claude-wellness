/**
 * Choose an activity yourself. The only menu in the app.
 *
 * Groups run across the top as tabs; the selected group's activities are a
 * list down the left, and whatever is selected is drawn large beside it. One
 * list and one picture, rather than a grid of thumbnails: a grid puts every
 * activity on screen at once but makes each of them too small to actually see,
 * which is the wrong way round — you are choosing between seven things, not
 * seventy, and what you want from each is a good look at it.
 *
 * Nothing here is sized from what happens to be selected. Tabs, list, preview
 * and cue all hold their space, so walking the menu never moves the menu.
 *
 * Every activity appears, including ones switched out of the routine: turning
 * something off should mean "stop reminding me", not "hide it from me". A mark
 * distinguishes what gets reminded automatically from what is yours to start.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { GROUP_LABELS } from '../core/activities.js';
import type { Activity, ActivityGroup } from '../core/types.js';
import { spriteLineHeight } from '../render/pixel.js';
import { getSprite } from '../sprites/index.js';
import { Sprite } from './Sprite.js';
import {
  COLORS,
  GROUP_COLORS,
  GROUP_GLYPHS,
  fit,
  textRows,
  type PaneSize,
  type Tier,
} from './theme.js';

export interface PickerProps {
  readonly activities: readonly Activity[];
  readonly dueIds: ReadonlySet<string>;
  /** Activities the scheduler will remind you about on its own. */
  readonly autoIds: ReadonlySet<string>;
  readonly groupIndex: number;
  readonly activityIndex: number;
  readonly tier: Tier;
  /** The space available. Omit for an unbounded pane. */
  readonly pane?: PaneSize;
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

/**
 * Where an activity sits in the menu, so it can be opened on a particular one.
 * Falls back to the first entry when the activity isn't listed, which is what
 * you want from a menu that has to open regardless.
 */
export function locateActivity(
  activities: readonly Activity[],
  activityId: string,
): { groupIndex: number; activityIndex: number } {
  const groups = groupActivities(activities, new Set());
  const groupIndex = groups.findIndex((g) => g.activities.some((a) => a.id === activityId));
  if (groupIndex < 0) return { groupIndex: 0, activityIndex: 0 };
  return {
    groupIndex,
    activityIndex: groups[groupIndex]!.activities.findIndex((a) => a.id === activityId),
  };
}

/** Widest mark, so the column is the same width on every row. */
const STATUS_WIDTH = '▲ due now'.length;
/** More than this and the cue is eating the menu it is meant to annotate. */
const MAX_CUE_ROWS = 3;
/**
 * Below either of these the preview is a smudge rather than a picture, and
 * the screen is better off as a plain list.
 */
const MIN_PREVIEW_COLUMNS = 12;
const MIN_PREVIEW_ROWS = 5;
/** Fewer visible activities than this and it stops being a menu. */
const MIN_LIST_ROWS = 3;

/**
 * What an activity's standing in the routine reads as in the list.
 *
 * Being on the routine is the ordinary case — seventeen of the eighteen — so
 * it says nothing at all. A mark on every row to report "normal" is a column
 * spent on noise; only what is waiting, or what the scheduler will never
 * bring up on its own, is worth calling out.
 */
function statusOf(due: boolean, auto: boolean, terse: boolean): string {
  if (due) return terse ? '▲' : '▲ due now';
  if (auto) return '';
  return terse ? '·' : '· manual';
}

/**
 * Rows the tab bar wraps onto. Tabs are laid out by flexbox, so this repeats
 * the packing Ink is about to do: whole tabs, in order, until one doesn't fit.
 */
export function tabRows(labels: readonly string[], columns: number): number {
  if (!Number.isFinite(columns)) return 1;

  let rows = 1;
  let used = 0;
  for (const label of labels) {
    // Two padding spaces inside the tab, one margin between tabs.
    const width = [...label].length + 3;
    if (used > 0 && used + width > columns) {
      rows += 1;
      used = 0;
    }
    used += width;
  }
  return rows;
}

/**
 * What a group's tab reads. Also what its width is measured from.
 *
 * In the tightest layout the tab bar would wrap onto three rows, which in a
 * short pane costs more than the list it is there to introduce. Unselected
 * groups fall back to their glyph — the same collapse the rings make — while
 * the one you are on keeps its name, so the bar still says where you are.
 */
function tabLabel(entry: GroupEntry, tier: Tier, selected: boolean): string {
  const due = entry.dueCount > 0 ? ` ${entry.dueCount}` : '';
  if (tier === 'minimal' && !selected) return `${GROUP_GLYPHS[entry.group]}${due}`;
  return `${GROUP_GLYPHS[entry.group]} ${GROUP_LABELS[entry.group]}${due}`;
}

function Tab({
  entry,
  label,
  selected,
}: {
  entry: GroupEntry;
  label: string;
  selected: boolean;
}): React.ReactElement {
  const colour = GROUP_COLORS[entry.group];
  // A group with nothing on the routine is dimmed, not hidden.
  const off = entry.autoCount === 0;

  return (
    <Box marginRight={1}>
      <Text
        backgroundColor={selected ? COLORS.selection : undefined}
        color={selected ? (off ? COLORS.dim : colour) : COLORS.faint}
        bold={selected}
      >
        {` ${label} `}
      </Text>
    </Box>
  );
}

/** One activity: its name, and whether the scheduler will bring it up. */
function Row({
  activity,
  selected,
  due,
  auto,
  nameWidth,
  statusWidth,
  terse,
}: {
  activity: Activity;
  selected: boolean;
  due: boolean;
  auto: boolean;
  nameWidth: number;
  statusWidth: number;
  terse: boolean;
}): React.ReactElement {
  return (
    <Box>
      <Text
        backgroundColor={selected ? COLORS.selection : undefined}
        color={selected ? COLORS.text : auto ? COLORS.dim : COLORS.faint}
        bold={selected}
      >
        {fit(`${selected ? '❱' : ' '} ${activity.short ?? activity.title}`, nameWidth)}
      </Text>
      <Text
        backgroundColor={selected ? COLORS.selection : undefined}
        color={due ? COLORS.warn : selected ? COLORS.dim : COLORS.faint}
      >
        {fit(` ${statusOf(due, auto, terse)}`, statusWidth)}
      </Text>
    </Box>
  );
}

export function Picker({
  activities,
  dueIds,
  autoIds,
  groupIndex,
  activityIndex,
  tier,
  pane,
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

  const terse = tier === 'minimal';
  const columns = pane?.columns ?? Number.POSITIVE_INFINITY;
  // The way out is never dropped, however tight the pane gets.
  const keys = terse
    ? '←→ group ↑↓ pick [enter] [esc]'
    : '←→ group   ↑↓ pick   [enter] start   [esc] back';

  // Every measurement below is taken across the whole catalogue rather than
  // the current group or the current selection. That is the point: the frame
  // the menu sits in has to be the same wherever you are inside it.
  const nameWidth = 2 + Math.max(...activities.map((a) => [...(a.short ?? a.title)].length));
  const statusWidth = terse ? 2 : STATUS_WIDTH + 1;
  const listWidth = nameWidth + statusWidth;
  const artColumns = Math.max(...activities.map((a) => getSprite(a.sprite).width));

  const tabBarRows = Math.max(
    ...groups.map((_, selectedIndex) =>
      tabRows(
        groups.map((entry, i) => tabLabel(entry, tier, i === selectedIndex)),
        columns,
      ),
    ),
  );
  const cueRows = terse
    ? 1
    : Math.min(MAX_CUE_ROWS, Math.max(...activities.map((a) => textRows(a.cue, columns))));
  const fixed =
    // Measured with the counter whether or not it is showing, so appearing
    // partway down a group cannot change the height of anything.
    textRows(`pick something   ${inGroup.length}/${inGroup.length}`, columns) +
    1 +
    tabBarRows +
    1 + // gap above the body
    1 +
    textRows(keys, columns);

  // In a pane this small the cue is worth less than the rows it costs: three
  // things you can choose between beat one sentence about one of them.
  const cueBlock = cueRows + 1;
  const showCue = !pane || pane.rows - fixed - cueBlock >= MIN_LIST_ROWS;
  const chrome = fixed + (showCue ? cueBlock : 0);

  // The body is as tall as the preview wants or the longest group needs,
  // whichever is greater, and never taller than the pane can hold.
  //
  // What the preview wants follows from the width it has, not from the
  // sprite's full size: art scaled to half width is half as tall, and a body
  // sized for the unscaled art would leave a band of nothing above it.
  const previewColumns = Number.isFinite(columns)
    ? columns - listWidth - 1
    : Number.POSITIVE_INFINITY;
  const scale = Number.isFinite(columns)
    ? Math.max(1, Math.ceil(artColumns / Math.max(1, columns - listWidth - 1)))
    : 1;
  const longestGroup = Math.max(...groups.map((g) => g.activities.length));
  const previewRows = Math.max(
    ...activities.map((a) => Math.ceil(spriteLineHeight(getSprite(a.sprite)) / scale)),
  );
  const wanted = Math.max(longestGroup, previewRows);
  const bodyRows = pane ? Math.max(1, Math.min(pane.rows - chrome, wanted)) : wanted;

  // Only when a group outgrows the body does the list scroll, and then a row
  // goes to saying what is off the end of it — unless that row is the only one
  // there is, in which case an activity is the better use of it.
  const windowed = longestGroup > bodyRows && bodyRows >= 2;
  const listRows = Math.max(1, windowed ? bodyRows - 1 : bodyRows);
  const start = Math.max(0, Math.min(activeIndex - listRows + 1, inGroup.length - listRows));
  const shown = inGroup.slice(start, start + listRows);
  const above = start;
  const below = Math.max(0, inGroup.length - start - listRows);
  // What the list block occupies, whichever group is showing.
  const listBlockRows = Math.min(bodyRows, longestGroup + (windowed ? 1 : 0));
  const hidden =
    above > 0 && below > 0
      ? ` ▴ ${above}   ▾ ${below}`
      : above > 0
        ? ` ▴ ${above} more`
        : below > 0
          ? ` ▾ ${below} more`
          : '';

  const showPreview = previewColumns >= MIN_PREVIEW_COLUMNS && bodyRows >= MIN_PREVIEW_ROWS;

  return (
    <Box flexDirection="column">
      {/* One Text, so the header wraps as one line rather than the layout
          squeezing the title to make room for the counter. */}
      <Text wrap="wrap">
        <Text bold color={COLORS.accent}>
          pick something
        </Text>
        {/* Only worth saying when some of the group is off the end of the
            list. With all of it on screen you can see where you are. */}
        {inGroup.length > listRows && (
          <Text color={COLORS.faint}>{`   ${activeIndex + 1}/${inGroup.length}`}</Text>
        )}
      </Text>

      <Box marginTop={1} flexWrap="wrap" height={tabBarRows}>
        {groups.map((entry, i) => (
          <Tab
            key={entry.group}
            entry={entry}
            label={tabLabel(entry, tier, i === groupIndex)}
            selected={i === groupIndex}
          />
        ))}
      </Box>

      <Box marginTop={1} height={bodyRows} alignItems="center">
        {/* Held against the middle of the body so the names sit beside the
            figure rather than floating above it. The block is sized from the
            longest group, not this one, so switching tabs moves nothing. */}
        <Box flexDirection="column" width={listWidth} height={listBlockRows}>
          {shown.map((activity, i) => (
            <Row
              key={activity.id}
              activity={activity}
              selected={start + i === activeIndex}
              due={dueIds.has(activity.id)}
              auto={autoIds.has(activity.id)}
              nameWidth={nameWidth}
              statusWidth={statusWidth}
              terse={terse}
            />
          ))}
          {windowed && <Text color={COLORS.faint}>{fit(hidden, listWidth)}</Text>}
        </Box>

        {showPreview && (
          // Bottom-aligned, so figures share a ground line whatever their
          // sprite's height and the preview doesn't hop as you move.
          <Box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="flex-end">
            <Sprite
              sprite={getSprite(selected.sprite)}
              frameMs={200}
              maxRows={bodyRows}
              maxColumns={previewColumns}
            />
          </Box>
        )}
      </Box>

      {showCue && (
        <Box marginTop={1} height={cueRows}>
          <Text color={COLORS.dim} wrap={terse ? 'truncate-end' : 'wrap'}>
            {selected.cue}
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={COLORS.faint}>{keys}</Text>
      </Box>
    </Box>
  );
}
