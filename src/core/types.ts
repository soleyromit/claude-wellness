/**
 * Shared vocabulary for the whole app.
 *
 * Everything in `core/` is pure: no filesystem, no terminal, no React. The
 * types here are the contract between the pure logic and the layers that do
 * have side effects (`store/`, `claude/`, `ui/`).
 *
 * Scheduling is deliberately *per group*, not per activity. A group owns the
 * cadence ("stretch every 30 minutes"); when it comes due we rotate to the
 * least-recently-done activity in that group's enabled pool. That gives one
 * clean interval knob per group and stops you getting wrist stretches five
 * times in a row.
 */

/** Broad category an activity belongs to. Owns the cadence and a daily ring. */
export type ActivityGroup =
  | 'hydration'
  | 'eyes'
  | 'stretch'
  | 'exercise'
  | 'breathing'
  | 'posture';

export const ACTIVITY_GROUPS: readonly ActivityGroup[] = [
  'hydration',
  'eyes',
  'stretch',
  'exercise',
  'breathing',
  'posture',
];

/** One step within a guided session — a single instruction held for a beat. */
export interface ActivityStep {
  /** Instruction shown while this step is active, e.g. "Roll shoulders back". */
  readonly label: string;
  /** How long this step should hold, in milliseconds. */
  readonly durationMs: number;
}

/**
 * A wellness activity. Adding a new one means adding an entry to the registry
 * in `activities.ts` and a sprite — nothing else in the codebase changes.
 */
export interface Activity {
  readonly id: string;
  readonly group: ActivityGroup;
  /** Nudge headline, e.g. "Wrist & finger stretch". */
  readonly title: string;
  /** One-line motivation shown under the title. */
  readonly cue: string;
  /** Key into the sprite registry. */
  readonly sprite: string;
  /** Ordered steps for the guided session. */
  readonly steps: readonly ActivityStep[];
  /**
   * If set, the steps repeat this many times and the session shows a rep
   * counter. Used for exercises like squats and push-ups.
   */
  readonly reps?: number;
  /**
   * Instant activities complete with a single keypress instead of running a
   * guided session — water is logged a cup at a time.
   */
  readonly instant?: boolean;
}

/** What happened to an activity, appended to the log. */
export type LogEventType = 'shown' | 'completed' | 'skipped' | 'snoozed';

/** A single append-only log entry. All progress is derived from these. */
export interface LogEvent {
  /** Unix epoch milliseconds. */
  readonly ts: number;
  readonly type: LogEventType;
  readonly activity: string;
  /** Free-form extras, e.g. `{ cups: 1 }` or `{ untilTs: 123 }` for snoozes. */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** Cadence and targets for one group. This is what the user actually tunes. */
export interface GroupConfig {
  readonly enabled: boolean;
  readonly everyMinutes: number;
  /** Completions needed to close this group's daily ring. */
  readonly dailyGoal: number;
}

/** A window during which nudges are suppressed entirely. `"22:00"` / `"08:00"`. */
export interface QuietHours {
  readonly start: string;
  readonly end: string;
}

/** The user's routine, persisted to `~/.claude-wellness/config.json`. */
export interface Config {
  readonly version: 1;
  readonly quietHours: QuietHours | null;
  /** Cadence per group. Groups absent from this map fall back to defaults. */
  readonly groups: Readonly<Record<ActivityGroup, GroupConfig>>;
  /**
   * Pool membership: activity id -> included. An activity absent from this map
   * is included by default, so new activities shipped in an upgrade appear
   * automatically rather than silently staying off.
   */
  readonly activities: Readonly<Record<string, boolean>>;
  /**
   * How far past due a group must drift before we surface it even though
   * Claude is idle. Keeps nudges out of your flow without losing them entirely.
   */
  readonly graceMinutes: number;
  /** Minimum gap between any two nudges, so short prompts can't pile up. */
  readonly cooldownMinutes: number;
  readonly gamification: {
    readonly enabled: boolean;
    readonly pet: string;
  };
}

/** Whether Claude Code is currently working on a prompt. */
export type ClaudeState = 'busy' | 'idle';
