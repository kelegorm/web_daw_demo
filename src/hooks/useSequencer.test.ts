import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSequencer, SEQUENCER_NOTES } from './useSequencer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createSequencer', () => {
  it('fires notes [60, 62, 64, 65, 67, 69, 71, 72] in that order', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    let mockTime = 0;
    const getClock = () => mockTime;

    const seq = createSequencer(noteOn, noteOff, getClock);
    seq.start();

    // Advance through all 8 notes (each 0.5s apart) plus scheduler intervals
    // Each beat = 0.5s, 8 notes = 4s total
    for (let i = 0; i < 16; i++) {
      mockTime += 0.5;
      vi.advanceTimersByTime(500);
    }

    const noteOnArgs = noteOn.mock.calls.map((c) => c[0]);
    expect(noteOnArgs.slice(0, 8)).toEqual(SEQUENCER_NOTES);

    seq.stop();
  });

  it('stop mid-sequence prevents further notes from firing', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    let mockTime = 0;
    const getClock = () => mockTime;

    const seq = createSequencer(noteOn, noteOff, getClock);
    seq.start();

    // Advance through 2 notes
    mockTime += 1.0;
    vi.advanceTimersByTime(1000);

    const countAfter2 = noteOn.mock.calls.length;
    expect(countAfter2).toBeGreaterThanOrEqual(1);

    seq.stop();

    // Advance more time — no new notes should fire
    mockTime += 4.0;
    vi.advanceTimersByTime(4000);

    expect(noteOn.mock.calls.length).toBe(countAfter2);
  });
});
