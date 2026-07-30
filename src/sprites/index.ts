/**
 * The sprite registry.
 *
 * Activities reference sprites by name; this is the lookup. A missing sprite
 * falls back to a placeholder rather than crashing the companion, so shipping
 * an activity before its art is a visual bug, not an outage.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';
import { water } from './hydration.js';
import { blink, eyes } from './eyes.js';
import { ankles, catcow, chest, neck, shoulders, twist, wrists } from './stretches.js';
import { calf, lunge, plank, pushup, squat } from './exercises.js';
import { boxBreath, sigh } from './breathing.js';
import { posture } from './posture.js';

export { PET_SPRITES, petSprite } from './pet.js';

/** Shown when an activity references art that doesn't exist. */
export const placeholder: Sprite = makeSprite(PALETTE, [
  [
    '........................',
    '........................',
    '......aaaaaaaaaaaa......',
    '......a..........a......',
    '......a...aaaa...a......',
    '......a..a....a..a......',
    '......a..a....a..a......',
    '......a.......a..a......',
    '......a......aa..a......',
    '......a.....aa...a......',
    '......a.....a....a......',
    '......a..........a......',
    '......a.....a....a......',
    '......a..........a......',
    '......aaaaaaaaaaaa......',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
]);

export const SPRITES: Readonly<Record<string, Sprite>> = {
  water,
  eyes,
  blink,
  wrists,
  neck,
  shoulders,
  chest,
  twist,
  catcow,
  ankles,
  squat,
  pushup,
  plank,
  calf,
  lunge,
  'box-breath': boxBreath,
  sigh,
  posture,
};

export function getSprite(name: string): Sprite {
  return SPRITES[name] ?? placeholder;
}
