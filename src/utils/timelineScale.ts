/**
 * Single source of truth for timeline scale calculations.
 * All components (TimelineRuler, clip block, playhead) must import from here.
 */

/** Pixels rendered per second of audio at the given BPM. */
export function getPixelsPerSecond(bpm: number): number {
  // At 120 BPM, one bar = 2 s → 120 px; so pps = 60 px/s.
  // Scale linearly so the visible bar width stays constant across BPMs.
  return (bpm / 120) * 60
}

/** Duration in seconds of one 4/4 bar at the given BPM. */
export function barDurationSeconds(bpm: number): number {
  return (4 * 60) / bpm
}

/** Duration in seconds of one beat (quarter note) at the given BPM. */
export function beatDurationSeconds(bpm: number): number {
  return 60 / bpm
}

/**
 * Duration in seconds of a MIDI clip made of `steps` eighth notes at the given BPM.
 * One eighth note = half a beat = (60/bpm)/2.
 */
export function clipDurationSeconds(bpm: number, steps: number): number {
  return steps * (60 / bpm) / 2
}
