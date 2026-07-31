/**
 * The resting screen — what the pane shows when nothing is due.
 *
 * It has to survive being glanced at from the corner of your eye for hours, so
 * it's static: no animation, no colour churn, nothing that pulls focus while
 * you're working. The pet is the one exception, and it only changes when your
 * behaviour changes.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { GROUP_LABELS } from '../core/activities.js';
import type { Level, Ring, Streaks } from '../core/progress.js';
import type { PetState } from '../core/pet.js';
import type { ActivityGroup, ClaudeState } from '../core/types.js';
import { petSprite } from '../sprites/index.js';
import { Rings } from './Rings.js';
import { Sprite } from './Sprite.js';
import {
  COLORS,
  MIN_ART_ROWS,
  artRowsFor,
  bar,
  formatMinutes,
  textRows,
  type PaneSize,
  type Tier,
} from './theme.js';

export interface DashboardProps {
  readonly rings: readonly Ring[];
  readonly streaks: Streaks;
  readonly level: Level;
  readonly pet: PetState;
  readonly petEnabled: boolean;
  readonly nextDue: { group: ActivityGroup; minutes: number } | null;
  readonly claude: ClaudeState;
  readonly tier: Tier;
  /** The space available. Omit for an unbounded pane. */
  readonly pane?: PaneSize;
}

export function Dashboard({
  rings,
  streaks,
  level,
  pet,
  petEnabled,
  nextDue,
  claude,
  tier,
  pane,
}: DashboardProps): React.ReactElement {
  const columns = pane?.columns ?? Number.POSITIVE_INFINITY;
  const nextLine = nextDue
    ? `next: ${GROUP_LABELS[nextDue.group].toLowerCase()} ${formatMinutes(nextDue.minutes)}`
    : null;
  const footer =
    tier === 'minimal'
      ? '[w] water  [p] pick  [q] quit'
      : '[w] log water   [p] pick something   [q] quit';

  // Everything but the pet, counted so the pet can have what is left. The
  // rings are one row each except in the tightest layout, where they wrap
  // into a band of glyphs.
  const ringRows =
    rings.length === 0
      ? 1
      : tier === 'minimal'
        ? Math.ceil(rings.length / Math.max(1, Math.floor(columns / 8)))
        : rings.length;
  const chrome =
    1 + // title
    1 + // gap above the pet
    textRows(pet.message, columns) +
    1 +
    ringRows +
    1 +
    2 + // streak, level
    (nextLine ? 1 + textRows(nextLine, columns) : 0) +
    1 +
    textRows(footer, columns);

  const petRows = artRowsFor(pane, chrome);
  const showPet = petEnabled && tier !== 'minimal' && petRows >= MIN_ART_ROWS;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={COLORS.accent}>
          wellness
        </Text>
        <Text color={COLORS.faint}> · </Text>
        <Text color={claude === 'busy' ? COLORS.warn : COLORS.faint}>
          {claude === 'busy' ? 'claude is thinking' : 'idle'}
        </Text>
      </Box>

      {showPet && (
        <Box marginTop={1} flexDirection="column" alignItems="center">
          <Sprite sprite={petSprite(pet.mood)} frame={0} maxRows={petRows} />
          <Text color={COLORS.dim}>{pet.message}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Rings rings={rings} tier={tier} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={COLORS.warn}>▲ </Text>
          <Text color={COLORS.text}>
            {streaks.current} day streak
          </Text>
          {tier !== 'minimal' && streaks.longest > streaks.current && (
            <Text color={COLORS.faint}> (best {streaks.longest})</Text>
          )}
        </Box>

        <Box>
          <Text color={COLORS.accent}>◆ </Text>
          <Text color={COLORS.text}>Level {level.level}</Text>
          {tier === 'full' && (
            <>
              <Text color={COLORS.faint}> {bar(level.progress, 12)} </Text>
              <Text color={COLORS.faint}>
                {level.intoLevel}/{level.levelSpan} xp
              </Text>
            </>
          )}
        </Box>
      </Box>

      {nextLine && (
        <Box marginTop={1}>
          <Text color={COLORS.faint}>{nextLine}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={COLORS.faint}>{footer}</Text>
      </Box>
    </Box>
  );
}
