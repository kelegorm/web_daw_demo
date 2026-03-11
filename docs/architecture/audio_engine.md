# Audio Engine Architecture

## Overview

The audio engine is assembled in a single composition root (`createAudioEngine`) and exposed to the UI through intent-level contracts. No `AudioNode` or `Tone.*` types appear in public UI-facing hooks.

---

## Graph

Signal chain (left to right):

```
synth -> panner -> track-strip -> limiter -> master-strip -> destination
```

Each arrow is a `connect(input)` call established by `assembleAudioGraph` inside `createAudioEngine`. No module connects itself to `destination` independently.

---

## Modules

### synth (`src/hooks/useToneSynth.ts`)

- Instrument: `Tone.PolySynth` + `Tone.Filter`
- Owns note lifecycle: `noteOn(midi, velocity, time?)`, `noteOff(midi, time?)`, `panic()`
- Owns synth params: `filterCutoff`, `voiceSpread`, `volume`, `isEnabled`
- Public type: `ToneSynthHook` — intent-level only, no `Tone.*` exposed

### panner (`src/hooks/usePanner.ts`)

- Stage: `StereoPannerNode` + bypass toggle
- Owns pan position and bypass only
- Public type: `PannerHook`

### track-strip (`src/hooks/useTrackStrip.ts`)

- Stage: track gain node + mute control + stereo analyser taps
- Owns track volume, mute, and meter output
- Public type: `TrackStripHook` — exposes `meterSource: MeterSource`, not `AnalyserNode`

### limiter (`src/hooks/useLimiter.ts`)

- Stage: `DynamicsCompressorNode` + bypass + gain-reduction meter + input analyser taps
- Owns limiter threshold, enable/bypass, gain-reduction readout, and meter output
- Public type: `LimiterHook` — exposes `meterSource: MeterSource`, `getReductionDb(): number`

### master-strip (`src/hooks/useMasterStrip.ts`)

- Stage: master gain node + stereo analyser taps
- Owns master volume and meter output
- Public type: `MasterStripHook` — exposes `meterSource: MeterSource`

---

## Lifecycle

All long-lived audio resources use an explicit lifecycle:

```
createAudioEngine()   — assembles graph, wires modules
useAudioEngine()      — React hook; calls createAudioEngine in useEffect, disposes on cleanup
engine.dispose()      — disconnects all graph edges, disposes all modules (idempotent)
```

`useAudioEngine` (`src/hooks/useAudioEngine.ts`) is the only place in the React tree that creates the engine. `App.tsx` consumes the returned `AudioEngine | null` and passes modules to UI hooks.

StrictMode safety: double mount/unmount creates and disposes cleanly — no duplicate graphs.

After `dispose()`, all public engine methods are safe no-ops.

---

## Transport

Transport is managed through `TransportService` (`src/engine/transportService.ts`), which wraps `Tone.getTransport()` behind an intent-level contract. UI components and `useTransportController` do not call `Tone.getTransport()` directly.

### TransportService contract

```typescript
interface TransportService {
  getSnapshot(): TransportSnapshot;   // { isPlaying, positionSeconds, currentStep, bpm }
  subscribe(listener: () => void): () => void;
  play(): void;
  pause(): void;
  stop(): void;
  setBpm(bpm: number): void;
  setLoopConfig(loop: boolean, loopEnd: string): void;
  updateCurrentStep(step: number): void;
  dispose(): void;
}
```

### TransportController (`src/hooks/useTransportController.ts`)

- Creates `TransportService` and `TransportCore` on first render (via `useRef`)
- Exposes React state: `isPlaying`, `playbackState`, `bpm`, `loop`, `isTrackMuted`, `currentStep`
- Exposes actions: `play/pause/stop/toggle`, `setBpm`, `setLoop`, `setTrackMute`, `panic`, `getPositionSeconds`
- Delegates sequencing to `createSequencer` via `createTransportCore`
- State transitions:
  - `pause()` — keeps current step, does not call panic
  - `stop()` — resets step to -1, calls panic exactly once
  - `setTrackMute(true)` — silences via channel-strip gain; sequencer timing continues

### Sequencer (`src/hooks/useSequencer.ts`)

- Schedules 8-note sequence via `Tone.Part` + `Tone.getTransport()`
- `noteOff` is scheduled via `Tone.Transport.scheduleOnce` (audio-time), not `setTimeout`
- `noteOn` and `noteOff` share the same audio-time domain
- `stop()`/`pause()` cancels pending note-off events deterministically

---

## Meter Contracts

Meter data flows from engine modules to UI via `MeterSource`, defined in `src/engine/types.ts`:

```typescript
interface MeterFrame {
  leftRms: number;   // 0..1
  rightRms: number;  // 0..1
  leftPeak: number;  // 0..1
  rightPeak: number; // 0..1
}

interface MeterSource {
  subscribe(cb: (frame: MeterFrame) => void): () => void;
}
```

- `AnalyserNode` is internal to each module; it is never exposed to UI.
- `VUMeter` and `TrackZone` subscribe to `MeterSource` directly.
- Subscriptions return an unsubscribe function; callers clean up in `useEffect` returns.

---

## Architecture Invariants

See `docs/architecture/regression_gate.md` for the full invariant traceability table (INV-1..INV-9).

Key invariants:
- Single composition point: `createAudioEngine` (INV-1)
- No module self-connects to `destination` (INV-2)
- All `AudioNode` instances share one `AudioContext` (INV-3)
- Modules have no knowledge of neighbors — only `input/output/params` contracts (INV-4)
- UI hooks do not accept or return `AudioNode` / `Tone.*` (INV-5, INV-6)
- Sequencer and transport share one time domain — no `setTimeout` for note lifecycle (INV-7)
- All long-lived audio resources have an explicit `init/start/stop/dispose` lifecycle (INV-8)

---

## Key Source Files

| File | Responsibility |
|------|---------------|
| `src/engine/audioEngine.ts` | Graph assembly, validation, module wiring, `createAudioEngine` |
| `src/engine/types.ts` | `AudioModule`, `MeterFrame`, `MeterSource` |
| `src/engine/transportService.ts` | `TransportService`, `createTransportService` |
| `src/hooks/useAudioEngine.ts` | React lifecycle wrapper for engine |
| `src/hooks/useTransportController.ts` | Transport/playback UI state, `createTransportCore` |
| `src/hooks/useSequencer.ts` | Step sequencing, audio-time scheduling |
| `src/hooks/useToneSynth.ts` | Synth instrument + note lifecycle |
| `src/hooks/usePanner.ts` | Pan + bypass stage |
| `src/hooks/useTrackStrip.ts` | Track gain, mute, meter tap |
| `src/hooks/useLimiter.ts` | Limiter, gain reduction, meter tap |
| `src/hooks/useMasterStrip.ts` | Master gain, meter tap |
| `src/components/VUMeter.tsx` | Stereo meter visualization |
| `src/components/TrackZone.tsx` | Timeline, playhead, track/master strip UI |

---

## What Is Not Part of the Active Runtime

`build:wasm` / `scripts/build-wasm.js` compiles a legacy AudioWorklet/WASM synth prototype. It is not wired into the app and is retained for historical reference only. The active synth is `Tone.PolySynth` via `useToneSynth`.
