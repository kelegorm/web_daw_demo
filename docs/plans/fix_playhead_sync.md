# Plan: Playhead Sync to Tone.Transport

## Overview
Fix MIDI clip playhead so its visual position matches real audio timing.
Sync to Tone.Transport.seconds, handle BPM changes and loop correctly.

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

### Task 1: Sync MIDI clip playhead to Tone.Transport
- [ ] Remove any manual time tracking or `Date.now()`-based playhead calculation
- [ ] Calculate playhead position using `Tone.Transport.seconds` sampled in `requestAnimationFrame`
- [ ] `clipDurationSeconds` derived from BPM and step count: `8 * (60 / BPM) / 2` for 8th notes at current BPM
- [ ] Playhead position: `(Tone.Transport.seconds % clipDurationSeconds) / clipDurationSeconds * timelineWidth`
- [ ] `clipDurationSeconds` recomputed reactively when BPM changes — no stale closure
- [ ] When Loop is enabled, playhead resets to start at loop boundary using `Tone.Transport.loopEnd`
- [ ] When transport is stopped, playhead returns to position 0
- [ ] Write Playwright test: click Play at 120 BPM, wait exactly 1000ms, verify playhead position is within 5% of expected (1000ms = 2 beats = 25% of 8-step 8th-note clip)
- [ ] Write Playwright test: change BPM to 60, click Play, wait 1000ms, verify playhead is within 5% of expected (1000ms = 1 beat = 12.5% of clip)
- [ ] Write Playwright test: click Stop, verify playhead returns to leftmost position
- [ ] Write Playwright test: enable Loop, click Play, wait for full clip duration + 200ms, verify playhead has wrapped back near start
- [ ] Mark completed