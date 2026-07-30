/**
 * Posture check: the same person slouched, then stacked properly.
 *
 * Showing both ends of the correction in one animation is the whole point —
 * the contrast is the instruction.
 */

import type { Sprite } from '../render/pixel.js';
import { PALETTE } from './palette.js';
import { makeSprite } from './make.js';

export const posture: Sprite = makeSprite(PALETTE, [
  // Slouched: head forward, spine rounded, shoulders collapsed.
  [
    '........................',
    '........................',
    '....hhhhhh..............',
    '...hhhhhhhh.............',
    '...hsssssssh............',
    '...hsossssss............',
    '...hsssssssh............',
    '....ssssss..............',
    '.....SSSS...............',
    '.....ccccc..............',
    '....CCcccccc............',
    '...ss.ccccccc...........',
    '...ss..cccccccc.........',
    '...ss...cccccccc........',
    '........CCCCCCCC........',
    '.......pppppppppppp.....',
    '.......pppppppppppppp...',
    '.......PPPPPPPPPPPPPP...',
    '.......ppp..............',
    '.......ppp..............',
    '.......ppp..............',
    '.......ppp..............',
    '......ooooo.............',
    '........................',
  ],
  // Stacked: ears over shoulders, shoulders over hips, feet flat.
  [
    '........................',
    '.........yyyyyy.........',
    '.........hhhhhh.........',
    '........hhhhhhhh........',
    '........hssssssh........',
    '........hsossosh........',
    '........hssssssh........',
    '.........ssssss.........',
    '..........SSSS..........',
    '.......cccccccccc.......',
    '......cccccccccccc......',
    '.....Cccccccccccc.......',
    '.....Cccccccccccc.......',
    '.....Cccccccccccc.......',
    '......CCCCCCCCCC........',
    '......pppppppppppp......',
    '......pppppppppppppp....',
    '......PPPPPPPPPPPPPP....',
    '......ppp...............',
    '......ppp...............',
    '......ppp...............',
    '......ppp...............',
    '.....ooooo..............',
    '........................',
  ],
]);
