/**
 * Guided-session timing.
 *
 * An activity's steps are flattened into a timeline once, up front, and the
 * UI just asks "where am I at t milliseconds?". Keeping this pure means the
 * pacing — which is the actual product for a stretch or a breathing exercise —
 * can be tested exactly, without waiting on real time.
 */

import type { Activity } from './types.js';

export interface TimelineEntry {
  readonly label: string;
  /** Which repetition this belongs to, 0-indexed. */
  readonly rep: number;
  /** Index of the source step, used to drive the sprite frame. */
  readonly stepIndex: number;
  readonly startMs: number;
  readonly endMs: number;
}

export interface SessionPlan {
  readonly activity: Activity;
  readonly entries: readonly TimelineEntry[];
  readonly totalMs: number;
  readonly reps: number;
}

/** Flatten steps × reps into an absolute timeline. */
export function buildPlan(activity: Activity): SessionPlan {
  const reps = Math.max(1, activity.reps ?? 1);
  const entries: TimelineEntry[] = [];
  let cursor = 0;

  for (let rep = 0; rep < reps; rep++) {
    activity.steps.forEach((step, stepIndex) => {
      const duration = Math.max(1, step.durationMs);
      entries.push({
        label: step.label,
        rep,
        stepIndex,
        startMs: cursor,
        endMs: cursor + duration,
      });
      cursor += duration;
    });
  }

  return { activity, entries, totalMs: cursor, reps };
}

export interface SessionState {
  readonly entry: TimelineEntry;
  readonly entryIndex: number;
  /** 0..1 through the current step. */
  readonly stepProgress: number;
  /** 0..1 through the whole session. */
  readonly totalProgress: number;
  /** Whole seconds left in the current step, for the countdown. */
  readonly secondsLeft: number;
  readonly finished: boolean;
}

/** Where the session is at `elapsedMs`. Clamps at both ends. */
export function sessionStateAt(plan: SessionPlan, elapsedMs: number): SessionState {
  const clamped = Math.max(0, elapsedMs);

  if (clamped >= plan.totalMs) {
    const last = plan.entries[plan.entries.length - 1]!;
    return {
      entry: last,
      entryIndex: plan.entries.length - 1,
      stepProgress: 1,
      totalProgress: 1,
      secondsLeft: 0,
      finished: true,
    };
  }

  const entryIndex = plan.entries.findIndex((e) => clamped < e.endMs);
  const entry = plan.entries[entryIndex]!;
  const span = entry.endMs - entry.startMs;

  return {
    entry,
    entryIndex,
    stepProgress: (clamped - entry.startMs) / span,
    totalProgress: clamped / plan.totalMs,
    secondsLeft: Math.ceil((entry.endMs - clamped) / 1000),
    finished: false,
  };
}

/**
 * Progress through the current repetition, 0..1.
 *
 * Breathing exercises are paced by *watching* the sprite, so their art has to
 * move continuously rather than snapping once per step. Indexing frames by step
 * means the box sits still while you're told to inhale — the one moment the
 * animation exists to drive.
 *
 * Every rep runs the same steps, so a rep is a fixed slice of the total.
 */
export function repProgress(plan: SessionPlan, elapsedMs: number): number {
  const repDuration = plan.totalMs / plan.reps;
  if (repDuration <= 0) return 0;
  const clamped = Math.max(0, Math.min(elapsedMs, plan.totalMs));
  return (clamped % repDuration) / repDuration;
}

/**
 * Which sprite frame to show at a given moment.
 *
 * Smooth activities sweep the whole strip across one rep; everything else holds
 * one frame per step, which is what a stretch demo wants — you should be able
 * to look away and look back without missing the pose.
 */
export function frameFor(
  plan: SessionPlan,
  state: SessionState,
  frameCount: number,
  elapsedMs: number,
): number {
  if (frameCount <= 0) return 0;

  if (plan.activity.smoothSprite) {
    const progress = state.finished ? 1 : repProgress(plan, elapsedMs);
    return Math.min(frameCount - 1, Math.floor(progress * frameCount));
  }

  return state.entry.stepIndex % frameCount;
}

/** Elapsed time at which the next step begins — used by "skip step". */
export function nextStepStart(plan: SessionPlan, elapsedMs: number): number {
  const state = sessionStateAt(plan, elapsedMs);
  if (state.finished) return plan.totalMs;
  return state.entry.endMs;
}
