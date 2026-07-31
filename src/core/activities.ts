/**
 * The activity registry.
 *
 * This is the single place activities are defined. Adding one here plus a
 * matching sprite is the whole job — the scheduler, config editor, rings and
 * stats all read from this list.
 */

import type { Activity, ActivityGroup, GroupConfig } from './types.js';

/** Convenience for the common "hold this for N seconds" step. */
const hold = (label: string, seconds: number) => ({
  label,
  durationMs: seconds * 1000,
});

export const ACTIVITIES: readonly Activity[] = [
  // ---------------------------------------------------------------- hydration
  {
    id: 'water',
    group: 'hydration',
    title: 'Drink water',
    short: 'Water',
    cue: 'One cup. Right now, not in a minute.',
    sprite: 'water',
    instant: true,
    steps: [hold('Drink a cup', 1)],
  },

  // --------------------------------------------------------------------- eyes
  {
    id: 'eyes-20-20-20',
    group: 'eyes',
    title: '20-20-20',
    short: '20-20-20',
    cue: 'Look 20 feet away for 20 seconds. Your focal muscles are locked.',
    sprite: 'eyes',
    steps: [
      hold('Find something far away', 3),
      hold('Keep looking — let your eyes relax', 17),
    ],
  },
  {
    id: 'eyes-blink',
    group: 'eyes',
    title: 'Blink drill',
    short: 'Blink',
    cue: 'You blink 60% less at a screen. Reset the tear film.',
    sprite: 'blink',
    reps: 5,
    steps: [hold('Squeeze shut', 2), hold('Open wide', 2)],
  },

  // ------------------------------------------------------------------ stretch
  {
    id: 'stretch-wrists',
    group: 'stretch',
    title: 'Wrist & finger stretch',
    short: 'Wrists',
    cue: 'The one that actually prevents RSI. Do it properly.',
    sprite: 'wrists',
    framesPerStep: 7,
    steps: [
      hold('Arm out, palm up — pull fingers back gently', 15),
      hold('Palm down — pull fingers toward you', 15),
      hold('Spread fingers wide, then make a fist', 10),
      hold('Other hand: palm up, pull back', 15),
      hold('Other hand: palm down, pull toward you', 15),
    ],
  },
  {
    id: 'stretch-neck',
    group: 'stretch',
    title: 'Neck rolls',
    short: 'Neck',
    cue: 'Slow. If it clicks, go slower.',
    sprite: 'neck',
    framesPerStep: 7,
    steps: [
      hold('Ear toward right shoulder', 12),
      hold('Chin down to chest', 12),
      hold('Ear toward left shoulder', 12),
      hold('Slow half-circle back to centre', 10),
    ],
  },
  {
    id: 'stretch-shoulders',
    group: 'stretch',
    title: 'Shoulder shrugs',
    short: 'Shoulders',
    cue: 'Drop the shoulders you have been holding at ear height.',
    sprite: 'shoulders',
    framesPerStep: 7,
    reps: 6,
    steps: [hold('Lift shoulders to ears', 3), hold('Drop and release', 3)],
  },
  {
    id: 'stretch-chest',
    group: 'stretch',
    title: 'Chest opener',
    short: 'Chest',
    cue: 'Undo the hunch. Hands behind your back, squeeze the shoulder blades.',
    sprite: 'chest',
    framesPerStep: 7,
    steps: [
      hold('Clasp hands behind your back', 5),
      hold('Lift arms, open the chest, look up', 20),
      hold('Release slowly', 5),
    ],
  },
  {
    id: 'stretch-twist',
    group: 'stretch',
    title: 'Seated spinal twist',
    short: 'Twist',
    cue: 'Your spine has been in one shape for an hour.',
    sprite: 'twist',
    framesPerStep: 7,
    steps: [
      hold('Sit tall, feet flat', 5),
      hold('Twist right — hand on chair back', 15),
      hold('Back to centre', 3),
      hold('Twist left', 15),
    ],
  },
  {
    id: 'stretch-cat-cow',
    group: 'stretch',
    title: 'Seated cat-cow',
    short: 'Cat-cow',
    cue: 'Mobilise the whole spine without leaving the chair.',
    sprite: 'catcow',
    framesPerStep: 7,
    reps: 5,
    steps: [
      hold('Arch back, chest forward, look up', 4),
      hold('Round the spine, chin to chest', 4),
    ],
  },
  {
    id: 'stretch-ankles',
    group: 'stretch',
    title: 'Ankle circles',
    short: 'Ankles',
    cue: 'Blood has been pooling in your feet. Move it.',
    sprite: 'ankles',
    framesPerStep: 7,
    steps: [
      hold('Right ankle — 10 circles clockwise', 12),
      hold('Right ankle — 10 the other way', 12),
      hold('Left ankle — 10 circles clockwise', 12),
      hold('Left ankle — 10 the other way', 12),
    ],
  },

  // ----------------------------------------------------------------- exercise
  {
    id: 'exercise-squats',
    group: 'exercise',
    title: 'Sit-to-stand squats',
    short: 'Squats',
    cue: 'Use the chair you are already in. No equipment, no excuse.',
    sprite: 'squat',
    framesPerStep: 7,
    reps: 10,
    steps: [hold('Stand up — drive through the heels', 2), hold('Sit back down slowly', 2)],
  },
  {
    id: 'exercise-pushups',
    group: 'exercise',
    title: 'Desk push-ups',
    short: 'Push-ups',
    cue: 'Hands on the desk edge, body straight. Ten of them.',
    sprite: 'pushup',
    framesPerStep: 7,
    reps: 10,
    steps: [hold('Lower to the desk', 2), hold('Push back up', 2)],
  },
  {
    id: 'exercise-plank',
    group: 'exercise',
    title: 'Plank',
    short: 'Plank',
    cue: 'Thirty seconds. Straight line from heels to head.',
    sprite: 'plank',
    framesPerStep: 7,
    steps: [
      hold('Get into position', 5),
      hold('Hold — brace the core, do not sag', 30),
      hold('Release', 3),
    ],
  },
  {
    id: 'exercise-calf-raises',
    group: 'exercise',
    title: 'Calf raises',
    short: 'Calf raises',
    cue: 'Stand up and pump the calves — they are your second heart.',
    sprite: 'calf',
    framesPerStep: 7,
    reps: 15,
    steps: [hold('Up on the toes', 2), hold('Heels down slowly', 2)],
  },
  {
    id: 'exercise-lunges',
    group: 'exercise',
    title: 'Lunges',
    short: 'Lunges',
    cue: 'Your hip flexors have been folded shut for an hour.',
    sprite: 'lunge',
    framesPerStep: 7,
    reps: 8,
    steps: [hold('Step forward, drop the back knee', 3), hold('Push back to standing', 3)],
  },

  // ---------------------------------------------------------------- breathing
  {
    id: 'breathe-box',
    group: 'breathing',
    title: 'Box breathing',
    short: 'Box breath',
    cue: 'Four counts a side. Follow the marker around the box.',
    sprite: 'box-breath',
    smoothSprite: true,
    reps: 4,
    steps: [
      hold('Breathe in', 4),
      hold('Hold', 4),
      hold('Breathe out', 4),
      hold('Hold', 4),
    ],
  },
  {
    id: 'breathe-sigh',
    group: 'breathing',
    title: 'Physiological sigh',
    short: 'Sigh',
    cue: 'Two inhales, one long exhale. Fastest way to drop your heart rate.',
    sprite: 'sigh',
    smoothSprite: true,
    reps: 3,
    steps: [
      hold('Inhale through the nose', 3),
      hold('Second short inhale — top it up', 2),
      hold('Long slow exhale through the mouth', 6),
    ],
  },

  // ------------------------------------------------------------------ posture
  {
    id: 'posture-check',
    group: 'posture',
    title: 'Posture check',
    short: 'Posture',
    cue: 'Ears over shoulders, shoulders over hips. Screen at eye height.',
    sprite: 'posture',
    framesPerStep: 7,
    steps: [
      hold('Sit back into the chair', 4),
      hold('Stack ears over shoulders', 6),
      hold('Both feet flat on the floor', 5),
    ],
  },
];

/** Fast lookup by id. */
const BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]));

export function getActivity(id: string): Activity | undefined {
  return BY_ID.get(id);
}

export function activitiesInGroup(group: ActivityGroup): readonly Activity[] {
  return ACTIVITIES.filter((a) => a.group === group);
}

/**
 * Default cadence per group. These are deliberately conservative — a nudge you
 * ignore is worse than one you take, so we err on the side of fewer.
 */
export const DEFAULT_GROUP_CONFIG: Readonly<Record<ActivityGroup, GroupConfig>> = {
  eyes: { enabled: true, everyMinutes: 20, dailyGoal: 8 },
  posture: { enabled: false, everyMinutes: 25, dailyGoal: 6 },
  stretch: { enabled: true, everyMinutes: 30, dailyGoal: 6 },
  hydration: { enabled: true, everyMinutes: 45, dailyGoal: 8 },
  exercise: { enabled: true, everyMinutes: 90, dailyGoal: 3 },
  breathing: { enabled: true, everyMinutes: 120, dailyGoal: 2 },
};

/** Human-readable group labels for the UI. */
export const GROUP_LABELS: Readonly<Record<ActivityGroup, string>> = {
  hydration: 'Hydration',
  eyes: 'Eyes',
  stretch: 'Stretch',
  exercise: 'Exercise',
  breathing: 'Breathing',
  posture: 'Posture',
};
