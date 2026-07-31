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
import { COLORS, bar, formatMinutes, type Tier } from './theme.js';

export interface DashboardProps {
  readonly rings: readonly Ring[];
  readonly streaks: Streaks;
  readonly level: Level;
  readonly pet: PetState;
  readonly petEnabled: boolean;
  readonly nextDue: { group: ActivityGroup; minutes: number } | null;
  readonly claude: ClaudeState;
  readonly tier: Tier;
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
}: DashboardProps): React.ReactElement {
  const showPet = petEnabled && tier !== 'minimal';

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
          <Sprite sprite={petSprite(pet.mood)} frame={0} />
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

      {nextDue && (
        <Box marginTop={1}>
          <Text color={COLORS.faint}>
            next: {GROUP_LABELS[nextDue.group].toLowerCase()} {formatMinutes(nextDue.minutes)}
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={COLORS.faint}>
          {tier === 'minimal'
            ? '[w] water  [p] pick  [q] quit'
            : '[w] log water   [p] pick something   [q] quit'}
        </Text>
      </Box>
    </Box>
  );
}
