import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../core/activities.js';
import { renderSprite } from '../render/pixel.js';
import { makeSprite } from './make.js';
import { PALETTE } from './palette.js';
import { PET_SPRITES, SPRITES, getSprite, petSprite, placeholder } from './index.js';

describe('makeSprite validation', () => {
  it('accepts a well-formed sprite', () => {
    const sprite = makeSprite({ r: '#ff0000' }, [['rr', 'rr']]);
    expect(sprite.width).toBe(2);
    expect(sprite.height).toBe(2);
  });

  it('rejects a frame with a short row, which would otherwise render skewed', () => {
    expect(() => makeSprite({ r: '#ff0000' }, [['rr', 'r']])).toThrow(/expected 2/);
  });

  it('rejects frames of differing heights', () => {
    expect(() => makeSprite({ r: '#ff0000' }, [['rr', 'rr'], ['rr']])).toThrow(/expected 2 rows|rows, expected/);
  });

  it('rejects an unknown palette character', () => {
    expect(() => makeSprite({ r: '#ff0000' }, [['rx']])).toThrow(/unknown palette key "x"/);
  });

  it('rejects an empty sprite', () => {
    expect(() => makeSprite({}, [])).toThrow(/no frames/);
  });

  it('allows transparency and spaces', () => {
    expect(() => makeSprite({ r: '#ff0000' }, [['r. r']])).not.toThrow();
  });
});

describe('sprite registry', () => {
  it('every activity in the registry has real art, not the placeholder', () => {
    const missing = ACTIVITIES.filter((a) => getSprite(a.sprite) === placeholder);
    expect(missing.map((a) => `${a.id} -> ${a.sprite}`)).toEqual([]);
  });

  it('falls back to the placeholder for an unknown name instead of throwing', () => {
    expect(getSprite('does-not-exist')).toBe(placeholder);
  });

  it('every sprite uses only the shared palette', () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      expect(sprite.palette, `${name} should use the shared palette`).toBe(PALETTE);
    }
  });

  it('every sprite is 24x24 so layouts can assume a fixed size', () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      expect(sprite.width, `${name} width`).toBe(24);
      expect(sprite.height, `${name} height`).toBe(24);
    }
  });

  it('every sprite has at least one frame and renders without throwing', () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      expect(sprite.frames.length, `${name} frames`).toBeGreaterThan(0);
      for (let i = 0; i < sprite.frames.length; i++) {
        expect(() => renderSprite(sprite, i, 24), `${name} frame ${i}`).not.toThrow();
      }
    }
  });

  it('animated sprites actually differ between frames', () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      if (sprite.frames.length < 2) continue;
      const first = renderSprite(sprite, 0, 24);
      const others = sprite.frames.slice(1).map((_, i) => renderSprite(sprite, i + 1, 24));
      expect(others.some((f) => f !== first), `${name} frames should differ`).toBe(true);
    }
  });

  it('no sprite is entirely blank', () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      const drawn = sprite.frames[0]!.join('').split('').filter((c) => c !== '.').length;
      expect(drawn, `${name} should draw something`).toBeGreaterThan(20);
    }
  });
});

/**
 * Pixels that make up a body. Motion arcs, sparkles and floor lines are
 * deliberately separate marks, so they're excluded — the point of this check is
 * that the *figure* holds together.
 */
const FIGURE_PIXELS = new Set([
  // Every tone of every body material, including the highlights and shadows
  // added by the automatic shading pass — otherwise a lit edge pixel reads as
  // a hole and splits an intact figure in two.
  '1', 's', 'S', '2', // skin
  '3', 'h', 'H', // hair
  '4', 'c', 'C', '5', // shirt
  '6', 'p', 'P', // trousers
]);

/** Count 4-connected regions of figure pixels in a frame. */
function figureComponents(frame: readonly string[]): number {
  const height = frame.length;
  const width = frame[0]!.length;
  const seen = Array.from({ length: height }, () => new Array<boolean>(width).fill(false));
  const isFigure = (y: number, x: number): boolean =>
    y >= 0 && y < height && x >= 0 && x < width && FIGURE_PIXELS.has(frame[y]![x]!);

  let components = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isFigure(y, x) || seen[y]![x]) continue;
      components++;
      const stack = [[y, x] as const];
      while (stack.length > 0) {
        const [cy, cx] = stack.pop()!;
        if (!isFigure(cy, cx) || seen[cy]![cx]) continue;
        seen[cy]![cx] = true;
        stack.push([cy + 1, cx], [cy - 1, cx], [cy, cx + 1], [cy, cx - 1]);
      }
    }
  }
  return components;
}

describe('figures hold together', () => {
  /**
   * Regression guard. Several sprites originally shipped with limbs and heads
   * floating unattached — a head beside its body, single-pixel hands in empty
   * space, a torso not joined to its hips. Each looked plausible in the source
   * and obviously broken once rendered. A detached limb shows up here as an
   * extra connected component.
   */
  it.each(Object.keys(SPRITES))('%s', (name) => {
    const sprite = SPRITES[name]!;
    sprite.frames.forEach((frame, i) => {
      const components = figureComponents(frame);
      // Every figure is drawn as one continuous body, so anything above 1 is a
      // limb that came adrift.
      expect(components, `${name} frame ${i} has ${components} disconnected figure parts`)
        .toBeLessThanOrEqual(1);
    });
  });

  it('detects a genuinely detached limb', () => {
    // Sanity-check the check itself: a torso with a hand floating two pixels
    // away must register as two components.
    const broken = ['cc..s...', 'cc......'];
    expect(figureComponents(broken)).toBe(2);
    const joined = ['cccs....', 'cc......'];
    expect(figureComponents(joined)).toBe(1);
  });
});

describe('pet sprites', () => {
  it('has art for every mood', () => {
    for (const mood of ['thriving', 'ok', 'wilting', 'sad'] as const) {
      expect(petSprite(mood)).toBe(PET_SPRITES[mood]);
      expect(petSprite(mood).frames.length).toBeGreaterThan(0);
    }
  });

  it('renders each mood differently, so the state is readable at a glance', () => {
    const rendered = (['thriving', 'ok', 'wilting', 'sad'] as const).map((m) =>
      renderSprite(petSprite(m), 0, 24),
    );
    expect(new Set(rendered).size).toBe(4);
  });

  it('uses the larger 32x32 canvas', () => {
    // The companion sits on the dashboard all day, so it gets more pixels to
    // spend on shading than the activity sprites do.
    for (const sprite of Object.values(PET_SPRITES)) {
      expect(sprite.width).toBe(32);
      expect(sprite.height).toBe(32);
    }
  });

  it('gives each mood its own colour ramp, not just a darker green', () => {
    // A wilted plant that is merely the healthy one darkened reads as unlit
    // rather than unwell.
    const tones = (mood: Parameters<typeof petSprite>[0]): Set<string> =>
      new Set(petSprite(mood).frames[0]!.join('').split('').filter((c) => c !== '.'));

    const healthy = tones('thriving');
    const dead = tones('sad');
    const shared = [...dead].filter((c) => healthy.has(c));
    // Pot, soil, outline and eyes are shared; the plant body should not be.
    expect(shared).not.toContain('n');
    expect(shared).not.toContain('7');
  });
});
