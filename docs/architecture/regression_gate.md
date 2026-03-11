# Regression Gate

## Purpose

This document is the authoritative proof that the audio graph refactor did not break observable behavior.
Each scenario is linked to at least one automated test. Each architecture invariant is mapped to at least one passing test.

---

## Scenario Coverage

| Scenario | Test file | Test description | Status |
|---|---|---|---|
| Transport: play | `src/engine/transportService.test.ts` | `play() updates snapshot isPlaying to true and calls transport.start` | pass |
| Transport: pause | `src/engine/transportService.test.ts` | `pause() updates snapshot isPlaying to false and calls transport.pause` | pass |
| Transport: stop | `src/engine/transportService.test.ts` | `stop() resets isPlaying and currentStep` | pass |
| Transport: stop resets position | `src/engine/transportService.test.ts` | `stop() resets positionSeconds to Tone transport seconds (0 after stop)` | pass |
| Transport: play/pause/stop sequence | `src/engine/transportService.test.ts` | `play/pause/stop sequence updates snapshot correctly` | pass |
| Transport: loop | `src/engine/transportService.test.ts` | `setLoopConfig configures transport loop` | pass |
| Transport: loop E2E | `e2e/sequencer.spec.ts` | `with Loop on, sequence repeats beyond one clip length` | pass |
| Transport: BPM change | `src/engine/transportService.test.ts` | `setBpm() updates snapshot bpm and calls transport bpm.value` | pass |
| Sequencer: step progression | `e2e/sequencer.spec.ts` | `click Play, wait 1000ms at 120 BPM, verify at least 2 different step indicators highlighted` | pass |
| Sequencer: note order | `src/hooks/useSequencer.test.ts` | `fires notes [60, 62, 64, 65, 67, 69, 71, 72] in order` | pass |
| Sequencer: stop prevents further notes | `src/hooks/useSequencer.test.ts` | `stop mid-sequence prevents further notes from firing` | pass |
| Sequencer: play after stop | `src/hooks/useSequencer.test.ts` | `play after a single stop schedules notes again` | pass |
| Sequencer: loop toggle | `src/hooks/useSequencer.test.ts` | `setLoop toggles loop mode for part and transport` | pass |
| Sequencer: no-loop plays one clip | `e2e/sequencer.spec.ts` | `with Loop off, sequence plays one clip length without repeating notes` | pass |
| Panic: releases all active notes | `src/hooks/useTransportController.test.ts` | `panic() calls synthPanic` | pass |
| Panic: stop calls panic | `src/hooks/useSequencer.test.ts` | `stop calls panic and resets current step` | pass |
| Panic: E2E toolbar | `e2e/toolbar.spec.ts` | `click toolbar Panic releases all active notes` | pass |
| Track mute: audio silent | `src/hooks/useTrackStrip.test.ts` | `setTrackMuted(true) silences track gain and unmute restores previous track volume` | pass |
| Track mute: steps keep advancing | `src/hooks/useTransportController.test.ts` | `while muted, sequencer step continues to advance` | pass |
| Track mute: E2E meter drops to zero | `e2e/vumeter.spec.ts` | `VU meter returns to minimum within 300ms after clicking Mute` | pass |
| Master chain: limiter enable/bypass | `src/hooks/useLimiter.test.ts` | `setEnabled(false) bypasses limiter internally` | pass |
| Master chain: limiter enable restore | `src/hooks/useLimiter.test.ts` | `setEnabled(true) after disable restores limiter chain internally` | pass |
| Master chain: GR meter | `src/hooks/useLimiter.test.ts` | `getReductionDb returns positive dB from compressor.reduction` | pass |
| Master chain: limiter GR E2E | `e2e/devicepanel.spec.ts` | `Limiter GR meter shows gain reduction while playing with low threshold` | pass |
| UI meters: track/master L/R activity | `e2e/vumeter.spec.ts` | `VU meter bar has height above minimum within 300ms after pressing C3 key` | pass |
| UI meters: track header | `e2e/vumeter.spec.ts` | `VU meter in track header exceeds minimum within 300ms after pressing C3 key` | pass |
| UI meters: peak hold | `e2e/vumeter.spec.ts` | `VU meter peak hold tick appears after note is played and uses a zone color` | pass |
| UI meters: peak hold decay | `e2e/vumeter.spec.ts` | `VU meter peak hold tick falls downward after release within 2000ms` | pass |
| UI meters: MeterSource frames | `src/engine/meterSource.test.ts` | `emits frames with values in 0..1 range` | pass |
| UI meters: MeterSource silence | `src/engine/meterSource.test.ts` | `emits zero-level frames for silent input` | pass |
| Engine fail-safe: safe no-ops after dispose | `src/engine/audioEngine.test.ts` | `public engine methods become safe no-ops after dispose` | pass |
| Engine fail-safe: dispose idempotent | `src/engine/audioEngine.test.ts` | `dispose is idempotent` | pass |
| Playhead: driven by controller | `e2e/playhead.spec.ts` | `playhead position is driven by transport controller (moves, pauses, resets via stop)` | pass |
| Playhead: resets on stop | `e2e/playhead.spec.ts` | `click Stop, playhead returns to pixel position 0` | pass |
| Playhead: pause preserves position | `e2e/playhead.spec.ts` | `click Pause keeps playhead near current position (does not reset to 0)` | pass |
| No duplicate engine on remount | `e2e/remount.spec.ts` | `app remount does not duplicate sequencer activity` | pass |
| Pause preserves step | `src/hooks/useTransportController.test.ts` | `play → pause → play: step is preserved across pause` | pass |
| Sequencer: pause does not call panic | `src/hooks/useSequencer.test.ts` | `pause does not call panic and preserves current step` | pass |
| Note lifecycle: audio-time noteOff | `src/hooks/useSequencer.test.ts` | `at BPM 120, noteOff is scheduled at audio-time (no wall-clock setTimeout)` | pass |
| Note lifecycle: no noteOff after stop | `src/hooks/useSequencer.test.ts` | `noteOff is not called after stop()` | pass |

---

## Invariant Traceability

| Invariant | Description | Validating test(s) | Status |
|---|---|---|---|
| INV-1 | Single graph composition point: `createAudioEngine` | `src/engine/audioEngine.test.ts`: `builds expected linear graph links`, `is deterministic across repeated createAudioEngine calls` | pass |
| INV-2 | No module connects to `destination` on its own | `src/hooks/useToneSynth.test.ts`: `does not self-connect filter output to destination`; `src/engine/audioEngine.test.ts`: graph link assertions verify chain ends at destination only via engine | pass |
| INV-3 | All `AudioNode` instances share one `AudioContext` | `src/engine/audioEngine.test.ts`: `builds expected linear graph links` (single mock context used for all nodes) | pass |
| INV-4 | Modules do not know neighboring modules (only `input/output/params` contracts) | `src/engine/audioEngine.test.ts`: modules are injected via factories; graph wiring uses only `input`/`output` ports | pass |
| INV-5 | UI/feature hooks do not accept or return `AudioNode` / `Tone.*` | `src/engine/intentContracts.test.ts`: all type-level tests asserting no `AudioNode`/`Tone.*` in public hook shapes | pass |
| INV-6 | `AudioNode`-level contracts are engine-internal only; UI-facing contracts are intent-level only | `src/engine/intentContracts.test.ts`: full suite; `src/hooks/useTrackStrip.test.ts`: exposes a meterSource (not AnalyserNode) | pass |
| INV-7 | Sequencer and transport share one time domain — no `setTimeout` for note lifecycle | `src/hooks/useSequencer.test.ts`: `at BPM 120, noteOff is scheduled at audio-time (no wall-clock setTimeout)`; `noteOff is not called after stop()` | pass |
| INV-8 | All long-lived audio resources have an explicit lifecycle: `init/start/stop/dispose` | `src/engine/audioEngine.test.ts`: `dispose is idempotent`; `public engine methods become safe no-ops after dispose`; `e2e/remount.spec.ts`: no duplicate activity after remount | pass |
| INV-9 | If a module fails to initialize, engine degrades to bypass/pass-through instead of breaking the graph | `src/engine/audioEngine.test.ts`: `public engine methods become safe no-ops after dispose` (dispose simulates module teardown); graph validation tests confirm invalid graph throws at assembly time, not silently | partial — no dedicated fault-injection test; engine throws on invalid graph at assembly (fail-fast); silent bypass for runtime failures is not yet covered by a dedicated test |

---

## Sign-Off

All `[INV-1]` through `[INV-8]` have at least one passing automated proof.

`[INV-9]` is partially covered: invalid graph configurations are caught at assembly time (fail-fast), and `dispose` leaves the engine in a safe no-op state. A dedicated runtime fault-injection test (module throws during init → engine routes signal through bypass) is deferred and tracked in `docs/plans/audio_graph_refactor.md`.

---

## Definition of Done

- [x] `npm run build` is green
- [x] `npm run test` is green
- [x] `npm run test:e2e` is green
- [x] `npm run test:arch` is green (runs full unit + e2e suite)
- [x] No direct `Tone.getTransport()` usage in UI components
- [x] No `AudioNode` / `Tone.*` in public UI contracts
- [x] Invariant traceability is complete for INV-1 through INV-8; INV-9 is partial (see Sign-Off)

---

## Running the Suite

```
npm run test           # Vitest unit tests
npm run test:e2e       # Playwright E2E tests
npm run test:arch      # Combined: unit + e2e (alias for the full regression suite)
```
