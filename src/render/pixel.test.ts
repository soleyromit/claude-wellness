import { describe, expect, it } from 'vitest';
import { PixelGrid, renderGrid, renderSprite, spriteLineHeight, type Sprite } from './pixel.js';

const ESC = '';
const RESET = `${ESC}[0m`;

const RED = '#ff0000';
const BLUE = '#0000ff';

const TWO_TONE: Sprite = {
  width: 2,
  height: 2,
  palette: { r: RED, b: BLUE },
  frames: [['rb', 'br'], ['br', 'rb']],
};

describe('PixelGrid', () => {
  it('stores and reads back pixels', () => {
    const g = new PixelGrid(4, 4);
    g.set(1, 2, [10, 20, 30]);
    expect(g.get(1, 2)).toEqual([10, 20, 30]);
    expect(g.get(0, 0)).toBeNull();
  });

  it('ignores writes outside its bounds instead of throwing', () => {
    const g = new PixelGrid(2, 2);
    expect(() => g.set(-1, 0, [1, 2, 3])).not.toThrow();
    expect(() => g.set(5, 5, [1, 2, 3])).not.toThrow();
    expect(g.get(-1, 0)).toBeNull();
    expect(g.get(99, 99)).toBeNull();
  });

  it('clears back to fully transparent', () => {
    const g = new PixelGrid(2, 2);
    g.fillRect(0, 0, 2, 2, [5, 5, 5]);
    g.clear();
    expect(g.toRows().flat().every((p) => p === null)).toBe(true);
  });

  it('fills rectangles, clipping at the edges', () => {
    const g = new PixelGrid(3, 3);
    g.fillRect(1, 1, 10, 10, [7, 7, 7]);
    expect(g.get(0, 0)).toBeNull();
    expect(g.get(1, 1)).toEqual([7, 7, 7]);
    expect(g.get(2, 2)).toEqual([7, 7, 7]);
  });

  it('draws a sprite frame through its palette', () => {
    const g = new PixelGrid(2, 2);
    g.drawSprite(0, 0, TWO_TONE, 0);
    expect(g.get(0, 0)).toEqual([255, 0, 0]);
    expect(g.get(1, 0)).toEqual([0, 0, 255]);
    expect(g.get(0, 1)).toEqual([0, 0, 255]);
    expect(g.get(1, 1)).toEqual([255, 0, 0]);
  });

  it('selects frames and wraps past the end so animation loops', () => {
    const g = new PixelGrid(2, 2);
    g.drawSprite(0, 0, TWO_TONE, 1);
    expect(g.get(0, 0)).toEqual([0, 0, 255]);

    const wrapped = new PixelGrid(2, 2);
    wrapped.drawSprite(0, 0, TWO_TONE, 2); // wraps to frame 0
    expect(wrapped.get(0, 0)).toEqual([255, 0, 0]);
  });

  it('leaves transparent pixels untouched so sprites can layer', () => {
    const under: Sprite = {
      width: 2,
      height: 2,
      palette: { g: '#00ff00' },
      frames: [['gg', 'gg']],
    };
    const over: Sprite = {
      width: 2,
      height: 2,
      palette: { r: RED },
      frames: [['r.', '..']],
    };

    const g = new PixelGrid(2, 2);
    g.drawSprite(0, 0, under);
    g.drawSprite(0, 0, over);

    expect(g.get(0, 0)).toEqual([255, 0, 0]);
    expect(g.get(1, 0)).toEqual([0, 255, 0]); // survived the transparent pixel
  });

  it('draws at an offset', () => {
    const g = new PixelGrid(4, 4);
    g.drawSprite(2, 2, TWO_TONE, 0);
    expect(g.get(0, 0)).toBeNull();
    expect(g.get(2, 2)).toEqual([255, 0, 0]);
  });
});

describe('renderGrid', () => {
  it('packs two pixel rows into one line of output', () => {
    const g = new PixelGrid(2, 4);
    g.fillRect(0, 0, 2, 4, [255, 0, 0]);
    expect(renderGrid(g, 24).split('\n')).toHaveLength(2);
  });

  it('renders a fully transparent grid as blank lines with no escapes', () => {
    const g = new PixelGrid(3, 2);
    expect(renderGrid(g, 24)).toBe('   ');
  });

  it('uses the upper half block with fg and bg when both pixels are set', () => {
    const g = new PixelGrid(1, 2);
    g.set(0, 0, [255, 0, 0]);
    g.set(0, 1, [0, 0, 255]);
    const out = renderGrid(g, 24);
    expect(out).toContain('▀');
    expect(out).toContain(`${ESC}[38;2;255;0;0m`);
    expect(out).toContain(`${ESC}[48;2;0;0;255m`);
  });

  it('uses the lower half block and no background when only the bottom is set', () => {
    const g = new PixelGrid(1, 2);
    g.set(0, 1, [0, 0, 255]);
    const out = renderGrid(g, 24);
    expect(out).toContain('▄');
    expect(out).toContain(`${ESC}[38;2;0;0;255m`);
    expect(out).not.toContain('[48;');
  });

  it('uses the upper half block with no background when only the top is set', () => {
    const g = new PixelGrid(1, 2);
    g.set(0, 0, [255, 0, 0]);
    const out = renderGrid(g, 24);
    expect(out).toContain('▀');
    expect(out).not.toContain('[48;');
  });

  it('always resets at the end of a coloured line so colour cannot bleed', () => {
    const g = new PixelGrid(2, 2);
    g.fillRect(0, 0, 2, 2, [1, 2, 3]);
    expect(renderGrid(g, 24).endsWith(RESET)).toBe(true);
  });

  it('resets before a transparent gap so a background does not smear across it', () => {
    const g = new PixelGrid(3, 2);
    g.set(0, 0, [255, 0, 0]);
    g.set(0, 1, [0, 0, 255]);
    // pixel column 1 is transparent, column 2 is set again
    g.set(2, 0, [255, 0, 0]);

    const out = renderGrid(g, 24);
    const gapIndex = out.indexOf(' ');
    expect(gapIndex).toBeGreaterThan(-1);
    // The reset must appear before the blank cell, not after it.
    expect(out.slice(0, gapIndex)).toContain(RESET);
  });

  it('does not re-emit an unchanged colour for every cell', () => {
    const g = new PixelGrid(20, 2);
    g.fillRect(0, 0, 20, 2, [255, 0, 0]);
    const out = renderGrid(g, 24);
    const occurrences = out.split(`${ESC}[38;2;255;0;0m`).length - 1;
    expect(occurrences).toBe(1);
  });

  it('honours the requested colour depth', () => {
    const g = new PixelGrid(1, 2);
    g.set(0, 0, [255, 0, 0]);

    expect(renderGrid(g, 24)).toContain('[38;2;255;0;0m');
    expect(renderGrid(g, 8)).toContain('[38;5;196m');
    // Pure red is nearer ANSI 1 (170,0,0) than bright red (255,85,85).
    expect(renderGrid(g, 4)).toContain('[31m');
  });

  it('handles an odd height by treating the missing bottom row as transparent', () => {
    const g = new PixelGrid(1, 3);
    g.fillRect(0, 0, 1, 3, [255, 0, 0]);
    const lines = renderGrid(g, 24).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('▀'); // top-only glyph, no background
    expect(lines[1]).not.toContain('[48;');
  });
});

describe('renderSprite', () => {
  it('renders a frame without needing a surrounding grid', () => {
    const out = renderSprite(TWO_TONE, 0, 24);
    expect(out.split('\n')).toHaveLength(1);
    expect(out).toContain('▀');
  });

  it('produces different output for different frames', () => {
    expect(renderSprite(TWO_TONE, 0, 24)).not.toBe(renderSprite(TWO_TONE, 1, 24));
  });
});

describe('spriteLineHeight', () => {
  it('is half the pixel height, rounded up', () => {
    expect(spriteLineHeight({ ...TWO_TONE, height: 2 })).toBe(1);
    expect(spriteLineHeight({ ...TWO_TONE, height: 16 })).toBe(8);
    expect(spriteLineHeight({ ...TWO_TONE, height: 15 })).toBe(8);
  });
});
