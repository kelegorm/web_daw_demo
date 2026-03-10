# Plan: Browser Synth DAW — UI Polish

## Overview
Layout fixes, faders, master track, keyboard gutters, VU meter colors.
No audio engine changes.

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

### Task 1: Toolbar layout — transport left-aligned with offset from title
- [x] Move Play/Pause, Stop, Panic buttons and BPM input to left side of toolbar
- [x] Add visible gap between app title "SynthDemo" and transport controls (min 32px)
- [x] Transport group and title remain in the same row, no wrapping
- [x] Write Playwright test: verify transport buttons are positioned to the right of title and left of viewport center
- [x] Write Playwright test: verify gap between title and first transport button is at least 32px
- [x] Mark completed

### Task 2: Track volume fader for synth1
- [ ] Replace existing volume control with horizontal fader in track header
- [ ] Range: -Infinity to +6 dB, default position at 0 dB
- [ ] Leftmost ~10% of travel snaps to -Infinity; rest maps logarithmically to -60..+6 dB
- [ ] Fader calls `useToneSynth.setVolume(db)` on change
- [ ] Display current dB value as text next to fader (show "-∞" at minimum)
- [ ] Write Playwright test: verify fader default position corresponds to 0 dB label
- [ ] Write Playwright test: drag fader to leftmost position, verify label shows "-∞"
- [ ] Write Playwright test: drag fader to rightmost position, verify label shows "+6" or "6"
- [ ] Mark completed

### Task 3: Track zone fills full screen height
- [ ] Track zone expands to fill all available vertical space between toolbar and device panel
- [ ] synth1 track row is fixed height at top of track zone
- [ ] Remaining space below synth1 is empty and scrollable if future tracks are added
- [ ] Write Playwright test: verify track zone height fills viewport minus toolbar and device panel heights
- [ ] Write Playwright test: verify synth1 row is at the top of the track zone
- [ ] Mark completed

### Task 4: Master track at bottom of track zone
- [ ] Add Master track row pinned to the bottom of the track zone (not scrolled away)
- [ ] Master track has: title "Master", stereo VU meter, horizontal volume fader (same spec as Task 2)
- [ ] Master track has no clip area / timeline
- [ ] Master fader controls `Tone.Destination.volume.value`
- [ ] Write Playwright test: verify "Master" label is visible at bottom of track zone
- [ ] Write Playwright test: verify Master track is always visible regardless of track zone scroll position
- [ ] Mark completed

### Task 5: MIDI keyboard width fixed, side gutters shown
- [ ] MIDI keyboard strip has fixed pixel width (fits exactly 2 octaves C3–B4)
- [ ] Keyboard is horizontally centered in the strip
- [ ] When viewport is wider than keyboard width, show gutter panels left and right
- [ ] Gutters use surface background color from design tokens, no content
- [ ] Write Playwright test: at viewport width 1600px, verify keyboard element width is unchanged
- [ ] Write Playwright test: at viewport width 1600px, verify left and right gutter elements are visible
- [ ] Mark completed

### Task 6: VU meter color zones matching DAW convention
- [ ] Below -10 dB: green (#4caf74)
- [ ] -10 dB to 0 dB: yellow/amber (#f5c842, harmonizes with app accent #f5a623)
- [ ] Above 0 dB: red (#e83b3b)
- [ ] Color transitions applied per-bar in real time as level changes
- [ ] Peak hold tick uses same color as the zone it currently occupies
- [ ] Write Play