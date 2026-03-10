# Plan: Stereo VU Meter with Peak Hold

## Overview
Rewrite VUMeter component to show stereo bars (L+R) in one capsule,
0 dB marker line, peak hold indicator, and above-0 dB display.
Replaces existing VUMeter in synth1 track and Master track.

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

### Task 1: Stereo VU meters with 0 dB marker and peak display
- [x] Rewrite `src/components/VUMeter.tsx` to accept L and R channel level props (dB values)
- [x] Render two vertical bars side by side inside a single enclosing capsule element
- [x] Horizontal line marking 0 dB position drawn across both bars
- [x] Bar scale: -60 dB at bottom, +6 dB at top — bars can exceed the 0 dB line
- [x] Peak hold indicator: small horizontal tick per channel, holds highest value for 1.5 seconds then falls at constant rate
- [x] VUMeter reads L and R RMS from AnalyserNode — requires stereo splitter: `audioContext.createChannelSplitter(2)`, one AnalyserNode per channel
- [x] Connect audio graph: source → ChannelSplitterNode → AnalyserNode L + AnalyserNode R → VUMeter
- [x] Replace all existing VUMeter usages (synth1 track, Master track) with new component
- [x] Write Playwright test: verify two bar elements exist inside VUMeter capsule
- [x] Write Playwright test: verify 0 dB marker element is present in VUMeter DOM
- [x] Write Playwright test: press C3 key, wait 300ms, verify at least one bar has height above minimum
- [x] Write Playwright test: release all keys, wait 2000ms, verify peak hold tick has moved downward from its peak position
- [x] Mark completed