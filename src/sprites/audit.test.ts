import { describe, expect, it } from 'vitest';
import {
  EMPHASIS_TONES,
  FIGURE_TONES,
  auditFrames,
  boundingBox,
  components,
  fillRatio,
  frameShift,
  strayCues,
  strayEmphasis,
  touchesEdge,
} from './audit.js';
import { PET_SPRITES, SPRITES } from './index.js';

/**
 * These run over every frame of every sprite.
 *
 * Each rule exists because the corresponding fault actually shipped: a
 * highlight painted as a rectangle across the canvas, a limb left floating, a
 * pose that jumped between frames, art clipped by the canvas edge. All of them
 * were invisible in the source and obvious once drawn, which is exactly the
 * kind of thing a person should not have to catch by eye.
 */

const ALL: Record<string, { frames: readonly (readonly string[])[] }> = {
  ...SPRITES,
  ...Object.fromEntries(Object.entries(PET_SPRITES).map(([k, v]) => [`pet-${k}`, v])),
};

const names = Object.keys(ALL);

describe('every sprite frame', () => {
  it.each(names)('%s: the figure is one connected body', (name) => {
    for (const [i, report] of auditFrames(ALL[name]!.frames).entries()) {
      expect(report.figureParts, `${name} frame ${i} has detached parts`).toBeLessThanOrEqual(1);
    }
  });

  it.each(names)('%s: emphasis stays inside the silhouette', (name) => {
    // A muscle highlight belongs in a limb. One that borders empty space is
    // painting over the art rather than tinting it.
    for (const [i, report] of auditFrames(ALL[name]!.frames).entries()) {
      expect(report.strayEmphasis, `${name} frame ${i} has emphasis outside the body`).toBe(0);
    }
  });

  it.each(names)('%s: no orphaned cue pixels', (name) => {
    for (const [i, report] of auditFrames(ALL[name]!.frames).entries()) {
      expect(report.strayCues, `${name} frame ${i} has isolated cue debris`).toBe(0);
    }
  });

  it.each(names)('%s: the body is not clipped by the canvas', (name) => {
    for (const [i, report] of auditFrames(ALL[name]!.frames).entries()) {
      expect(report.clipped, `${name} frame ${i} runs off the canvas`).toBe(false);
    }
  });

  it.each(names)('%s: movement is continuous, not a jump cut', (name) => {
    for (const [i, report] of auditFrames(ALL[name]!.frames).entries()) {
      expect(
        report.shiftFromPrevious,
        `${name} frame ${i} jumps ${report.shiftFromPrevious}px from the previous frame`,
      ).toBeLessThanOrEqual(6);
    }
  });

  it.each(names)('%s: fills a sensible share of the canvas', (name) => {
    for (const [i, report] of auditFrames(ALL[name]!.frames).entries()) {
      expect(report.fill, `${name} frame ${i} is nearly empty`).toBeGreaterThan(0.04);
      expect(report.fill, `${name} frame ${i} is a solid block`).toBeLessThan(0.62);
    }
  });
});

describe('the audit itself', () => {
  it('finds a detached limb', () => {
    expect(components(['cc..s', 'cc...'], FIGURE_TONES)).toBe(2);
    expect(components(['cccs.', 'cc...'], FIGURE_TONES)).toBe(1);
  });

  it('finds emphasis painted outside the body', () => {
    // The plank bug: a bar of highlight running out past the torso.
    expect(strayEmphasis(['ccccc', 'cYYYc', 'ccccc'])).toBe(0);
    expect(strayEmphasis(['.....', 'YYYYY', '.....'])).toBe(5);
  });

  it('finds isolated cue debris but allows a real arrow', () => {
    expect(strayCues(['.....', '..y..', '.....'])).toBe(1);
    expect(strayCues(['..y..', '.yyy.', '..y..'])).toBe(0);
  });

  it('measures the body, not the cues', () => {
    // An arrow appearing must not register as the figure moving.
    const before = ['ccc..', '.....'];
    const after = ['ccc.y', '.....'];
    expect(frameShift(before, after)).toBe(0);
  });

  it('detects a frame that runs off the canvas', () => {
    expect(touchesEdge(['ccc', '...', '...'], FIGURE_TONES)).toBe(true);
    expect(touchesEdge(['...', '.c.', '...'], FIGURE_TONES)).toBe(false);
  });

  it('measures fill and bounds', () => {
    expect(fillRatio(['cc', '..'])).toBe(0.5);
    expect(boundingBox(['.c.', '...'])).toMatchObject({ minX: 1, maxX: 1, minY: 0, maxY: 0 });
    expect(boundingBox(['...', '...']).empty).toBe(true);
  });

  it('treats emphasis as part of the body when checking connectivity', () => {
    // A tinted midsection is still the torso; excluding it would report an
    // intact figure as severed.
    const tinted = ['ccc', 'YYY', 'ccc'];
    expect(components(tinted, new Set([...FIGURE_TONES, ...EMPHASIS_TONES]))).toBe(1);
  });
});
