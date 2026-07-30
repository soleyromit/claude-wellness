import { describe, expect, it } from 'vitest';
import {
  bgCode,
  detectColorDepth,
  fgCode,
  hexToRgb,
  rgbTo16,
  rgbTo256,
} from './palette.js';

const ESC = '';

describe('hexToRgb', () => {
  it('parses with and without a leading hash', () => {
    expect(hexToRgb('#4fc3f7')).toEqual([79, 195, 247]);
    expect(hexToRgb('4fc3f7')).toEqual([79, 195, 247]);
  });

  it('parses the extremes', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
  });

  it('rejects malformed input rather than rendering silently wrong colours', () => {
    expect(() => hexToRgb('#fff')).toThrow(/Invalid hex/);
    expect(() => hexToRgb('nothex')).toThrow(/Invalid hex/);
    expect(() => hexToRgb('')).toThrow(/Invalid hex/);
  });
});

describe('detectColorDepth', () => {
  it('honours an explicit override', () => {
    expect(detectColorDepth({ CLAUDE_WELLNESS_COLOR_DEPTH: '4', COLORTERM: 'truecolor' })).toBe(4);
    expect(detectColorDepth({ CLAUDE_WELLNESS_COLOR_DEPTH: '24', TERM: 'dumb' })).toBe(24);
  });

  it('detects truecolor from COLORTERM', () => {
    expect(detectColorDepth({ COLORTERM: 'truecolor' })).toBe(24);
    expect(detectColorDepth({ COLORTERM: '24bit' })).toBe(24);
  });

  it('detects truecolor terminals that do not advertise COLORTERM', () => {
    expect(detectColorDepth({ TERM_PROGRAM: 'iTerm.app' })).toBe(24);
    expect(detectColorDepth({ TERM_PROGRAM: 'ghostty' })).toBe(24);
    expect(detectColorDepth({ TERM: 'xterm-kitty' })).toBe(24);
  });

  it('falls back to 256 colours for a generic 256-colour terminal', () => {
    expect(detectColorDepth({ TERM: 'xterm-256color' })).toBe(8);
  });

  it('falls back to 16 colours when there is no terminal information at all', () => {
    expect(detectColorDepth({ TERM: 'dumb' })).toBe(4);
    expect(detectColorDepth({ TERM: '' })).toBe(4);
    expect(detectColorDepth({})).toBe(4);
  });

  it('assumes 256 colours for an unrecognised but real terminal', () => {
    expect(detectColorDepth({ TERM: 'xterm' })).toBe(8);
    expect(detectColorDepth({ TERM: 'screen' })).toBe(8);
  });
});

describe('rgbTo256', () => {
  it('maps pure black and white to the cube extremes', () => {
    expect(rgbTo256([0, 0, 0])).toBe(16);
    expect(rgbTo256([255, 255, 255])).toBe(231);
  });

  it('routes near-greys to the fine greyscale ramp, not the coarse cube', () => {
    const mid = rgbTo256([128, 128, 128]);
    expect(mid).toBeGreaterThanOrEqual(232);
    expect(mid).toBeLessThanOrEqual(255);
  });

  it('maps saturated colours into the 6x6x6 cube', () => {
    const red = rgbTo256([255, 0, 0]);
    expect(red).toBe(16 + 36 * 5);
    expect(rgbTo256([0, 255, 0])).toBe(16 + 6 * 5);
    expect(rgbTo256([0, 0, 255])).toBe(16 + 5);
  });

  it('stays within the valid 256-colour range for arbitrary inputs', () => {
    for (const c of [[79, 195, 247], [10, 200, 3], [200, 100, 50], [1, 1, 40]] as const) {
      const n = rgbTo256(c);
      expect(n).toBeGreaterThanOrEqual(16);
      expect(n).toBeLessThanOrEqual(255);
    }
  });
});

describe('rgbTo16', () => {
  it('picks the obvious nearest basic colour', () => {
    expect(rgbTo16([0, 0, 0])).toBe(0);
    expect(rgbTo16([255, 255, 255])).toBe(15);
    expect(rgbTo16([250, 60, 60])).toBe(9);
    expect(rgbTo16([60, 250, 60])).toBe(10);
  });
});

describe('escape codes', () => {
  it('emits 24-bit sequences at depth 24', () => {
    expect(fgCode([79, 195, 247], 24)).toBe(`${ESC}[38;2;79;195;247m`);
    expect(bgCode([79, 195, 247], 24)).toBe(`${ESC}[48;2;79;195;247m`);
  });

  it('emits indexed sequences at depth 8', () => {
    expect(fgCode([255, 0, 0], 8)).toBe(`${ESC}[38;5;196m`);
    expect(bgCode([255, 0, 0], 8)).toBe(`${ESC}[48;5;196m`);
  });

  it('emits basic and bright sequences at depth 4', () => {
    expect(fgCode([0, 0, 0], 4)).toBe(`${ESC}[30m`);
    expect(fgCode([255, 255, 255], 4)).toBe(`${ESC}[97m`);
    expect(bgCode([0, 0, 0], 4)).toBe(`${ESC}[40m`);
    expect(bgCode([255, 255, 255], 4)).toBe(`${ESC}[107m`);
  });
});
