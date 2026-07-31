import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { getActivity } from '../core/activities.js';
import { buildPlan, sessionStateAt } from '../core/session.js';
import type { Ring } from '../core/progress.js';
import { Dashboard } from './Dashboard.js';
import { Nudge } from './Nudge.js';
import { Picker, groupActivities } from './Picker.js';
import { Rings } from './Rings.js';
import { Session, SessionComplete } from './Session.js';
import { bar, formatMinutes, tierFor } from './theme.js';

/** Strip ANSI so assertions are about content, not colour codes. */
function plain(output: string | undefined): string {
  // eslint-disable-next-line no-control-regex
  return (output ?? '').replace(/\[[0-9;]*m/g, '');
}

const rings: Ring[] = [
  { group: 'hydration', done: 4, goal: 8, progress: 0.5, closed: false },
  { group: 'stretch', done: 6, goal: 6, progress: 1, closed: true },
];

describe('tierFor', () => {
  it('picks a layout from the pane width', () => {
    expect(tierFor(120)).toBe('full');
    expect(tierFor(80)).toBe('full');
    expect(tierFor(79)).toBe('compact');
    expect(tierFor(50)).toBe('compact');
    expect(tierFor(49)).toBe('minimal');
    expect(tierFor(20)).toBe('minimal');
  });
});

describe('bar', () => {
  it('fills proportionally', () => {
    expect(bar(0, 4)).toBe('░░░░');
    expect(bar(0.5, 4)).toBe('██░░');
    expect(bar(1, 4)).toBe('████');
  });

  it('clamps out-of-range progress', () => {
    expect(bar(-1, 4)).toBe('░░░░');
    expect(bar(5, 4)).toBe('████');
  });
});

describe('formatMinutes', () => {
  it('reads forwards and backwards', () => {
    expect(formatMinutes(12)).toBe('in 12m');
    expect(formatMinutes(-3)).toBe('3m overdue');
  });

  it('breaks out hours', () => {
    expect(formatMinutes(90)).toBe('in 1h 30m');
  });
});

describe('Rings', () => {
  it('shows each group with its progress', () => {
    const { lastFrame } = render(<Rings rings={rings} tier="full" />);
    const out = plain(lastFrame());
    expect(out).toContain('Hydration');
    expect(out).toContain('4/8');
    expect(out).toContain('6/6');
  });

  it('marks closed rings', () => {
    expect(plain(render(<Rings rings={rings} tier="full" />).lastFrame())).toContain('✓');
  });

  it('collapses to glyphs and fractions when the pane is narrow', () => {
    const out = plain(render(<Rings rings={rings} tier="minimal" />).lastFrame());
    expect(out).toContain('4/8');
    expect(out).not.toContain('Hydration');
  });

  it('tells the user how to fix an empty routine', () => {
    const out = plain(render(<Rings rings={[]} tier="full" />).lastFrame());
    expect(out).toContain('wellness config');
  });
});

describe('Dashboard', () => {
  const props = {
    rings,
    streaks: { current: 3, longest: 9 },
    level: { level: 4, xp: 500, intoLevel: 50, levelSpan: 250, progress: 0.2 },
    pet: { mood: 'ok' as const, adherence: 0.5, message: 'Doing alright.' },
    petEnabled: true,
    nextDue: { group: 'eyes' as const, minutes: 12 },
    claude: 'idle' as const,
    tier: 'full' as const,
  };

  it('shows streak, level and what is coming next', () => {
    const out = plain(render(<Dashboard {...props} />).lastFrame());
    expect(out).toContain('3 day streak');
    expect(out).toContain('Level 4');
    expect(out).toContain('eyes');
    expect(out).toContain('in 12m');
  });

  it('surfaces when Claude is working', () => {
    const out = plain(render(<Dashboard {...props} claude="busy" />).lastFrame());
    expect(out).toContain('claude is thinking');
  });

  it('shows the best streak only when it beats the current one', () => {
    expect(plain(render(<Dashboard {...props} />).lastFrame())).toContain('best 9');
    const equal = { ...props, streaks: { current: 9, longest: 9 } };
    expect(plain(render(<Dashboard {...equal} />).lastFrame())).not.toContain('best 9');
  });

  it('hides the pet when gamification is switched off', () => {
    const out = plain(render(<Dashboard {...props} petEnabled={false} />).lastFrame());
    expect(out).not.toContain('Doing alright.');
  });

  it('always shows the keybinding footer', () => {
    expect(plain(render(<Dashboard {...props} />).lastFrame())).toContain('[q]');
    const narrow = plain(render(<Dashboard {...props} tier="minimal" />).lastFrame());
    expect(narrow).toContain('[q]');
  });
});

describe('Nudge', () => {
  const stretch = getActivity('stretch-wrists')!;
  const water = getActivity('water')!;

  it('shows the title and the reason', () => {
    const out = plain(
      render(<Nudge activity={stretch} overdueMinutes={5} tier="full" />).lastFrame(),
    );
    expect(out).toContain('Wrist & finger stretch');
    expect(out).toContain('RSI');
  });

  it('offers start for a guided activity', () => {
    const out = plain(
      render(<Nudge activity={stretch} overdueMinutes={0} tier="full" />).lastFrame(),
    );
    expect(out).toContain('[enter] start');
  });

  it('offers a single keypress for an instant activity', () => {
    const out = plain(
      render(<Nudge activity={water} overdueMinutes={0} tier="full" />).lastFrame(),
    );
    expect(out).toContain('[space] log it');
  });

  it('always offers a way out', () => {
    const out = plain(
      render(<Nudge activity={stretch} overdueMinutes={0} tier="full" />).lastFrame(),
    );
    expect(out).toContain('[s] snooze');
    expect(out).toContain('[d] not today');
  });

  it('shows cup progress for hydration', () => {
    const out = plain(
      render(
        <Nudge
          activity={water}
          overdueMinutes={0}
          tier="full"
          instantProgress={{ done: 3, goal: 8 }}
        />,
      ).lastFrame(),
    );
    expect(out).toContain('3/8');
    expect(out).toContain('●●●');
  });

  it('drops the sprite in the narrowest layout but keeps the message', () => {
    const out = plain(
      render(<Nudge activity={stretch} overdueMinutes={0} tier="minimal" />).lastFrame(),
    );
    expect(out).toContain('Wrist & finger stretch');
    expect(out).not.toContain('▀');
  });
});

describe('Picker', () => {
  const activities = [
    getActivity('exercise-squats')!,
    getActivity('exercise-plank')!,
    getActivity('stretch-wrists')!,
    getActivity('posture-check')!,
  ];
  const due = new Set(['exercise-squats']);
  // Posture is off the routine by default: startable, but never reminded.
  const auto = new Set(['exercise-squats', 'exercise-plank', 'stretch-wrists']);

  const props = {
    activities,
    dueIds: due,
    autoIds: auto,
    column: 'activities' as const,
    groupIndex: 0,
    activityIndex: 0,
    tier: 'full' as const,
  };

  it('groups activities so the grid never grows with the catalogue', () => {
    const grouped = groupActivities(activities, due, auto);
    expect(grouped.map((g) => g.group)).toEqual(['exercise', 'stretch', 'posture']);
    expect(grouped[0]!.activities).toHaveLength(2);
  });

  it('counts what is due and what is automatic per group', () => {
    const grouped = groupActivities(activities, due, auto);
    expect(grouped[0]!.dueCount).toBe(1);
    expect(grouped[0]!.autoCount).toBe(2);
    expect(grouped[2]!.autoCount).toBe(0);
  });

  it('shows every group as a tab', () => {
    const out = plain(render(<Picker {...props} />).lastFrame());
    expect(out).toContain('Exercise');
    expect(out).toContain('Stretch');
    expect(out).toContain('Posture');
  });

  it("shows the selected group's activities and no others", () => {
    const out = plain(render(<Picker {...props} />).lastFrame());
    expect(out).toContain('Squats');
    expect(out).toContain('Plank');
    expect(out).not.toContain('Wrists');
  });

  it('follows the group selection', () => {
    const out = plain(render(<Picker {...props} groupIndex={1} />).lastFrame());
    expect(out).toContain('Wrists');
    expect(out).not.toContain('Squats');
  });

  it('gives every tile its own art', () => {
    // Each tile renders a downscaled sprite, so half-block glyphs appear
    // whether or not anything is selected.
    const out = plain(render(<Picker {...props} />).lastFrame());
    expect(out).toContain('▀');
  });

  it('says which activities are reminded automatically', () => {
    const onRoutine = plain(render(<Picker {...props} />).lastFrame());
    expect(onRoutine).toContain('auto');

    // Posture is off the routine — still listed, marked manual.
    const manual = plain(render(<Picker {...props} groupIndex={2} />).lastFrame());
    expect(manual).toContain('Posture');
    expect(manual).toContain('manual');
  });

  it('summarises how much of the catalogue is on the routine', () => {
    const out = plain(render(<Picker {...props} />).lastFrame());
    expect(out).toContain('3 auto');
    expect(out).toContain('1 manual');
  });

  it('flags what is due now', () => {
    expect(plain(render(<Picker {...props} />).lastFrame())).toContain('due now');
  });

  it('marks the selected tile with a filled band', () => {
    const frame = render(<Picker {...props} />).lastFrame() ?? '';
    expect(frame).toMatch(/\[4[0-8][;m]/);
  });

  it('narrows the grid rather than shrinking the tiles', () => {
    // The art stops meaning anything below a certain size, so fewer columns is
    // the right trade in a narrow pane.
    for (const tier of ['full', 'compact', 'minimal'] as const) {
      const out = plain(render(<Picker {...props} tier={tier} />).lastFrame());
      expect(out, tier).toContain('Squats');
      expect(out, tier).toContain('▀');
    }
  });

  it('explains how to fix an empty routine', () => {
    const out = plain(
      render(<Picker {...props} activities={[]} dueIds={new Set()} autoIds={new Set()} />).lastFrame(),
    );
    expect(out).toContain('wellness config');
  });
});

describe('Session', () => {
  const squats = getActivity('exercise-squats')!;
  const plan = buildPlan(squats);

  it('shows the current instruction and countdown', () => {
    const out = plain(
      render(<Session plan={plan} state={sessionStateAt(plan, 0)} tier="full" elapsedMs={0} />).lastFrame(),
    );
    expect(out).toContain('Stand up');
    expect(out).toContain('2s');
  });

  it('shows the rep counter for rep-based activities', () => {
    const out = plain(
      render(<Session plan={plan} state={sessionStateAt(plan, 0)} tier="full" elapsedMs={0} />).lastFrame(),
    );
    expect(out).toContain('rep 1/10');
  });

  it('advances the rep counter as the session runs', () => {
    const out = plain(
      render(<Session plan={plan} state={sessionStateAt(plan, 4500)} tier="full" elapsedMs={4500} />).lastFrame(),
    );
    expect(out).toContain('rep 2/10');
  });

  it('omits the rep counter for a single-pass activity', () => {
    const plank = buildPlan(getActivity('exercise-plank')!);
    const out = plain(
      render(<Session plan={plank} state={sessionStateAt(plank, 0)} tier="full" elapsedMs={0} />).lastFrame(),
    );
    expect(out).not.toContain('rep ');
  });

  it('offers a way to stop', () => {
    const out = plain(
      render(<Session plan={plan} state={sessionStateAt(plan, 0)} tier="full" elapsedMs={0} />).lastFrame(),
    );
    expect(out).toContain('[q] stop');
  });
});

describe('SessionComplete', () => {
  it('confirms the activity and the reward', () => {
    const out = plain(render(<SessionComplete title="Plank" xp={25} tier="full" />).lastFrame());
    expect(out).toContain('Plank');
    expect(out).toContain('+25 xp');
  });
});
