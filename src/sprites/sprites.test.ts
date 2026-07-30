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

  it('keeps every mood 24x24', () => {
    for (const sprite of Object.values(PET_SPRITES)) {
      expect(sprite.width).toBe(24);
      expect(sprite.height).toBe(24);
    }
  });
});
