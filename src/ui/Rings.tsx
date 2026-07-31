/**
 * Today's progress, one row per enabled group.
 *
 * Terminals can't draw real rings, so these are bars — but they carry the same
 * information: how much of each goal is done, and which are closed.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { GROUP_LABELS } from '../core/activities.js';
import type { Ring } from '../core/progress.js';
import { COLORS, GROUP_COLORS, GROUP_GLYPHS, bar, type Tier } from './theme.js';

export interface RingsProps {
  readonly rings: readonly Ring[];
  readonly tier: Tier;
}

export function Rings({ rings, tier }: RingsProps): React.ReactElement {
  if (rings.length === 0) {
    return <Text color={COLORS.dim}>No groups enabled — run `wellness config`.</Text>;
  }

  // In the tightest layout the bars are dropped entirely and each group
  // collapses to a glyph and a fraction.
  if (tier === 'minimal') {
    return (
      <Box flexWrap="wrap">
        {rings.map((ring) => (
          <Box key={ring.group} marginRight={2}>
            <Text color={GROUP_COLORS[ring.group]}>{GROUP_GLYPHS[ring.group]} </Text>
            <Text color={ring.closed ? COLORS.success : COLORS.text}>
              {ring.done}/{ring.goal}
            </Text>
          </Box>
        ))}
      </Box>
    );
  }

  const barWidth = tier === 'full' ? 16 : 10;
  // Wide enough for the longest label plus its glyph: at ten, "◆ Hydration"
  // wrapped onto a second line and quietly cost the dashboard a row.
  const labelWidth = 12;

  return (
    <Box flexDirection="column">
      {rings.map((ring) => (
        <Box key={ring.group}>
          <Box width={labelWidth}>
            <Text color={GROUP_COLORS[ring.group]} wrap="truncate-end">
              {GROUP_GLYPHS[ring.group]} {GROUP_LABELS[ring.group]}
            </Text>
          </Box>
          <Text color={GROUP_COLORS[ring.group]}>{bar(ring.progress, barWidth)}</Text>
          <Text color={ring.closed ? COLORS.success : COLORS.dim}>
            {' '}
            {ring.done}/{ring.goal}
            {ring.closed ? ' ✓' : ''}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
