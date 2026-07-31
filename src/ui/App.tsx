/**
 * The companion's state machine.
 *
 * Four screens: dashboard (resting), nudge (something is due), session
 * (doing it), complete (brief confirmation). Every transition is either a
 * keypress or the scheduler deciding something is due.
 *
 * State that matters lives in the append-only log, not in React — the log is
 * appended to and then re-derived, so what you see always matches what was
 * actually recorded, and a crash loses nothing.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { getActivity } from '../core/activities.js';
import { computePet } from '../core/pet.js';
import {
  XP_BY_GROUP,
  computeLevel,
  computeStreaks,
  ringsFor,
  totalXp,
} from '../core/progress.js';
import { buildPlan, nextStepStart, sessionStateAt, type SessionPlan } from '../core/session.js';
import {
  allActivities,
  decide,
  isAutomatic,
  isDue,
  nextDueIn,
} from '../core/scheduler.js';
import type { Activity, ClaudeState, Config, LogEvent } from '../core/types.js';
import { ClaudeSignal } from '../claude/signal.js';
import { appendEvent, loadLog } from '../store/log.js';
import { loadConfig } from '../store/config.js';
import { emit, idleSequence, nudgeSequence } from './attention.js';
import { Dashboard } from './Dashboard.js';
import { Nudge } from './Nudge.js';
import { Picker, groupActivities, locateActivity } from './Picker.js';
import { Session, SessionComplete } from './Session.js';
import { insetPane, usePaneSize } from './pane.js';
import { COLORS, tierFor } from './theme.js';

/**
 * Sessions need a smooth countdown; the dashboard changes maybe once an hour.
 * Ticking fast on the dashboard would repaint a pane that sits open all day for
 * no visible benefit, so the clock slows down when nothing is happening.
 */
const SESSION_TICK_MS = 200;
const IDLE_TICK_MS = 2000;

const SNOOZE_MINUTES = 10;
const COMPLETE_SCREEN_MS = 2500;

type Screen =
  | { readonly kind: 'dashboard' }
  | { readonly kind: 'nudge'; readonly activity: Activity; readonly overdueMinutes: number }
  | {
      readonly kind: 'picker';
      readonly groupIndex: number;
      readonly activityIndex: number;
    }
  | { readonly kind: 'session'; readonly plan: SessionPlan; readonly startedAt: number }
  | { readonly kind: 'complete'; readonly title: string; readonly xp: number; readonly at: number };

export interface AppProps {
  readonly env?: NodeJS.ProcessEnv;
}

export function App({ env }: AppProps): React.ReactElement {
  const { exit } = useApp();

  const [config, setConfig] = useState<Config>(() => loadConfig(env));
  const [events, setEvents] = useState<LogEvent[]>(() => loadLog(env));
  const [claude, setClaude] = useState<ClaudeState>('idle');
  const [now, setNow] = useState(() => Date.now());
  const [screen, setScreen] = useState<Screen>({ kind: 'dashboard' });
  const terminal = usePaneSize();
  const columns = terminal.columns;

  // Groups are measured from when the companion started, so a fresh install
  // doesn't fire every reminder at once on first launch.
  const sessionStart = useRef(Date.now()).current;
  const lastNudgeTs = useRef<number | null>(null);
  // Session elapsed time is tracked as an offset so "skip step" can jump.
  const sessionOffset = useRef(0);

  /** Append to the log and mirror it into state in one step. */
  const record = useCallback(
    (event: LogEvent) => {
      appendEvent(event, env);
      setEvents((previous) => [...previous, event]);
    },
    [env],
  );

  // Clock, paced to whatever the current screen actually needs.
  const tickMs =
    screen.kind === 'session' || screen.kind === 'complete' ? SESSION_TICK_MS : IDLE_TICK_MS;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);

  // Claude busy/idle.
  useEffect(() => {
    const signal = new ClaudeSignal(env);
    signal.start();
    setClaude(signal.current);
    const unsubscribe = signal.subscribe(setClaude);
    return () => {
      unsubscribe();
      signal.stop();
    };
  }, [env]);

  // Pick up config edits made by `wellness config` in another pane.
  useEffect(() => {
    const timer = setInterval(() => setConfig(loadConfig(env)), 5000);
    return () => clearInterval(timer);
  }, [env]);

  // What a screen actually gets: the terminal, less this component's padding,
  // less the row taken by the hint below when the pane is too narrow to use.
  const tooNarrow = columns < 30;
  const inset = insetPane(terminal);
  const pane = { columns: inset.columns, rows: inset.rows - (tooNarrow ? 1 : 0) };
  const tier = tierFor(pane.columns, pane.rows);

  const rings = useMemo(() => ringsFor(events, config, now), [events, config, now]);
  const streaks = useMemo(() => computeStreaks(events, config, now), [events, config, now]);
  const level = useMemo(() => computeLevel(totalXp(events)), [events]);
  const pet = useMemo(() => computePet(events, config, now), [events, config, now]);
  const upcoming = useMemo(
    () => nextDueIn(events, config, now, sessionStart),
    [events, config, now, sessionStart],
  );

  // Recomputed on the slow dashboard tick, which is plenty — the ordering only
  // changes as groups fall due.
  // The picker lists everything; `autoIds` says which are on the routine.
  // Switching an activity off means "stop reminding me", not "hide it".
  const selectable = useMemo(() => allActivities(config), [config]);
  const autoIds = useMemo(
    () => new Set(selectable.filter((a) => isAutomatic(config, a)).map((a) => a.id)),
    [selectable, config],
  );
  const dueIds = useMemo(
    () =>
      new Set(
        selectable.filter((a) => isDue(events, config, a, now, sessionStart)).map((a) => a.id),
      ),
    [selectable, events, config, now, sessionStart],
  );

  /** Start a guided session, or log an instant activity outright. */
  const start = useCallback(
    (activity: Activity) => {
      if (activity.instant) {
        record({ ts: Date.now(), type: 'completed', activity: activity.id, meta: { count: 1 } });
        setScreen({ kind: 'complete', title: activity.title, xp: 5, at: Date.now() });
        return;
      }
      sessionOffset.current = 0;
      setScreen({ kind: 'session', plan: buildPlan(activity), startedAt: Date.now() });
    },
    [record],
  );

  // The scheduler only gets to interrupt the dashboard — never a running
  // session, and never a nudge you're already looking at.
  useEffect(() => {
    if (screen.kind !== 'dashboard') return;

    const decision = decide({
      events,
      config,
      claude,
      now,
      sessionStart,
      lastNudgeTs: lastNudgeTs.current,
    });

    if (decision.kind !== 'nudge') return;

    lastNudgeTs.current = now;
    // Recording "shown" resets the group's clock, so a dismissed nudge doesn't
    // immediately re-fire on the next tick.
    record({ ts: Date.now(), type: 'shown', activity: decision.nudge.activity.id });

    const offered = decision.nudge.activity;

    // Announce it. Without this the pane just silently changes contents, which
    // goes unnoticed when you're watching the Claude pane instead.
    emit(nudgeSequence(offered.title, config.attention));

    setScreen({
      kind: 'nudge',
      activity: offered,
      overdueMinutes: decision.nudge.overdueMinutes,
    });
  }, [screen.kind, events, config, claude, now, sessionStart, record]);

  // Put the title back once the nudge is dealt with, so a stale activity name
  // doesn't sit in the tab bar for the rest of the day.
  useEffect(() => {
    if (screen.kind === 'dashboard') emit(idleSequence(config.attention));
  }, [screen.kind, config.attention]);

  // Leave the terminal as we found it.
  useEffect(() => () => emit(idleSequence(config.attention)), [config.attention]);

  // Session advancement.
  useEffect(() => {
    if (screen.kind !== 'session') return;

    const elapsed = now - screen.startedAt + sessionOffset.current;
    if (elapsed < screen.plan.totalMs) return;

    const activity = screen.plan.activity;
    record({ ts: Date.now(), type: 'completed', activity: activity.id });
    setScreen({
      kind: 'complete',
      title: activity.title,
      xp: xpFor(activity),
      at: Date.now(),
    });
  }, [screen, now, record]);

  // Auto-dismiss the completion screen.
  useEffect(() => {
    if (screen.kind !== 'complete') return;
    if (now - screen.at < COMPLETE_SCREEN_MS) return;
    setScreen({ kind: 'dashboard' });
  }, [screen, now]);

  useInput((inputChar, key) => {
    const input = inputChar.toLowerCase();

    if (screen.kind === 'session') {
      if (input === 'q' || key.escape) {
        record({ ts: Date.now(), type: 'skipped', activity: screen.plan.activity.id });
        setScreen({ kind: 'dashboard' });
        return;
      }
      if (input === ' ') {
        const elapsed = now - screen.startedAt + sessionOffset.current;
        sessionOffset.current += nextStepStart(screen.plan, elapsed) - elapsed;
      }
      return;
    }

    if (screen.kind === 'picker') {
      const groups = groupActivities(selectable, dueIds);
      if (groups.length === 0) {
        setScreen({ kind: 'dashboard' });
        return;
      }

      const groupIndex = Math.min(screen.groupIndex, groups.length - 1);
      const inGroup = groups[groupIndex]!.activities;
      const activityIndex = Math.min(screen.activityIndex, inGroup.length - 1);

      if (key.escape || input === 'q') {
        setScreen({ kind: 'dashboard' });
        return;
      }

      // One axis each: left and right change group, up and down walk the
      // list. There is no second focus to lose track of.
      const sideways =
        key.rightArrow || input === 'l' ? 1 : key.leftArrow || input === 'h' ? -1 : 0;
      if (sideways !== 0 || key.tab) {
        const step = key.tab ? (key.shift ? -1 : 1) : sideways;
        const next = (groupIndex + step + groups.length) % groups.length;
        setScreen({ ...screen, groupIndex: next, activityIndex: 0 });
        return;
      }

      const vertical = key.downArrow || input === 'j' ? 1 : key.upArrow || input === 'k' ? -1 : 0;
      if (vertical !== 0) {
        // Stops at the ends rather than wrapping: an arrow held down should
        // settle on the last item, not cycle past it.
        const next = Math.max(0, Math.min(inGroup.length - 1, activityIndex + vertical));
        setScreen({ ...screen, groupIndex, activityIndex: next });
        return;
      }

      if (key.return) {
        const chosen = inGroup[activityIndex];
        if (chosen) start(chosen);
      }
      return;
    }

    if (screen.kind === 'nudge') {
      const activity = screen.activity;

      // "Something else" opens the menu, rather than cycling through the
      // alternatives one at a time here. Two ways to browse the same list is
      // one way too many, and the menu shows you what you are choosing.
      if (key.tab) {
        setScreen({ kind: 'picker', ...locateActivity(selectable, activity.id) });
        return;
      }

      if (key.return || (activity.instant && input === ' ')) {
        start(activity);
        return;
      }
      if (input === 's') {
        record({
          ts: Date.now(),
          type: 'snoozed',
          activity: activity.id,
          meta: { untilTs: Date.now() + SNOOZE_MINUTES * 60_000 },
        });
        setScreen({ kind: 'dashboard' });
        return;
      }
      if (input === 'd') {
        record({
          ts: Date.now(),
          type: 'skipped',
          activity: activity.id,
          meta: { scope: 'day' },
        });
        setScreen({ kind: 'dashboard' });
        return;
      }
      if (key.escape || input === 'q') {
        setScreen({ kind: 'dashboard' });
        return;
      }
      return;
    }

    // Dashboard.
    if (input === 'q') {
      exit();
      return;
    }
    if (input === 'w') {
      const water = getActivity('water');
      if (water) {
        record({ ts: Date.now(), type: 'completed', activity: water.id, meta: { count: 1 } });
      }
      return;
    }
    if (input === 'n' || input === 'p') {
      // Choose deliberately rather than accepting whatever is next in line.
      if (selectable.length > 0) {
        setScreen({ kind: 'picker', groupIndex: 0, activityIndex: 0 });
      }
    }
  });

  const hydrationRing = rings.find((r) => r.group === 'hydration');

  return (
    <Box flexDirection="column" padding={1}>
      {screen.kind === 'dashboard' && (
        <Dashboard
          rings={rings}
          streaks={streaks}
          level={level}
          pet={pet}
          petEnabled={config.gamification.enabled}
          nextDue={upcoming}
          claude={claude}
          tier={tier}
          pane={pane}
        />
      )}

      {screen.kind === 'nudge' && (
        <Nudge
          activity={screen.activity}
          overdueMinutes={screen.overdueMinutes}
          tier={tier}
          pane={pane}
          instantProgress={
            screen.activity.instant && hydrationRing
              ? { done: hydrationRing.done, goal: hydrationRing.goal }
              : undefined
          }
        />
      )}

      {screen.kind === 'picker' && (
        <Picker
          activities={selectable}
          dueIds={dueIds}
          autoIds={autoIds}
          groupIndex={screen.groupIndex}
          activityIndex={screen.activityIndex}
          tier={tier}
          pane={pane}
        />
      )}

      {screen.kind === 'session' &&
        (() => {
          const elapsed = now - screen.startedAt + sessionOffset.current;
          return (
            <Session
              plan={screen.plan}
              state={sessionStateAt(screen.plan, elapsed)}
              tier={tier}
              pane={pane}
              elapsedMs={elapsed}
            />
          );
        })()}

      {screen.kind === 'complete' && (
        <SessionComplete title={screen.title} xp={screen.xp} tier={tier} />
      )}

      {tooNarrow && (
        <Text color={COLORS.faint}>(widen the pane for the full view)</Text>
      )}
    </Box>
  );
}

function xpFor(activity: Activity): number {
  return XP_BY_GROUP[activity.group];
}
