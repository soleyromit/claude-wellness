import React from 'react';
import { EventEmitter } from 'node:events';
import { Text, render as inkRender } from 'ink';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { ACTIVITIES, activitiesInGroup, getActivity } from '../core/activities.js';
import { buildPlan, sessionStateAt } from '../core/session.js';
import type { Ring } from '../core/progress.js';
import { ACTIVITY_GROUPS } from '../core/types.js';
import { spriteLineHeight } from '../render/pixel.js';
import { getSprite } from '../sprites/index.js';
import { ConfigEditor } from './ConfigEditor.js';
import { Dashboard } from './Dashboard.js';
import { Nudge } from './Nudge.js';
import { Picker, groupActivities, locateActivity } from './Picker.js';
import { Rings } from './Rings.js';
import { Session, SessionComplete } from './Session.js';
import { Sprite } from './Sprite.js';
import { bar, formatMinutes, textRows, tierFor } from './theme.js';

/** Strip ANSI so assertions are about content, not colour codes. */
function plain(output: string | undefined): string {
  // eslint-disable-next-line no-control-regex
  return (output ?? '').replace(/\[[0-9;]*m/g, '');
}

/** Terminal lines a rendered frame occupies. */
function heightOf(output: string | undefined): number {
  return plain(output).split('\n').length;
}

/**
 * Panes worth checking. Text wraps against the real pane width, so a height
 * test that rendered at some other width would be measuring a layout nobody
 * has. 100x40 is a roomy window, 80x30 a normal one, 60x24 the classic
 * terminal, and the last two are side panes — all of which people run.
 */
const PANES = [
  { columns: 100, rows: 40 },
  { columns: 80, rows: 30 },
  { columns: 60, rows: 24 },
  { columns: 44, rows: 18 },
  { columns: 32, rows: 14 },
] as const;

class FakeStdout extends EventEmitter {
  readonly frames: string[] = [];
  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    super();
  }
  write = (frame: string): void => {
    this.frames.push(frame);
  };
}

class FakeStdin extends EventEmitter {
  isTTY = true;
  setEncoding(): void {}
  setRawMode(): void {}
  resume(): void {}
  pause(): void {}
  ref(): void {}
  unref(): void {}
  read(): null {
    return null;
  }
}

/**
 * Render at a specific pane size. `ink-testing-library` is fixed at 100
 * columns, which is exactly the case these tests are not about.
 */
function frameAt(node: React.ReactElement, columns: number, rows: number): string {
  const stdout = new FakeStdout(columns, rows);
  const instance = inkRender(node, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: new FakeStdin() as unknown as NodeJS.ReadStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  const frame = plain(stdout.frames[stdout.frames.length - 1]);
  instance.unmount();
  return frame;
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

  it('drops a tier when the pane is short, not only when it is narrow', () => {
    expect(tierFor(120, 40)).toBe('full');
    expect(tierFor(120, 20)).toBe('compact');
    expect(tierFor(120, 12)).toBe('minimal');
  });

  it('takes whichever axis is tighter', () => {
    expect(tierFor(60, 40)).toBe('compact');
    expect(tierFor(120, 12)).toBe('minimal');
  });
});

describe('textRows', () => {
  it('counts one row for text that fits', () => {
    expect(textRows('hello', 20)).toBe(1);
    expect(textRows('hello', 5)).toBe(1);
  });

  it('counts more than one row for text that does not fit', () => {
    expect(textRows('one two three four', 9)).toBeGreaterThan(1);
    expect(textRows('antidisestablishmentarianism', 10)).toBeGreaterThan(1);
  });

  // The whole point of this helper is to predict what Ink will do, so check it
  // against Ink rather than against a hand-count.
  it('agrees with how Ink wraps', () => {
    const samples = [
      'The one that actually prevents RSI. Do it properly.',
      '←→↑↓ move   [enter] start   [esc] back',
      'Doing alright. A little more movement would help.',
      'Look 20 feet away for 20 seconds. Blink properly while you are at it.',
      'one two three four',
      'antidisestablishmentarianism',
    ];
    for (const columns of [80, 60, 44, 32, 24, 10, 4]) {
      for (const text of samples) {
        const rendered = heightOf(frameAt(<Text wrap="wrap">{text}</Text>, columns, 40));
        expect(textRows(text, columns), `${columns}: ${text}`).toBe(rendered);
      }
    }
  });
});

describe('Sprite', () => {
  const sprite = getSprite(getActivity('stretch-wrists')!.sprite);

  it('renders at full size when given no row budget', () => {
    const out = plain(render(<Sprite sprite={sprite} frame={0} />).lastFrame());
    expect(out.split('\n')).toHaveLength(spriteLineHeight(sprite));
  });

  it('scales the art down to the rows it is allowed', () => {
    const out = plain(render(<Sprite sprite={sprite} frame={0} maxRows={6} />).lastFrame());
    expect(out.split('\n').length).toBeLessThanOrEqual(6);
    // Still art, not a blank box.
    expect(out).toContain('▀');
  });

  it('does not upscale art that already fits', () => {
    const out = plain(render(<Sprite sprite={sprite} frame={0} maxRows={200} />).lastFrame());
    expect(out.split('\n')).toHaveLength(spriteLineHeight(sprite));
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

  // The dashboard budgets its art from what the rings leave behind, counting a
  // row each. A label that wraps quietly costs a row nobody accounted for.
  it('keeps every ring to a single row', () => {
    const all: Ring[] = ACTIVITY_GROUPS.map((group) => ({
      group,
      done: 4,
      goal: 8,
      progress: 0.5,
      closed: false,
    }));
    for (const { columns } of PANES) {
      const tier = tierFor(columns, 40);
      if (tier === 'minimal') continue;
      const out = frameAt(<Rings rings={all} tier={tier} />, columns, 40);
      expect(heightOf(out), `${columns} columns`).toBe(all.length);
    }
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

  it('fits the pane it is given', () => {
    for (const { columns, rows } of PANES) {
      const frame = frameAt(
        <Dashboard {...props} tier={tierFor(columns, rows)} pane={{ columns, rows }} />,
        columns,
        rows,
      );
      expect(heightOf(frame), `${columns}x${rows}`).toBeLessThanOrEqual(rows);
    }
  });

  it('keeps the streak and the footer even when the pane is short', () => {
    const out = frameAt(<Dashboard {...props} tier={tierFor(60, 14)} pane={{ columns: 60, rows: 14 }} />, 60, 14);
    expect(out).toContain('3 day streak');
    expect(out).toContain('[q]');
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

  it('points at the menu rather than cycling alternatives itself', () => {
    // One menu in the app: "something else" opens it, instead of the nudge
    // becoming a second browser with its own counter.
    const out = plain(
      render(<Nudge activity={stretch} overdueMinutes={0} tier="full" />).lastFrame(),
    );
    expect(out).toContain('[tab] something else');
    expect(out).not.toMatch(/\d+\/\d+/);
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

  it('fits the pane it is given', () => {
    for (const { columns, rows } of PANES) {
      const frame = frameAt(
        <Nudge
          activity={stretch}
          overdueMinutes={5}
          tier={tierFor(columns, rows)}
          pane={{ columns, rows }}
          instantProgress={{ done: 3, goal: 8 }}
          alternativeCount={4}
          alternativeIndex={1}
        />,
        columns,
        rows,
      );
      expect(heightOf(frame), `${columns}x${rows}`).toBeLessThanOrEqual(rows);
    }
  });

  it('keeps the title and the way out when the pane is short', () => {
    const out = frameAt(
      <Nudge activity={stretch} overdueMinutes={5} tier={tierFor(60, 14)} pane={{ columns: 60, rows: 14 }} />,
      60,
      14,
    );
    expect(out).toContain('Wrist & finger stretch');
    expect(out).toContain('[s] snooze');
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
    groupIndex: 0,
    activityIndex: 0,
    tier: 'full' as const,
  };

  it('groups activities so the list never grows with the catalogue', () => {
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

  it('previews the selected activity', () => {
    const out = plain(render(<Picker {...props} />).lastFrame());
    expect(out).toContain('▀');
  });

  it('swaps the preview as the selection moves, without moving anything else', () => {
    const first = frameAt(
      <Picker {...props} activityIndex={0} pane={{ columns: 80, rows: 30 }} />,
      80,
      30,
    );
    const second = frameAt(
      <Picker {...props} activityIndex={1} pane={{ columns: 80, rows: 30 }} />,
      80,
      30,
    );
    // A different activity is previewed...
    expect(second).not.toBe(first);
    // ...in exactly the same place.
    expect(heightOf(second)).toBe(heightOf(first));
  });

  // Almost everything is on the routine, so saying so on every row spends a
  // column to report the unremarkable. Only the exceptions earn a mark.
  it('marks only what is out of the ordinary', () => {
    const out = plain(render(<Picker {...props} />).lastFrame());
    expect(out).toContain('due now');
    expect(out).not.toContain('auto');

    // Posture is off the routine — still listed, and marked as yours to start.
    const manual = plain(render(<Picker {...props} groupIndex={2} />).lastFrame());
    expect(manual).toContain('Posture');
    expect(manual).toContain('manual');
  });

  it('keeps a catalogue tally out of the header', () => {
    // A count of the whole catalogue does not help you choose inside one
    // group, and the slot is better spent on nothing at all.
    const out = plain(render(<Picker {...props} />).lastFrame());
    expect(out).toContain('pick something');
    expect(out).not.toMatch(/\d+ auto/);
    expect(out).not.toMatch(/\d+ manual/);
  });

  it('says where you are only when the list is scrolling', () => {
    const roomy = frameAt(
      <Picker {...many} tier={tierFor(80, 30)} pane={{ columns: 80, rows: 30 }} />,
      80,
      30,
    );
    expect(roomy).not.toMatch(/\d+\/\d+/);

    const cramped = frameAt(
      <Picker {...many} tier={tierFor(60, 14)} pane={{ columns: 60, rows: 14 }} />,
      60,
      14,
    );
    expect(cramped).toMatch(/\d+\/\d+/);
  });

  it('marks the selected row with a filled band', () => {
    const frame = render(<Picker {...props} />).lastFrame() ?? '';
    expect(frame).toMatch(/\[4[0-8][;m]/);
  });

  it('keeps the names at every tier, and the preview wherever it fits', () => {
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

  // The whole catalogue, which is what the app shows: six tabs that wrap onto
  // several rows in a narrow pane, and a group with more rows than fit.
  const stretches = activitiesInGroup('stretch');
  const stretchTab = groupActivities(ACTIVITIES, new Set()).findIndex((g) => g.group === 'stretch');
  const many = {
    ...props,
    activities: ACTIVITIES,
    dueIds: new Set<string>(),
    autoIds: new Set(ACTIVITIES.map((a) => a.id)),
    groupIndex: stretchTab,
  };

  it('fits the pane it is given', () => {
    for (const { columns, rows } of PANES) {
      const frame = frameAt(
        <Picker {...many} tier={tierFor(columns, rows)} pane={{ columns, rows }} />,
        columns,
        rows,
      );
      expect(heightOf(frame), `${columns}x${rows}`).toBeLessThanOrEqual(rows);
    }
  });

  /**
   * The shape of the screen: how tall it is, and where the fixed furniture
   * sits. Two frames with the same shape put every row in the same place.
   */
  function shapeOf(out: string): string {
    const lines = out.split('\n');
    return [
      lines.length,
      lines.findIndex((l) => l.includes('[esc]')),
      // Where the list starts. Its rows read "❱ Name" or "  Name"; the tab bar
      // above reads " ◆ Group", so a glyph in the second column rules it out.
      lines.findIndex((l) => /^[❱ ] \S/.test(l)),
    ].join('/');
  }

  // Walking the menu must not move the menu. A cue that wraps onto a second
  // line, or a group whose sprites are a different height, used to reflow the
  // whole screen mid-navigation — the row you were aiming at moved.
  it('does not reflow as the selection moves through a group', () => {
    for (const { columns, rows } of PANES) {
      const shapes = new Set(
        stretches.map((_, i) =>
          shapeOf(
            frameAt(
              <Picker {...many} activityIndex={i} tier={tierFor(columns, rows)} pane={{ columns, rows }} />,
              columns,
              rows,
            ),
          ),
        ),
      );
      expect([...shapes], `${columns}x${rows}`).toHaveLength(1);
    }
  });

  it('does not reflow as the selection moves between groups', () => {
    const groupCount = groupActivities(ACTIVITIES, new Set()).length;
    for (const { columns, rows } of PANES) {
      const shapes = new Set(
        Array.from({ length: groupCount }, (_, g) =>
          shapeOf(
            frameAt(
              <Picker {...many} groupIndex={g} activityIndex={0} tier={tierFor(columns, rows)} pane={{ columns, rows }} />,
              columns,
              rows,
            ),
          ),
        ),
      );
      expect([...shapes], `${columns}x${rows}`).toHaveLength(1);
    }
  });

  it('says how many rows the window is hiding', () => {
    // Short enough that a seven-activity group cannot be listed in full.
    const out = frameAt(<Picker {...many} tier={tierFor(60, 14)} pane={{ columns: 60, rows: 14 }} />, 60, 14);
    expect(out).toMatch(/\d+ more/);
  });

  it('scrolls the window so the selected row stays visible', () => {
    const last = stretches.length - 1;
    const label = stretches[last]!.short ?? stretches[last]!.title;
    const out = frameAt(
      <Picker {...many} activityIndex={last} tier={tierFor(60, 14)} pane={{ columns: 60, rows: 14 }} />,
      60,
      14,
    );
    expect(out).toContain(label);
  });

  it('keeps the tabs and the keybindings on screen at every pane size', () => {
    for (const { columns, rows } of PANES) {
      const out = frameAt(
        <Picker {...many} tier={tierFor(columns, rows)} pane={{ columns, rows }} />,
        columns,
        rows,
      );
      expect(out, `${columns}x${rows}`).toContain('Stretch');
      // The wording shortens in the tightest layout; a way to start does not.
      expect(out, `${columns}x${rows}`).toContain('[enter]');
      expect(out, `${columns}x${rows}`).toContain('[esc]');
    }
  });
});

describe('locateActivity', () => {
  it('finds where an activity sits in the menu', () => {
    const groups = groupActivities(ACTIVITIES, new Set());
    for (const id of ['water', 'stretch-ankles', 'posture-check']) {
      const { groupIndex, activityIndex } = locateActivity(ACTIVITIES, id);
      expect(groups[groupIndex]?.activities[activityIndex]?.id, id).toBe(id);
    }
  });

  it('falls back to the first entry for something not listed', () => {
    expect(locateActivity(ACTIVITIES, 'no-such-activity')).toEqual({
      groupIndex: 0,
      activityIndex: 0,
    });
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

  it('fits the pane it is given', () => {
    for (const { columns, rows } of PANES) {
      const frame = frameAt(
        <Session
          plan={plan}
          state={sessionStateAt(plan, 0)}
          tier={tierFor(columns, rows)}
          elapsedMs={0}
          pane={{ columns, rows }}
        />,
        columns,
        rows,
      );
      expect(heightOf(frame), `${columns}x${rows}`).toBeLessThanOrEqual(rows);
    }
  });

  it('keeps the instruction and the countdown when the pane is short', () => {
    const out = frameAt(
      <Session
        plan={plan}
        state={sessionStateAt(plan, 0)}
        tier={tierFor(60, 14)}
        elapsedMs={0}
        pane={{ columns: 60, rows: 14 }}
      />,
      60,
      14,
    );
    expect(out).toContain('Stand up');
    expect(out).toContain('[q] stop');
  });
});

describe('ConfigEditor', () => {
  // It reads the pane size itself, being a top-level screen rather than
  // something App hands props to.
  const env = { HOME: '/nonexistent-home-for-tests' } as NodeJS.ProcessEnv;

  it('fits the pane it is given', () => {
    for (const { columns, rows } of PANES) {
      const frame = frameAt(<ConfigEditor env={env} />, columns, rows);
      expect(heightOf(frame), `${columns}x${rows}`).toBeLessThanOrEqual(rows);
    }
  });

  it('keeps the keybindings on screen when the pane is short', () => {
    expect(frameAt(<ConfigEditor env={env} />, 60, 14)).toContain('[q] done');
  });
});

describe('SessionComplete', () => {
  it('confirms the activity and the reward', () => {
    const out = plain(render(<SessionComplete title="Plank" xp={25} tier="full" />).lastFrame());
    expect(out).toContain('Plank');
    expect(out).toContain('+25 xp');
  });
});
