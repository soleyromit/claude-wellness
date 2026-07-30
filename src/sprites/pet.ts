/**
 * The pixel companion — a desk cactus whose condition mirrors yours.
 *
 * One sprite per mood rather than one animated sprite, because the mood is a
 * *state* you should be able to read instantly, not something that cycles. The
 * silhouette does the work: arms up and flowering when you're on track, arms
 * hanging and colour drained when you've been ignoring it for days.
 */

import type { Sprite } from '../render/pixel.js';
import type { PetMood } from '../core/pet.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';

const POT: readonly string[] = [
  '......mmmmmmmmmmmm......',
  '......mmmmmmmmmmmm......',
  '......mmmmmmmmmmmm......',
  '.......MMMMMMMMMM.......',
  '.......MMMMMMMMMM.......',
  '........MMMMMMMM........',
  '........................',
];

function withPot(top: readonly string[]): string[] {
  return [...top, ...POT];
}

/** Arms up, flowering, sparkling. */
const thriving = makeSprite(PALETTE, [
  withPot([
    '........................',
    '.....w..........w.......',
    '..........yrry..........',
    '..........rrrr..........',
    '..........nnnn..........',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
    '....nn...nnnnnn...nn....',
    '...nnnn..nnnnnn..nnnn...',
    '...nnnn..nonnon..nnnn...',
    '...nnnnnnnnnnnnnnnnnn...',
    '...nnnnnnnnoooonnnnnn...',
    '....nn...nnnnnn...nn....',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
  ]),
]);

/** Upright and healthy, but not flowering. */
const ok = makeSprite(PALETTE, [
  withPot([
    '........................',
    '........................',
    '........................',
    '........................',
    '..........nnnn..........',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
    '....nn...nnnnnn...nn....',
    '...nnnn..nnnnnn..nnnn...',
    '...nnnn..nonnon..nnnn...',
    '...nnnnnnnnnnnnnnnnnn...',
    '...nnnnnnnn.oo.nnnnnn...',
    '....nn...nnnnnn...nn....',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
  ]),
]);

/** Arms starting to droop, colour going. */
const wilting = makeSprite(PALETTE, [
  withPot([
    '........................',
    '........................',
    '........................',
    '........................',
    '..........NNNN..........',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
    '.........nnnnnn.........',
    '....N....nnnnnn....N....',
    '....NN...nonnon...NN....',
    '....NN...nnnnnn...NN....',
    '....NN...noooon...NN....',
    '.....N...nnnnnn...N.....',
    '.........nnnnnn.........',
    '.........NNNNNN.........',
    '.........NNNNNN.........',
    '.........NNNNNN.........',
  ]),
]);

/** Fully drooping, drained, unhappy. */
const sad = makeSprite(PALETTE, [
  withPot([
    '........................',
    '........................',
    '........................',
    '........................',
    '..........NN............',
    '.........NNNNN..........',
    '.........NNNNNN.........',
    '.........NoNNoN.........',
    '.........NNNNNN.........',
    '.........NoooN..........',
    '....N....NNNNNN....N....',
    '....N....NNNNNN....N....',
    '....NN...NNNNNN...NN....',
    '.....NN..NNNNNN..NN.....',
    '......N..NNNNNN..N......',
    '.........NNNNNN.........',
    '.........NNNNNN.........',
  ]),
]);

export const PET_SPRITES: Readonly<Record<PetMood, Sprite>> = {
  thriving,
  ok,
  wilting,
  sad,
};

export function petSprite(mood: PetMood): Sprite {
  return PET_SPRITES[mood];
}
