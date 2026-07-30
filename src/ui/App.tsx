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
import { Box, Text, useApp, useInput, useStdout } from 'ink';
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
import { decide, nextDueIn, pickActivity } from '../core/scheduler.js';
import type { Activity, ClaudeState, Config, LogEvent } from '../core/types.js';
import { ClaudeSignal } from '../claude/signal.js';
import { appendEvent, loadLog } from '../store/log.js';
import { loadConfig } from '../store/config.js';
import { Dashboard } from './Dashboard.js';
import { Nudge } from './Nudge.js';
import { Session, SessionComplete } from './Session.js';
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
  | { readonly kind: 'session'; readonly plan: SessionPlan; readonly startedAt: number }
  | { readonly kind: 'complete'; readonly title: string; readonly xp: number; readonly at: number };

export interface AppProps {
  readonly env?: NodeJS.ProcessEnv;
}

export function App({ env }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [config, setConfig] = useState<Config>(() => loadConfig(env));
  const [events, setEvents] = useState<LogEvent[]>(() => loadLog(env));
  const [claude, setClaude] = useState<ClaudeState>('idle');
  const [now, setNow] = useState(() => Date.now());
  const [screen, setScreen] = useState<Screen>({ kind: 'dashboard' });
  const [columns, setColumns] = useState(stdout?.columns ?? 80);

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

  // Pane resizes are common when the user rearranges splits.
  useEffect(() => {
    if (!stdout) return;
    const onResize = (): void => setColumns(stdout.columns ?? 80);
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  // Pick up config edits made by `wellness config` in another pane.
  useEffect(() => {
    const timer = setInterval(() => setConfig(loadConfig(env)), 5000);
    return () => clearInterval(timer);
  }, [env]);

  const tier = tierFor(columns);

  const rings = useMemo(() => ringsFor(events, config, now), [events, config, now]);
  const streaks = useMemo(() => computeStreaks(events, config, now), [events, config, now]);
  const level = useMemo(() => computeLevel(totalXp(events)), [events]);
  const pet = useMemo(() => computePet(events, config, now), [events, config, now]);
  const upcoming = useMemo(
    () => nextDueIn(events, config, now, sessionStart),
    [events, config, now, sessionStart],
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
    setScreen({
      kind: 'nudge',
      activity: decision.nudge.activity,
      overdueMinutes: decision.nudge.overdueMinutes,
    });
  }, [screen.kind, events, config, claude, now, sessionStart, record]);

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

    if (screen.kind === 'nudge') {
      const activity = screen.activity;

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
    if (input === 'n') {
      // "Do one now" — pull the next thing forward rather than waiting.
      const target = upcoming ? pickActivity(events, config, upcoming.group) : null;
      if (target) start(target);
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
        />
      )}

      {screen.kind === 'nudge' && (
        <Nudge
          activity={screen.activity}
          overdueMinutes={screen.overdueMinutes}
          tier={tier}
          instantProgress={
            screen.activity.instant && hydrationRing
              ? { done: hydrationRing.done, goal: hydrationRing.goal }
              : undefined
          }
        />
      )}

      {screen.kind === 'session' && (
        <Session
          plan={screen.plan}
          state={sessionStateAt(screen.plan, now - screen.startedAt + sessionOffset.current)}
          tier={tier}
        />
      )}

      {screen.kind === 'complete' && (
        <SessionComplete title={screen.title} xp={screen.xp} tier={tier} />
      )}

      {tier === 'minimal' && columns < 30 && (
        <Text color={COLORS.faint}>(widen the pane for the full view)</Text>
      )}
    </Box>
  );
}

function xpFor(activity: Activity): number {
  return XP_BY_GROUP[activity.group];
}
