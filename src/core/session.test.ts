import { describe, expect, it } from 'vitest';
import { ACTIVITIES, getActivity } from './activities.js';
import { getSprite } from '../sprites/index.js';
import { buildPlan, frameFor, nextStepStart, repProgress, sessionStateAt } from './session.js';
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

describe('repProgress', () => {
  it('sweeps 0 to 1 across a single rep', () => {
    const plan = buildPlan(twoStep); // 3000ms, one rep
    expect(repProgress(plan, 0)).toBe(0);
    expect(repProgress(plan, 1500)).toBe(0.5);
  });

  it('restarts each repetition', () => {
    const plan = buildPlan({ ...twoStep, reps: 2 }); // 6000ms, 3000 per rep
    expect(repProgress(plan, 1500)).toBe(0.5);
    expect(repProgress(plan, 3000)).toBe(0); // second rep begins
    expect(repProgress(plan, 4500)).toBe(0.5);
  });

  it('clamps outside the session', () => {
    const plan = buildPlan(twoStep);
    expect(repProgress(plan, -100)).toBe(0);
    expect(repProgress(plan, 99999)).toBe(0);
  });
});

describe('frameFor', () => {
  const stretch = buildPlan(twoStep);
  const breath = buildPlan({ ...twoStep, smoothSprite: true });

  it('holds one frame per step for ordinary activities', () => {
    // Step 0 for the first second, step 1 after that.
    expect(frameFor(stretch, sessionStateAt(stretch, 0), 4, 0)).toBe(0);
    expect(frameFor(stretch, sessionStateAt(stretch, 500), 4, 500)).toBe(0);
    expect(frameFor(stretch, sessionStateAt(stretch, 1500), 4, 1500)).toBe(1);
  });

  it('advances continuously through the strip for smooth activities', () => {
    // The whole point: a breathing sprite must keep moving *within* a step,
    // not sit still while you are told to inhale.
    const frames = [0, 400, 800, 1200, 1600, 2000, 2400, 2800].map((t) =>
      frameFor(breath, sessionStateAt(breath, t), 8, t),
    );
    expect(frames).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('never runs off the end of the strip', () => {
    expect(frameFor(breath, sessionStateAt(breath, 3000), 8, 3000)).toBe(7);
    expect(frameFor(breath, sessionStateAt(breath, 99999), 8, 99999)).toBe(7);
  });

  it('cycles the strip once per repetition', () => {
    const twoReps = buildPlan({ ...twoStep, smoothSprite: true, reps: 2 });
    expect(frameFor(twoReps, sessionStateAt(twoReps, 0), 4, 0)).toBe(0);
    expect(frameFor(twoReps, sessionStateAt(twoReps, 3000), 4, 3000)).toBe(0);
  });

  it('copes with a sprite that has no frames', () => {
    expect(frameFor(stretch, sessionStateAt(stretch, 0), 0, 0)).toBe(0);
  });
});

describe('every activity shows the right picture for the words', () => {
  /**
   * The bug this exists to prevent: several stretches had five instruction
   * steps and a two-frame sprite, so playback cycled 0,1,0,1,0 and step three
   * displayed the pose for step one. The art contradicted the caption, which
   * makes an exercise impossible to follow however detailed it is.
   */
  it.each(ACTIVITIES.filter((a) => !a.instant).map((a) => [a.id] as const))('%s', (id) => {
    const activity = getActivity(id)!;
    const plan = buildPlan(activity);
    const frames = getSprite(activity.sprite).frames.length;

    const seen = new Map<number, Set<number>>();
    for (const entry of plan.entries.filter((e) => e.rep === 0)) {
      const mid = (entry.startMs + entry.endMs) / 2;
      const frame = frameFor(plan, sessionStateAt(plan, mid), frames, mid);
      if (!seen.has(entry.stepIndex)) seen.set(entry.stepIndex, new Set());
      seen.get(entry.stepIndex)!.add(frame);
    }

    // Every step must land on art of its own, never reuse another step's.
    const used = [...seen.values()].flatMap((s) => [...s]);
    expect(new Set(used).size, `${id} reuses art across steps`).toBe(used.length);
  });

  it.each(
    ACTIVITIES.filter((a) => a.framesPerStep).map((a) => [a.id] as const),
  )('%s has enough frames for all its steps', (id) => {
    const activity = getActivity(id)!;
    const frames = getSprite(activity.sprite).frames.length;
    expect(frames).toBe(activity.steps.length * activity.framesPerStep!);
  });

  it('animates within a step rather than snapping to a static pose', () => {
    // The in-between frames are the part you actually copy.
    const activity = getActivity('exercise-squats')!;
    const plan = buildPlan(activity);
    const frames = getSprite(activity.sprite).frames.length;
    const step = plan.entries[0]!;

    const early = frameFor(plan, sessionStateAt(plan, step.startMs), frames, step.startMs);
    const late = frameFor(
      plan,
      sessionStateAt(plan, step.endMs - 1),
      frames,
      step.endMs - 1,
    );
    expect(late).toBeGreaterThan(early);
  });
});

describe('breathing sprites stay in step with their instructions', () => {
  it('shows a different frame at the start and end of every breathing step', () => {
    for (const id of ['breathe-box', 'breathe-sigh']) {
      const activity = getActivity(id)!;
      expect(activity.smoothSprite, `${id} should sweep smoothly`).toBe(true);

      const plan = buildPlan(activity);
      const frames = getSprite(activity.sprite).frames.length;

      for (const step of plan.entries.filter((e) => e.rep === 0)) {
        const atStart = frameFor(plan, sessionStateAt(plan, step.startMs), frames, step.startMs);
        const nearEnd = step.endMs - 1;
        const atEnd = frameFor(plan, sessionStateAt(plan, nearEnd), frames, nearEnd);
        expect(atEnd, `${id} step "${step.label}" never advances`).toBeGreaterThan(atStart);
      }
    }
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
