/**
 * The routine editor — how you add things to your routine and take them out.
 *
 * Two levels, navigated with the arrow keys: groups own the cadence and the
 * daily goal, and expanding a group reveals the individual activities in its
 * rotation. Everything saves the moment you change it, because a config screen
 * with an explicit save step is a config screen people abandon halfway.
 */

import React, { useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import {
  ACTIVITIES,
  GROUP_LABELS,
  activitiesInGroup,
} from '../core/activities.js';
import { ACTIVITY_GROUPS, type ActivityGroup, type Config } from '../core/types.js';
import {
  isActivityEnabled,
  loadConfig,
  saveConfig,
  setActivityEnabled,
  setGroupConfig,
} from '../store/config.js';
import { COLORS, GROUP_COLORS, GROUP_GLYPHS } from './theme.js';

/** Flattened list of rows so arrow-key navigation is a single index. */
type Row =
  | { readonly kind: 'group'; readonly group: ActivityGroup }
  | { readonly kind: 'activity'; readonly group: ActivityGroup; readonly id: string };

const INTERVAL_STEP = 5;
const MIN_INTERVAL = 5;
const MAX_INTERVAL = 240;

export interface ConfigEditorProps {
  readonly env?: NodeJS.ProcessEnv;
}

export function ConfigEditor({ env }: ConfigEditorProps): React.ReactElement {
  const { exit } = useApp();
  const [config, setConfig] = useState<Config>(() => loadConfig(env));
  const [expanded, setExpanded] = useState<Set<ActivityGroup>>(new Set());
  const [cursor, setCursor] = useState(0);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const group of ACTIVITY_GROUPS) {
      out.push({ kind: 'group', group });
      if (expanded.has(group)) {
        for (const activity of activitiesInGroup(group)) {
          out.push({ kind: 'activity', group, id: activity.id });
        }
      }
    }
    return out;
  }, [expanded]);

  const update = (next: Config): void => {
    setConfig(next);
    saveConfig(next, env);
  };

  useInput((inputChar, key) => {
    const input = inputChar.toLowerCase();

    if (input === 'q' || key.escape) {
      exit();
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursor((c) => (c - 1 + rows.length) % rows.length);
      return;
    }
    if (key.downArrow || input === 'j') {
      setCursor((c) => (c + 1) % rows.length);
      return;
    }

    const row = rows[Math.min(cursor, rows.length - 1)];
    if (!row) return;

    if (input === ' ') {
      if (row.kind === 'group') {
        update(
          setGroupConfig(config, row.group, { enabled: !config.groups[row.group].enabled }),
        );
      } else {
        update(setActivityEnabled(config, row.id, !isActivityEnabled(config, row.id)));
      }
      return;
    }

    if (key.return) {
      if (row.kind !== 'group') return;
      setExpanded((previous) => {
        const next = new Set(previous);
        if (next.has(row.group)) next.delete(row.group);
        else next.add(row.group);
        return next;
      });
      return;
    }

    // Left/right adjust the group's cadence — only meaningful on a group row.
    if (key.leftArrow || key.rightArrow) {
      const group = row.group;
      const current = config.groups[group].everyMinutes;
      const delta = key.rightArrow ? INTERVAL_STEP : -INTERVAL_STEP;
      const everyMinutes = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, current + delta));
      update(setGroupConfig(config, group, { everyMinutes }));
      return;
    }

    // +/- adjust the daily goal.
    if (input === '+' || input === '=') {
      const group = row.group;
      update(
        setGroupConfig(config, group, {
          dailyGoal: Math.min(50, config.groups[group].dailyGoal + 1),
        }),
      );
      return;
    }
    if (input === '-' || input === '_') {
      const group = row.group;
      update(
        setGroupConfig(config, group, {
          dailyGoal: Math.max(1, config.groups[group].dailyGoal - 1),
        }),
      );
    }
  });

  const enabledCount = ACTIVITY_GROUPS.filter((g) => config.groups[g].enabled).length;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={COLORS.accent}>
        your routine
      </Text>
      <Text color={COLORS.faint}>
        {enabledCount} of {ACTIVITY_GROUPS.length} groups on · saved automatically
      </Text>

      <Box marginTop={1} flexDirection="column">
        {rows.map((row, index) => {
          const selected = index === cursor;
          const pointer = selected ? '❯ ' : '  ';

          if (row.kind === 'group') {
            const groupConfig = config.groups[row.group];
            const isExpanded = expanded.has(row.group);
            return (
              <Box key={`g-${row.group}`}>
                <Text color={selected ? COLORS.accent : COLORS.faint}>{pointer}</Text>
                <Text color={groupConfig.enabled ? COLORS.success : COLORS.faint}>
                  {groupConfig.enabled ? '[x]' : '[ ]'}{' '}
                </Text>
                <Text color={GROUP_COLORS[row.group]}>{GROUP_GLYPHS[row.group]} </Text>
                <Box width={12}>
                  <Text
                    bold={selected}
                    color={groupConfig.enabled ? COLORS.text : COLORS.faint}
                  >
                    {GROUP_LABELS[row.group]}
                  </Text>
                </Box>
                <Text color={COLORS.dim}>
                  every {groupConfig.everyMinutes}m · goal {groupConfig.dailyGoal}
                </Text>
                <Text color={COLORS.faint}>{isExpanded ? '  ▾' : '  ▸'}</Text>
              </Box>
            );
          }

          const activity = ACTIVITIES.find((a) => a.id === row.id)!;
          const on = isActivityEnabled(config, row.id);
          return (
            <Box key={`a-${row.id}`}>
              <Text color={selected ? COLORS.accent : COLORS.faint}>{pointer}</Text>
              <Text color={COLORS.faint}>{'   '}</Text>
              <Text color={on ? COLORS.success : COLORS.faint}>{on ? '[x]' : '[ ]'} </Text>
              <Text color={on ? COLORS.dim : COLORS.faint}>{activity.title}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={COLORS.faint}>↑↓ move · [space] on/off · [enter] expand group</Text>
        <Text color={COLORS.faint}>←→ interval · +/- daily goal · [q] done</Text>
      </Box>
    </Box>
  );
}
