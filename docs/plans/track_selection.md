# Plan: Track Selection & Master Limiter

## Overview
Add track selection (synth1 / Master), device panel updates on selection,
Master limiter device, and track row click selection.

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

### Task 1: Track selection state
- [x] Create `src/hooks/useTrackSelection.ts`
- [x] State: `selectedTrack: 'synth1' | 'master' | null`, default `'synth1'`
- [x] Expose: `selectTrack(id)`, `selectedTrack`
- [x] Share state via React context (`TrackSelectionContext`) so DevicePanel and TrackZone both access it without prop drilling
- [x] Write Vitest test: `selectTrack('master')` updates `selectedTrack` to `'master'`
- [x] Write Vitest test: `selectTrack('synth1')` updates `selectedTrack` to `'synth1'`
- [x] Mark completed

### Task 2: Track row click selection
- [x] In `TrackZone.tsx`: clicking anywhere on synth1 track row calls `selectTrack('synth1')`
- [x] Clicking anywhere on Master track row calls `selectTrack('master')`
- [x] Selected track row gets visual highlight: left border accent color (3px solid `--accent`), background slightly lighter than default
- [x] Unselected track rows return to default appearance
- [x] Write Playwright test: click synth1 track row, verify it receives `data-selected="true"` attribute
- [x] Write Playwright test: click Master track row, verify Master gets `data-selected="true"` and synth1 loses it
- [x] Write Playwright test: verify selected track row has a distinct left border style
- [x] Mark completed

### Task 3: Master Limiter hook
- [ ] Create `src/hooks/useLimiter.ts`
- [ ] Instantiate `Tone.Limiter` with default threshold `-3` dB
- [ ] Insert limiter into existing usePanner chain between masterGain and masterAnalyser/destination
    - Current chain: masterGain → masterAnalyser → audioContext.destination
    - New chain: masterGain → Limiter → masterAnalyser → audioContext.destination
- [ ] usePanner.ts accepts optional limiter node and rewires chain on mount — do NOT connect via Tone.Destination
- [ ] Expose: `setThreshold(db: number)`, `setEnabled(bool)`, `isEnabled: boolean`, `threshold: number`
- [ ] `setEnabled(false)` bypasses limiter node (masterGain connects directly to masterAnalyser)
- [ ] Write Vitest test: `setThreshold(-6)` sets `limiter.threshold.value` to -6
- [ ] Write Vitest test: `setEnabled(false)` removes limiter from chain, masterGain connects directly to masterAnalyser
- [ ] Mark completed

### Task 4: Device panel switches content on track selection
- [ ] Delete or rewrite existing test in `e2e/devicepanel.spec.ts` that asserts Polysynth and Panner visible simultaneously — this contract no longer holds after track selection
- [ ] In `DevicePanel.tsx`: read `selectedTrack` from `TrackSelectionContext`
- [ ] When `selectedTrack === 'synth1'`: show SynthDevice + PannerDevice
- [ ] When `selectedTrack === 'master'`: show placeholder div with text "Limiter — coming soon"
- [ ] Panel title/label updates to match selected track: "synth1" or "Master"
- [ ] Switching between tracks uses a fade transition (opacity 0 → 1, 120ms)
- [ ] Write Playwright test: click synth1 row, verify "Polysynth" device is visible
- [ ] Write Playwright test: click Master row, verify "Polysynth" is not visible, placeholder "Limiter — coming soon" is visible
- [ ] Write Playwright test: verify panel label changes from "synth1" to "Master" on track switch
- [ ] Mark completed

### Task 5: Limiter device component
- [ ] Create `src/components/LimiterDevice.tsx`
- [ ] Same device block layout as SynthDevice and PannerDevice
- [ ] Enable/disable toggle in top-left corner
- [ ] Label "Limiter", type tag "Master FX"
- [ ] One knob: Threshold (-30 to 0 dB, default -3 dB)
- [ ] Gain reduction meter: small vertical bar showing `limiter.reduction` value in real time via `requestAnimationFrame`
- [ ] Knob calls `useLimiter.setThreshold()` on change
- [ ] Toggle calls `useLimiter.setEnabled(bool)`
- [ ] Replace placeholder in DevicePanel with `<LimiterDevice />` when `selectedTrack === 'master'`
- [ ] Write Playwright test: click Master row, verify "Limiter" label is visible and placeholder is gone
- [ ] Write Playwright test: drag Threshold knob, verify displayed value changes
- [ ] Write Playwright test: click synth1 row then Master row, verify "Limiter" is visible and "Polysynth" is not
- [ ] Mark completed