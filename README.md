# claude-wellness

A pixel-art wellness companion for your terminal. It sits in a second pane
beside Claude Code and, **while Claude is thinking**, shows you something useful
to do with those seconds — a wrist stretch, a cup of water, twenty seconds
looking out the window.

The idea is simple: you're already waiting. That time is free.

```
 wellness · claude is thinking

        ▄▄▄▄▄▄
      ▄████████▄          ▶ Wrist & finger stretch
      ██  ██  ██
      ▀████████▀          Arm out, palm up — pull fingers back gently
        ▀▀▀▀▀▀
                          [enter] start   [s] snooze   [d] not today
```

## Install

```sh
npm install -g claude-wellness
wellness init
```

`init` registers three Claude Code hooks and opens the companion in a second
pane. That's the whole setup.

## How it works

Claude Code hooks tell the companion when Claude starts and stops working:

| Event | What it does |
| --- | --- |
| `UserPromptSubmit` | writes a busy flag |
| `Stop`, `SessionEnd` | clears it |

Both hooks are two-line `sh` scripts — no Node startup — so they add
single-digit milliseconds to your prompt latency.

Meanwhile each part of your routine has its own cadence (eyes every 20 minutes,
water every 45, and so on). When something comes due, the companion **waits for
Claude to start thinking** and shows it then, so reminders land in dead time
rather than interrupting you mid-thought.

If something has been due for too long and Claude never went busy — you spent an
hour in your editor — it surfaces anyway. Reminders shouldn't get silently
dropped just because you stopped using Claude.

## What's in it

| Group | Activities | Default |
| --- | --- | --- |
| **Eyes** | 20‑20‑20, blink drill | every 20m |
| **Stretch** | wrists & fingers, neck, shoulders, chest opener, spinal twist, cat‑cow, ankles | every 30m |
| **Hydration** | water, logged a cup at a time | every 45m |
| **Exercise** | sit‑to‑stand squats, desk push‑ups, plank, calf raises, lunges | every 90m |
| **Breathing** | box breathing, physiological sigh | every 120m |
| **Posture** | posture check | off by default |

Everything is demonstrated with animated pixel art. Guided activities pace
themselves step by step, so following the animation *is* the exercise.

## Noticing it

Nothing pops up and nothing steals focus — the companion stays in the pane you
put it in. But a narrow side pane changing its contents is easy to miss when
you're watching the Claude pane, so a nudge also:

- **rings the terminal bell**, which most terminals turn into a tab flash or a
  dock bounce, according to your own terminal settings rather than ours;
- **sets the pane's tab title** to the activity, e.g. `▶ Wrist stretch`, so it's
  visible even when the pane is narrow or in a background tab.

Both restore themselves once you've dealt with the nudge. Press `b` in
`wellness config` to silence the bell, or set `attention.bell` / `attention.title`
to `false` in `~/.claude-wellness/config.json`.

## Choosing what you do

The scheduler decides what to offer, but it never gets the last word — whether
you can drop and do push-ups right now depends on things it can't see.

- On a nudge, **`tab`** swaps the offer for something else. The counter shows
  where you are in the list, and alternatives from the same group come first.
- On the dashboard, **`p`** opens a picker with everything you have enabled,
  ordered most-overdue-first and marked with what is due. Whatever you highlight
  animates in a preview beside the list, so you can see what an activity
  involves before committing to it. Arrow keys, `enter` to start.

## Commands

```sh
wellness              # run the companion (same as `wellness watch`)
wellness config       # edit your routine
wellness stats        # streaks, level, last two weeks
wellness doctor       # check the setup
wellness uninstall    # remove the hooks
```

## Making it yours

```sh
wellness config
```

- `↑↓` move, `space` turns a group on or off
- `enter` expands a group so you can drop individual activities from its rotation
- `←→` adjusts how often that group comes up
- `+`/`-` adjusts its daily goal

Changes save immediately. Turn off what you don't want — if you hate planks,
expand **Exercise** and switch it off; the rest of the group keeps working.

## Streaks and the companion

A day counts toward your streak when you've touched **at least half of your
enabled groups**. It's measured in breadth rather than volume on purpose:
raising a daily goal shouldn't make your streak harder to keep.

The pixel companion's mood follows the same measure over the last three days, so
your streak and your plant never tell you contradictory things. Today can only
ever improve its mood — being scolded at 9am for a day you haven't had yet would
be daft.

## Removing it

```sh
wellness uninstall              # removes the hooks, keeps your history
wellness uninstall --purge      # removes everything
npm rm -g claude-wellness
```

Uninstall is surgical. Every command it registers carries a `# claude-wellness`
marker, and that marker is the only thing it matches on — **hooks belonging to
other tools are never touched**, and neither is anything else in your
`settings.json`. If you also run something like
[claude-games](https://github.com/soleyromit/claude-games) on the same `Stop`
hook, it will still be there afterwards, untouched. There's a test that proves
exactly this.

## Requirements

- Node 18+
- Claude Code

Auto-splitting a pane works in **tmux, WezTerm, kitty, iTerm2 and Terminal.app**.
Anywhere else, `init` prints the command to run in a second pane yourself.

Art is authored in 24-bit colour and degrades to 256 or 16 colours automatically.
`wellness doctor` will tell you what your terminal supports.

## Notes and limits

- All Claude Code sessions share one busy flag, so if you run several at once, a
  `Stop` in one clears the flag while another is still working. Per-session
  tracking is a future change.
- Quiet hours default to 22:00–08:00; nothing surfaces during them.
- Your data lives in `~/.claude-wellness/`. The history is an append-only
  `log.jsonl` — every streak, level and ring is derived from it, so nothing can
  drift out of sync, and you can read or delete it yourself.

## Development

```sh
npm install
npm test          # 406 tests
npm run build
```

The codebase splits three ways: `src/core/` is pure logic with no I/O and no
React (scheduling, streaks, session pacing, pixel compositing); `src/store/`,
`src/claude/` and `src/spawn/` hold all the side effects; `src/ui/` is thin Ink
components. The pure core is where the tests live.

Adding an activity means one entry in `src/core/activities.ts` and one sprite in
`src/sprites/`. Nothing else changes.

## License

MIT
