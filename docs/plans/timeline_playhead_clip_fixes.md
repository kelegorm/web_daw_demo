# Plan: Timeline, Playhead Sync & Clip Duration

## Overview
Add a timeline ruler above the track zone showing bars and beats.
Fix playhead sync to real audio timing. Ensure MIDI clip block width
matches real BPM and timeline scale. All three are interdependent —
they share the same pixels-per-second scale constant.

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

### Task 1: Shared timeline scale
- [x] Create `src/utils/timelineScale.ts` exporting a single source of truth:
    - [x] `getPixelsPerSecond(bpm: number): number` — defines the scale used by timeline, clip, and playhead
    - [x] `barDurationSeconds(bpm: number): number` — duration of one 4/4 bar in seconds: `4 * 60 / bpm`
    - [x] `beatDurationSeconds(bpm: number): number` — duration of one beat: `60 / bpm`
    - [x] `clipDurationSeconds(bpm: number, steps: number): number` — `steps * (60 / bpm) / 2` for 8th notes
- [x] All other components (timeline, clip block, playhead) import from this module — no local time calculations
- [x] Write Vitest test: `getPixelsPerSecond(120)` returns same value as used in timeline width calculation
- [x] Write Vitest test: `barDurationSeconds(120)` returns 2.0
- [x] Write Vitest test: `beatDurationSeconds(120)` returns 0.5
- [x] Write Vitest test: `clipDurationSeconds(120, 8)` returns 2.0 (8 eighth notes at 120 BPM)
- [x] Mark completed

### Task 2: Timeline ruler above track zone
- [ ] Create `src/components/TimelineRuler.tsx`
- [ ] Positioned above the synth1 track row, aligned to the clip/timeline column only (not the track header column)
- [ ] Track header column has empty placeholder of same width on the left
- [ ] Ruler shows bar numbers (1, 2, 3...) at each bar boundary
- [ ] Ruler shows beat tick marks (shorter lines) at each beat within a bar (4/4: 3 ticks between bar numbers)
- [ ] Bar and beat positions calculated using `getPixelsPerSecond` and `barDurationSeconds` from Task 1
- [ ] Ruler width matches timeline area width
- [ ] When BPM changes, ruler re-renders with updated bar/beat positions
- [ ] Write Playwright test: verify bar number "1" is visible in ruler at leftmost position
- [ ] Write Playwright test: verify bar number "2" is visible at correct pixel offset for 120 BPM
- [ ] Write Playwright test: change BPM to 60, verify bar "2" position has shifted right (wider bars)
- [ ] Write Playwright test: verify 3 beat tick marks are visible between bar 1 and bar 2
- [ ] Mark completed

### Task 3: MIDI clip block width synced to timeline scale
- [ ] Clip block width calculated as: `clipDurationSeconds(bpm, 8) * getPixelsPerSecond(bpm)`
- [ ] Both values imported from `timelineScale.ts` — no local calculation
- [ ] When BPM changes, clip block width updates reactively
- [ ] Clip block left edge aligns with bar 1 position on the ruler
- [ ] Mini piano-roll note bars inside clip block scale proportionally with clip width
- [ ] Write Playwright test: at 120 BPM, measure clip block width in pixels, verify it matches `clipDurationSeconds(120, 8) * pixelsPerSecond`
- [ ] Write Playwright test: change BPM to 60, verify clip block width has doubled
- [ ] Write Playwright test: verify clip block left edge aligns with bar 1 marker on ruler (within 2px)
- [ ] Mark completed

### Task 4: Playhead synced to Tone.Transport and timeline scale
- [ ] Remove any manual time tracking or `Date.now()`-based playhead calculation
- [ ] Playhead position calculated each animation frame as: `Tone.Transport.seconds * getPixelsPerSecond(bpm)`
- [ ] `getPixelsPerSecond` imported from `timelineScale.ts` — same scale as ruler and clip
- [ ] `getPixelsPerSecond(bpm)` recomputed reactively when BPM changes — no stale closure
- [ ] When Loop is enabled, playhead wraps at `clipDurationSeconds(bpm, 8) * getPixelsPerSecond(bpm)`
- [ ] When transport is stopped, playhead returns to position 0
- [ ] Playhead is a vertical line spanning from timeline ruler through all track rows
- [ ] Write Playwright test: click Play at 120 BPM, wait exactly 1000ms, verify playhead pixel position is within 5% of `1.0 * getPixelsPerSecond(120)`
- [ ] Write Playwright test: change BPM to 60, click Play, wait 1000ms, verify playhead position is within 5% of `1.0 * getPixelsPerSecond(60)`
- [ ] Write Playwright test: click Stop, verify playhead returns to pixel position 0
- [ ] Write Playwright test: enable Loop, click Play, wait for full clip duration + 200ms, verify playhead has wrapped back near position 0
- [ ] Mark completed