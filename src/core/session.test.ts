import { describe, expect, it } from 'vitest';
import { ACTIVITIES, getActivity } from './activities.js';
import { buildPlan, nextStepStart, sessionStateAt } from './session.js';
import type { Activity } from './types.js';

const twoStep: Activity = {
  id: 'test',
  group: 'stretch',
  title: 'Test',
  cue: 'cue',
  sprite: 'wrists',
  steps: [
    { label: 'A', durationMs: 1000 },
    { label: 'B', durationMs: 2000 },
  ],
};

describe('buildPlan', () => {
  it('lays steps out end to end', () => {
    const plan = buildPlan(twoStep);
    expect(plan.entries).toHaveLength(2);
    expect(plan.entries[0]).toMatchObject({ label: 'A', startMs: 0, endMs: 1000 });
    expect(plan.entries[1]).toMatchObject({ label: 'B', startMs: 1000, endMs: 3000 });
    expect(plan.totalMs).toBe(3000);
  });

  it('repeats the steps for a rep-based activity', () => {
    const plan = buildPlan({ ...twoStep, reps: 3 });
    expect(plan.entries).toHaveLength(6);
    expect(plan.totalMs).toBe(9000);
    expect(plan.reps).toBe(3);
  });

  it('tags each entry with its rep and source step', () => {
    const plan = buildPlan({ ...twoStep, reps: 2 });
    expect(plan.entries.map((e) => e.rep)).toEqual([0, 0, 1, 1]);
    expect(plan.entries.map((e) => e.stepIndex)).toEqual([0, 1, 0, 1]);
  });

  it('treats a missing rep count as one', () => {
    expect(buildPlan(twoStep).reps).toBe(1);
  });

  it('guards against a zero-length step, which would divide by zero', () => {
    const plan = buildPlan({ ...twoStep, steps: [{ label: 'X', durationMs: 0 }] });
    expect(plan.totalMs).toBeGreaterThan(0);
    expect(() => sessionStateAt(plan, 0)).not.toThrow();
  });
});

describe('sessionStateAt', () => {
  const plan = buildPlan(twoStep);

  it('starts on the first step', () => {
    const state = sessionStateAt(plan, 0);
    expect(state.entry.label).toBe('A');
    expect(state.stepProgress).toBe(0);
    expect(state.finished).toBe(false);
  });

  it('reports progress through the current step', () => {
    expect(sessionStateAt(plan, 500).stepProgress).toBe(0.5);
    expect(sessionStateAt(plan, 2000).stepProgress).toBe(0.5); // halfway through B
  });

  it('advances to the next step at the boundary', () => {
    expect(sessionStateAt(plan, 999).entry.label).toBe('A');
    expect(sessionStateAt(plan, 1000).entry.label).toBe('B');
  });

  it('reports overall progress', () => {
    expect(sessionStateAt(plan, 1500).totalProgress).toBe(0.5);
  });

  it('counts down whole seconds within a step', () => {
    expect(sessionStateAt(plan, 0).secondsLeft).toBe(1);
    expect(sessionStateAt(plan, 1000).secondsLeft).toBe(2);
    expect(sessionStateAt(plan, 2500).secondsLeft).toBe(1);
  });

  it('finishes at the end and stays finished', () => {
    expect(sessionStateAt(plan, 3000).finished).toBe(true);
    expect(sessionStateAt(plan, 99999).finished).toBe(true);
    expect(sessionStateAt(plan, 99999).totalProgress).toBe(1);
  });

  it('clamps negative elapsed time to the start', () => {
    expect(sessionStateAt(plan, -500).entry.label).toBe('A');
    expect(sessionStateAt(plan, -500).stepProgress).toBe(0);
  });
});

describe('nextStepStart', () => {
  const plan = buildPlan(twoStep);

  it('jumps to the end of the current step', () => {
    expect(nextStepStart(plan, 0)).toBe(1000);
    expect(nextStepStart(plan, 1500)).toBe(3000);
  });

  it('cannot advance past the end', () => {
    expect(nextStepStart(plan, 5000)).toBe(3000);
  });
});

describe('every shipped activity produces a usable session', () => {
  it.each(ACTIVITIES.map((a) => [a.id] as const))('%s', (id) => {
    const activity = getActivity(id)!;
    const plan = buildPlan(activity);

    expect(plan.entries.length).toBeGreaterThan(0);
    expect(plan.totalMs).toBeGreaterThan(0);
    // Nothing should demand more than five minutes of a working day.
    expect(plan.totalMs).toBeLessThanOrEqual(5 * 60 * 1000);
    expect(sessionStateAt(plan, 0).finished).toBe(false);
    expect(sessionStateAt(plan, plan.totalMs).finished).toBe(true);
  });
});
