import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { getActivity } from '../core/activities.js';
import { buildPlan, sessionStateAt } from '../core/session.js';
import type { Ring } from '../core/progress.js';
import { Dashboard } from './Dashboard.js';
import { Nudge } from './Nudge.js';
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

describe('Session', () => {
  const squats = getActivity('exercise-squats')!;
  const plan = buildPlan(squats);

  it('shows the current instruction and countdown', () => {
    const out = plain(
      render(<Session plan={plan} state={sessionStateAt(plan, 0)} tier="full" />).lastFrame(),
    );
    expect(out).toContain('Stand up');
    expect(out).toContain('2s');
  });

  it('shows the rep counter for rep-based activities', () => {
    const out = plain(
      render(<Session plan={plan} state={sessionStateAt(plan, 0)} tier="full" />).lastFrame(),
    );
    expect(out).toContain('rep 1/10');
  });

  it('advances the rep counter as the session runs', () => {
    const out = plain(
      render(<Session plan={plan} state={sessionStateAt(plan, 4500)} tier="full" />).lastFrame(),
    );
    expect(out).toContain('rep 2/10');
  });

  it('omits the rep counter for a single-pass activity', () => {
    const plank = buildPlan(getActivity('exercise-plank')!);
    const out = plain(
      render(<Session plan={plank} state={sessionStateAt(plank, 0)} tier="full" />).lastFrame(),
    );
    expect(out).not.toContain('rep ');
  });

  it('offers a way to stop', () => {
    const out = plain(
      render(<Session plan={plan} state={sessionStateAt(plan, 0)} tier="full" />).lastFrame(),
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
