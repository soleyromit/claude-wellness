import { describe, expect, it, vi } from 'vitest';
import { BELL, ESC, emit, idleSequence, nudgeSequence, titleSequence } from './attention.js';

describe('titleSequence', () => {
  it('emits a well-formed OSC 0 sequence', () => {
    expect(titleSequence('hello')).toBe(`${ESC}]0;hello${BELL}`);
  });

  it('strips control characters so a title cannot break out of the sequence', () => {
    const injected = titleSequence(`safe${ESC}]0;evil`);
    expect(injected).toBe(`${ESC}]0;safe]0;evil${BELL}`);
    // Exactly one opening escape: the one we wrote.
    expect(injected.split(ESC)).toHaveLength(2);
  });

  it('truncates a very long title rather than flooding the tab bar', () => {
    const long = titleSequence('x'.repeat(200));
    expect(long.length).toBeLessThan(80);
  });
});

describe('nudgeSequence', () => {
  it('sets the title and rings the bell by default', () => {
    const seq = nudgeSequence('Wrist stretch');
    expect(seq).toContain('Wrist stretch');
    expect(seq.endsWith(BELL)).toBe(true);
  });

  it('sets the title before ringing, so the tab is right when it flashes', () => {
    const seq = nudgeSequence('Plank');
    expect(seq.indexOf('Plank')).toBeLessThan(seq.lastIndexOf(BELL));
  });

  it('honours the bell being switched off', () => {
    const seq = nudgeSequence('Plank', { bell: false });
    expect(seq).toContain('Plank');
    // The only BEL left is the OSC terminator.
    expect(seq.split(BELL)).toHaveLength(2);
  });

  it('honours the title being switched off', () => {
    expect(nudgeSequence('Plank', { title: false })).toBe(BELL);
  });

  it('produces nothing when both are off, so the caller can skip the write', () => {
    expect(nudgeSequence('Plank', { bell: false, title: false })).toBe('');
  });
});

describe('idleSequence', () => {
  it('restores a neutral title', () => {
    expect(idleSequence()).toBe(`${ESC}]0;wellness${BELL}`);
  });

  it('never rings — going idle is not an event worth a bell', () => {
    expect(idleSequence().split(BELL)).toHaveLength(2);
  });

  it('is empty when titles are off', () => {
    expect(idleSequence({ title: false })).toBe('');
  });
});

describe('emit', () => {
  it('writes to a TTY', () => {
    const write = vi.fn();
    emit('hello', { isTTY: true, write } as unknown as NodeJS.WriteStream);
    expect(write).toHaveBeenCalledWith('hello');
  });

  it('writes nothing to a pipe, so escapes cannot pollute redirected output', () => {
    const write = vi.fn();
    emit('hello', { isTTY: false, write } as unknown as NodeJS.WriteStream);
    expect(write).not.toHaveBeenCalled();
  });

  it('skips an empty sequence', () => {
    const write = vi.fn();
    emit('', { isTTY: true, write } as unknown as NodeJS.WriteStream);
    expect(write).not.toHaveBeenCalled();
  });

  it('tolerates a missing stream', () => {
    expect(() => emit('hello', undefined)).not.toThrow();
  });
});
