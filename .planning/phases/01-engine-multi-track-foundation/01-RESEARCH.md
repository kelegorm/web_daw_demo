# Phase 1: Engine Multi-Track Foundation - Research

**Researched:** 2026-03-12
**Domain:** Web Audio API singleton pattern, multi-track subgraph lifecycle, TypeScript facade classes
**Confidence:** HIGH — all findings sourced from direct codebase inspection

## Summary

This phase refactors the existing single-track audio engine into a module-level singleton managing N parallel track subgraphs. The codebase already has mature primitives — `createTrackStrip`, `createMasterStrip`, `createLimiter`, `createMeterSource` — that become the building blocks. The main work is: (1) replacing the React-managed `useAudioEngine` hook with a module-level singleton, (2) wrapping per-track audio nodes in `TrackFacade` class instances with a dispose guard, (3) introducing a `preLimiterBus` GainNode as a summing point, and (4) deleting the APP_* constants that are now replaced by `getTrackFacade(trackId)`.

The existing factory pattern in `audioEngine.ts` (plan-based graph assembly) is NOT what the new engine follows — the new engine is an imperative singleton with dynamic `createTrackSubgraph`/`removeTrackSubgraph` calls, not a static plan. The plan-based factory machinery can be removed entirely from the engine module, or left in place if other phases need it.

The StrictMode guard is the trickiest concern: the current `useAudioEngine` hook creates a new engine in `useEffect` (which fires twice in StrictMode), disposes the first, and uses the second. The new singleton must never be created twice in the same page session — the guard must live at module scope, not inside a React hook.

**Primary recommendation:** Create `src/engine/audioEngine2.ts` (or replace `audioEngine.ts`) as the new module. Export `getAudioEngine()` as the sole public entry point. Keep `createTrackStrip` as the internal factory for track subgraphs.

## Standard Stack

No new libraries are needed. This phase uses only what the codebase already has:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API (native) | Browser-native | AudioContext, GainNode, AnalyserNode, ChannelSplitter | Already used in all create* factories |
| TypeScript | ~5.7.2 | Facade interfaces, class with private fields | Already in use |
| Vitest | ^3.2.1 | Unit tests for singleton and lifecycle | Already configured with jsdom |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tone.js | ^15.1.22 | Transport and synth device (not track engine) | For device facades only — NOT for the bus/strip level |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Module-level singleton | React context + useRef | Context requires a Provider, couples engine to React tree — decision locked |
| Class instance (TrackFacade) | Plain object with closure | Class gives cleaner instanceof checks and dispose guard — context decision locked |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended File Structure

```
src/engine/
├── audioEngine.ts        # REPLACE: was plan-based factory, becomes singleton module
├── types.ts              # ADD: TrackFacade, MasterFacade, DeviceFacade interfaces
├── meterSource.ts        # UNCHANGED: createMeterSource already exists
├── audioGraphPlan.ts     # KEEP or REMOVE: no longer used by engine core after this phase
└── (test files)
```

The `TrackFacade` class lives in `src/engine/types.ts` or a new `src/engine/trackFacade.ts`. Either works — the key constraint is that `TrackFacade` does not import from React hooks.

### Pattern 1: Module-Level Singleton with Idempotent Getter

**What:** Engine lives as a module-scope variable initialized on first `getAudioEngine()` call (or eagerly on module import per decision).
**When to use:** Always — this is the only creation path.

```typescript
// src/engine/audioEngine.ts (new shape)
let _engine: AudioEngineInternal | null = null;

export function getAudioEngine(): AudioEngine {
  if (!_engine) {
    _engine = createEngineInternal();
  }
  return _engine;
}
```

The decision says "AudioContext created eagerly on module import" — this means `getAudioEngine()` is still idempotent (returns same instance) but the AudioContext creation happens when the module is first imported, not deferred. Either approach satisfies the StrictMode requirement; the idempotent getter is the safer choice and makes tests easier to control.

**StrictMode guard:** Because the singleton lives at module scope outside React, StrictMode double-invocation of hooks simply calls `getAudioEngine()` twice and gets the same instance both times. No dispose/recreate cycle. This is simpler than the current `useAudioEngine` hook approach.

**Test implication:** Tests must reset the module-level singleton between test files. Use `vi.resetModules()` or export a `_resetEngineForTesting()` function (prefixed with underscore to mark as test-only). The existing `useAudioEngine.test.tsx` will need to be replaced since the hook is being deleted.

### Pattern 2: TrackFacade as Class with Dispose Guard

**What:** Each track subgraph is wrapped in a class instance. Private fields hold node refs. Public methods delegate to nodes. After `dispose()`, all methods throw.
**When to use:** For all track facades.

```typescript
// Based on existing facade pattern in audioEngine.ts (lines 330-342)
class TrackFacade {
  #disposed = false;
  #gainNode: GainNode;
  #muteNode: GainNode;
  #meterSource: MeterSource;

  constructor(audioContext: AudioContext) {
    // createTrackStrip already does this wiring
    const strip = createTrackStrip(audioContext);
    this.#gainNode = strip.input; // or hold the full strip
    this.#meterSource = strip.meterSource;
    // ...
  }

  setGain(db: number): void {
    if (this.#disposed) throw new Error('[TrackFacade] method called on disposed facade');
    // ...
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    // disconnect from preLimiterBus, dispose strip nodes
  }
}
```

**Important:** The decision says "only expose what is actually used elsewhere." Before defining the full TrackFacade API, audit what `TrackStripHook` callers actually use in `App.tsx`:
- `trackStrip.trackVolume` (read)
- `trackStrip.isTrackMuted` (read)
- `trackStrip.setTrackVolume(db)` (write)
- `trackStrip.setTrackMuted(muted)` (write)
- `trackStrip.meterSource` (read, passed to VUMeter)

This matches `TrackStripHook` exactly. TrackFacade methods: `setGain(db)`, `setMute(muted)`, `getMeterLevel()` per the context, plus `getVolume()` and `isMuted()` for reads. The `meterSource` property should remain since `VUMeter` uses it directly via `subscribe`.

### Pattern 3: preLimiterBus as Unity-Gain GainNode

**What:** A single `GainNode` at unity gain (1.0) that all track output GainNodes connect to. Its output connects to the limiter input.
**When to use:** Created on engine bootstrap, never recreated.

```typescript
// Signal chain after this phase:
// track[0].output → preLimiterBus
// track[1].output → preLimiterBus
// ...
// preLimiterBus → limiterInput → limiterOutput → masterStrip.input → masterStrip.output → destination

const preLimiterBus = audioContext.createGain();
preLimiterBus.gain.value = 1.0; // pass-through, no level control
```

**Disconnecting a track:** When `removeTrackSubgraph(trackId)` is called, the track's output GainNode must be explicitly disconnected from `preLimiterBus` before the strip nodes are disposed. The Web Audio spec allows disconnecting from a specific destination: `trackOutput.disconnect(preLimiterBus)`.

### Pattern 4: Track Registry as Map

**What:** Engine keeps a `Map<string, TrackFacade>` keyed by `trackId`. `getTrackFacade(trackId)` does a map lookup.

```typescript
const trackRegistry = new Map<string, TrackFacade>();

function createTrackSubgraph(trackId: string): TrackFacade {
  if (trackRegistry.has(trackId)) {
    throw new Error(`[engine] track already exists: ${trackId}`);
  }
  const facade = new TrackFacade(audioContext);
  facade.connectToBus(preLimiterBus);
  trackRegistry.set(trackId, facade);
  return facade;
}

function removeTrackSubgraph(trackId: string): void {
  const facade = trackRegistry.get(trackId);
  if (!facade) return; // idempotent
  facade.dispose();
  trackRegistry.delete(trackId);
}

function getTrackFacade(trackId: string): TrackFacade {
  const facade = trackRegistry.get(trackId);
  if (!facade) throw new Error(`[engine] unknown trackId: ${trackId}`);
  return facade;
}
```

### Pattern 5: Interface Definitions in types.ts

**What:** `TrackFacade`, `MasterFacade`, and `DeviceFacade` are interface types (for consumers) backed by class implementations (for the engine internals). Keep interfaces in `types.ts`, implementations in their own files or co-located in `audioEngine.ts`.

Per the context decisions:
- `TrackFacade`: gain, mute, meters only — no synth, no pan
- `MasterFacade`: master gain, meters only — no limiter
- `DeviceFacade`: accessed via `engine.getDeviceFacade(trackId, deviceType)` — defined but NOT fully wired in this phase (device registration is a later concern)

### Anti-Patterns to Avoid

- **Passing AudioContext from Tone.getContext() in the singleton:** The decision says "AudioContext created eagerly on module import." Use `new AudioContext()` directly, not `Tone.getContext().rawContext` — the existing `createTrackStrip` fallback to Tone.getContext() is a workaround for the old hook-based instantiation. The new singleton owns its AudioContext.
- **Calling dispose() on the singleton:** Decision: "Engine is app-lifetime — no dispose() method." Do not add `dispose()` to the new `AudioEngine` public interface.
- **Removing the old useAudioEngine hook before updating App.tsx:** Update App.tsx to call `getAudioEngine()` directly and delete `useAudioEngine` only after confirming no imports remain. The hook is currently the only consumer.
- **Keeping APP_* constants alongside getTrackFacade:** Requirements ENG-07 explicitly deletes all five APP_* constants. Any code that branches on `runtimeTrack.trackStripId === APP_TRACK_STRIP_ID` must be updated to use `getTrackFacade` uniformly.
- **Eager AudioContext creation blocking tests:** Module-level `new AudioContext()` at import time will run in Vitest/jsdom. jsdom supports a minimal AudioContext via the `jest-environment-jsdom` shim or the browser API mock. Verify jsdom's AudioContext mock is sufficient or mock AudioContext in engine tests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Track gain + mute + meters | Custom audio node chain | `createTrackStrip(audioContext)` | Already exists in `useTrackStrip.ts`, tested, correct |
| Master gain + meters | Custom | `createMasterStrip(audioContext)` | Already exists in `useMasterStrip.ts` |
| Limiter processing | Custom compressor | `createLimiter(audioContext)` | Already exists in `useLimiter.ts` |
| Meter frame reading | Custom RAF loop | `createMeterSource(analyserL, analyserR)` | Already exists in `meterSource.ts`, handles subscribe/unsubscribe lifecycle |
| Safe node disconnect | try/catch inline | `safeDisconnect()` helper | Already in `audioEngine.ts` lines 59-66, copy or extract to shared utils |
| Disposed-facade guard | Custom decorator | Inline `#disposed` private field check in class | Simple, already used in existing facade pattern |

**Key insight:** The primitives are all already written. This phase is about assembling them into a new ownership model, not rewriting audio processing logic.

## Common Pitfalls

### Pitfall 1: Module-Level AudioContext in jsdom Tests

**What goes wrong:** `new AudioContext()` at module import time fails silently or throws in jsdom because jsdom's Web Audio support is incomplete.
**Why it happens:** jsdom does not ship a full AudioContext implementation. The existing tests mock `Tone.getContext().rawContext` to avoid this.
**How to avoid:** In unit tests for the new engine module, mock `AudioContext` at the top of the test file with a minimal mock (createGain, createAnalyser, createChannelSplitter, destination). The existing patterns in `useTrackStrip.test.ts` show exactly how to structure this mock.
**Warning signs:** Test file importing the new engine module causes "AudioContext is not defined" or "Cannot read properties of undefined (reading 'createGain')" errors.

### Pitfall 2: Module Singleton Not Resetting Between Tests

**What goes wrong:** Test A creates a track subgraph. Test B starts with a non-empty track registry, causing duplicate-id errors or stale node references.
**Why it happens:** Module-level variables persist across test cases within the same test run unless explicitly reset.
**How to avoid:** Export a `_resetEngineForTesting()` function that sets `_engine = null`. Call it in `beforeEach` of engine tests. Alternatively, use `vi.resetModules()` before each test that imports the engine module — but this is slower.
**Warning signs:** Tests pass in isolation but fail when run together; "track already exists" errors in second test.

### Pitfall 3: Disconnecting a Track from preLimiterBus While Playing

**What goes wrong:** `removeTrackSubgraph` calls `strip.dispose()` which disconnects all internal nodes, but forgets to disconnect the track's output from `preLimiterBus` first. The preLimiterBus may still have a reference to the disposed node.
**Why it happens:** The existing `dispose()` pattern in `createTrackStrip` disconnects internal nodes (inputGain → trackGain → analyser → outputGain) but not the outputGain's external connections.
**How to avoid:** In `removeTrackSubgraph`, call `trackOutput.disconnect(preLimiterBus)` BEFORE calling `facade.dispose()`. The Web Audio API allows disconnecting from a specific destination node.
**Warning signs:** Audio artifacts (pops, clicks) when removing tracks during playback; memory leaks in audio graph.

### Pitfall 4: APP_* Constant Replacement Misses Comparison Sites

**What goes wrong:** `APP_TRACK_STRIP_ID` is used not only to call `audioEngine.getTrackStrip(APP_TRACK_STRIP_ID)` but also in comparison: `runtimeTrack.trackStripId === APP_TRACK_STRIP_ID` (App.tsx lines 98, 102, 106, 143, 159). If the comparison sites are not updated, the special-case branching logic remains even after the getTrackFacade migration.
**Why it happens:** ENG-05 says "replacing hardcoded APP_* constant lookups" but the constants serve two distinct purposes: as argument to `audioEngine.getTrackStrip()` AND as comparison keys in track routing logic.
**How to avoid:** After migration to `getTrackFacade`, the routing branching in App.tsx (lines 92-165) should disappear entirely — all tracks should be handled uniformly via facade, with no special-casing for "the active track." Verify there are zero occurrences of the old constants after ENG-07.
**Warning signs:** TypeScript will catch undefined variable references after constant deletion, making this hard to miss — but be aware the comparison logic itself must also be restructured, not just the identifier replaced.

### Pitfall 5: TrackFacade Exposing MeterSource Breaks After Dispose

**What goes wrong:** A React component holds a reference to `trackFacade.meterSource` and calls `meterSource.subscribe()` after the facade is disposed. The analyser nodes no longer exist, but the RAF loop may still try to read from them.
**Why it happens:** `createMeterSource` returns a subscription object that holds references to `analyserL` and `analyserR`. When `dispose()` is called on the strip, those analysers are disconnected from the graph but not garbage-collected immediately.
**How to avoid:** The `createMeterSource` implementation reads `analyserL.getByteTimeDomainData(buf)` on each RAF tick. A disconnected AnalyserNode returns silence (all 128s in byte format), so the meter will show 0 rather than crash. This is acceptable. However, new subscriptions to a disposed facade should throw — the facade's dispose guard covers the `meterSource` getter too: after dispose, `facade.meterSource` throws.
**Warning signs:** VUMeter shows non-zero levels after track removal.

### Pitfall 6: Default Track Created on Bootstrap Conflicts With createTrackSubgraph

**What goes wrong:** The engine boots with one default track already created ("Engine starts with one default track" from the context decision). If the calling code then calls `createTrackSubgraph('default')` without knowing about the pre-created track, it gets a "track already exists" error.
**Why it happens:** The engine creates the default track internally during bootstrap but the caller doesn't know the track ID.
**How to avoid:** Document the default track ID as a constant (e.g., `DEFAULT_TRACK_ID = 'track-1'`). The engine bootstrap creates a track with that ID and `getTrackFacade(DEFAULT_TRACK_ID)` returns it immediately. The App.tsx migration must use `DEFAULT_TRACK_ID` instead of `APP_TRACK_STRIP_ID` where the default track's facade is needed.

## Code Examples

### Singleton Module Pattern

```typescript
// src/engine/audioEngine.ts - new shape
// Source: codebase pattern, adapted for singleton

let _audioContext: AudioContext | null = null;
let _engine: MultiTrackEngine | null = null;

function getAudioContext(): AudioContext {
  if (!_audioContext) {
    _audioContext = new AudioContext();
  }
  return _audioContext;
}

export function getAudioEngine(): MultiTrackEngine {
  if (!_engine) {
    _engine = buildEngine(getAudioContext());
  }
  return _engine;
}

// For testing only
export function _resetEngineForTesting(): void {
  _engine = null;
  _audioContext = null;
}
```

### TrackFacade Class Pattern

```typescript
// src/engine/trackFacade.ts
// Source: adapted from existing TrackStripGraph + audioEngine.ts facade pattern

import { createTrackStrip, type TrackStripGraph } from '../hooks/useTrackStrip';
import type { MeterSource } from './types';

export class TrackFacade {
  #disposed = false;
  #strip: TrackStripGraph;

  constructor(audioContext: AudioContext) {
    this.#strip = createTrackStrip(audioContext);
  }

  get output(): GainNode {
    return this.#strip.output;
  }

  get meterSource(): MeterSource {
    this.#assertNotDisposed();
    return this.#strip.meterSource;
  }

  get volumeDb(): number {
    this.#assertNotDisposed();
    return this.#strip.trackVolume;
  }

  get isMuted(): boolean {
    this.#assertNotDisposed();
    return this.#strip.isTrackMuted;
  }

  setGain(db: number): void {
    this.#assertNotDisposed();
    this.#strip.setTrackVolume(db);
  }

  setMute(muted: boolean): void {
    this.#assertNotDisposed();
    this.#strip.setTrackMuted(muted);
  }

  connectToBus(bus: GainNode): void {
    this.#assertNotDisposed();
    this.#strip.output.connect(bus);
  }

  disconnectFromBus(bus: GainNode): void {
    try {
      this.#strip.output.disconnect(bus);
    } catch {
      // ignore
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#strip.dispose();
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error('[TrackFacade] method called on disposed facade');
    }
  }
}
```

### createTrackSubgraph / removeTrackSubgraph

```typescript
// Source: codebase pattern, engine registry

function createTrackSubgraph(trackId: string): void {
  if (trackRegistry.has(trackId)) {
    throw new Error(`[audio-engine] track already exists: ${trackId}`);
  }
  const facade = new TrackFacade(audioContext);
  facade.connectToBus(preLimiterBus);
  trackRegistry.set(trackId, facade);
}

function removeTrackSubgraph(trackId: string): void {
  const facade = trackRegistry.get(trackId);
  if (!facade) return; // idempotent
  facade.disconnectFromBus(preLimiterBus);
  facade.dispose();
  trackRegistry.delete(trackId);
}
```

### Bus Topology Bootstrap

```typescript
// Source: Web Audio API spec, codebase pattern

function buildEngine(audioContext: AudioContext): MultiTrackEngine {
  const preLimiterBus = audioContext.createGain();
  preLimiterBus.gain.value = 1.0; // unity gain, summing only

  const limiterGraph = createLimiter(audioContext);
  const masterStripGraph = createMasterStrip(audioContext);

  preLimiterBus.connect(limiterGraph.input);
  limiterGraph.output.connect(masterStripGraph.input);
  masterStripGraph.output.connect(audioContext.destination);

  // Create default track
  const trackRegistry = new Map<string, TrackFacade>();
  // ... bootstrap default track

  return { createTrackSubgraph, removeTrackSubgraph, getTrackFacade, /* ... */ };
}
```

### Vitest Mock Pattern for New Engine Module

```typescript
// In test files that import from engine module
// Source: src/hooks/useTrackStrip.test.ts (lines 46-57)

const mockGainNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1 },
};

const mockAudioContext = {
  createGain: vi.fn(() => mockGainNode),
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 256,
    getByteTimeDomainData: vi.fn(),
  })),
  createChannelSplitter: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
  createDynamicsCompressor: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    threshold: { value: -3 },
    knee: { value: 0 },
    ratio: { value: 20 },
    attack: { value: 0.001 },
    release: { value: 0.1 },
    reduction: 0,
  })),
  destination: { connect: vi.fn(), disconnect: vi.fn() },
};

// Mock before importing the engine module
vi.mock('../engine/audioEngine', async () => {
  // ... or control AudioContext directly
});
```

## App.tsx Migration Map

The existing `App.tsx` uses APP_* constants in two ways: as ID arguments and as comparison keys. After migration:

| Current code | After migration |
|---|---|
| `audioEngine.getSynth(APP_SYNTH_MODULE_ID)` | `getDeviceFacade(DEFAULT_TRACK_ID, 'SYNTH')` or later phase |
| `audioEngine.getTrackStrip(APP_TRACK_STRIP_ID)` | `getAudioEngine().getTrackFacade(DEFAULT_TRACK_ID)` |
| `runtimeTrack.trackStripId === APP_TRACK_STRIP_ID` branch | removed — all tracks uniform via facade |
| `useAudioEngine()` hook call | `getAudioEngine()` direct call (no hook needed) |

The APP_* constants live ONLY in App.tsx (confirmed by grep). Deleting them is a single-file change once the facade API is in place.

## State of the Art

| Old Approach | Current Approach | Impact |
|---|---|---|
| Plan-based graph assembly (AudioGraphPlan, validateAudioGraphPlan) | Imperative singleton with dynamic track registry | Simpler for multi-track; plan validation no longer needed for engine core |
| React-managed engine lifecycle (useAudioEngine hook) | Module-level singleton, no React lifecycle dependency | Engine survives StrictMode, component unmounts, etc. |
| Single hardcoded track (APP_TRACK_STRIP_ID) | N tracks via createTrackSubgraph(trackId) | Enables variable track count |
| Facade pattern inside createAudioEngine (inline objects) | TrackFacade class with private fields + dispose guard | Surfaces bugs faster; cleaner ownership |

**Deprecated/outdated after this phase:**
- `useAudioEngine` hook: replaced by `getAudioEngine()`
- `AudioGraphPlan`, `validateAudioGraphPlan`, `AudioModuleFactoryMap`: no longer part of the engine core (may be removed)
- `DEFAULT_AUDIO_GRAPH_PLAN`, all `DEFAULT_PLAN_*_ID` constants: used only to resolve APP_* constants, become unused
- `AudioModuleKind` enum: may become unused if plan-based assembly is removed

## Open Questions

1. **Plan-based machinery fate**
   - What we know: `audioGraphPlan.ts` is currently imported by `audioEngine.ts` and `App.tsx` (via `useAudioEngine.ts`)
   - What's unclear: Whether other phases (devices, sequencer) need plan-based assembly or only the imperative API
   - Recommendation: Leave `audioGraphPlan.ts` in place but stop importing it from the new engine. Delete it only if no other phase needs it. For this phase, treat it as dead code after the migration.

2. **DeviceFacade in this phase vs. later phases**
   - What we know: Context says DeviceFacade interfaces are defined in this phase, but device CRUD and UI wiring are later phases
   - What's unclear: Whether `engine.getDeviceFacade(trackId, deviceType)` needs to actually work in this phase, or just be stubbed with the interface defined
   - Recommendation: Define the `DeviceFacade` interface and `getDeviceFacade` signature in this phase; the implementation that maps device types to the actual Synth/Panner/Limiter graphs can be a stub that throws "not yet implemented" until the relevant later phase wires it.

3. **AudioContext ownership when Tone.js also needs one**
   - What we know: Tone.js uses its own AudioContext internally (`Tone.getContext().rawContext`). The existing `createToneSynth` and `createPanner` fallback to `Tone.getContext().rawContext`. If the singleton creates a fresh `new AudioContext()`, Tone nodes may be on a different context.
   - What's unclear: Whether we can pass our singleton AudioContext to Tone.js or whether Tone always manages its own.
   - Recommendation: The synth is a device, not a track strip concern. For this phase (track strips only, no synth device wiring), the singleton creates its own `AudioContext` for GainNodes, AnalyserNodes, etc. Tone.js AudioContext coexistence is a device-layer concern and can be resolved in the phase that wires synth devices to track subgraphs.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection of:
  - `src/engine/audioEngine.ts` — existing plan-based factory, current facade pattern
  - `src/engine/types.ts` — existing type contracts (AudioModule, MeterFrame, MeterSource)
  - `src/engine/meterSource.ts` — existing meter subscription implementation
  - `src/hooks/useTrackStrip.ts` — existing createTrackStrip factory and API surface
  - `src/hooks/useMasterStrip.ts` — existing createMasterStrip factory
  - `src/hooks/useLimiter.ts` — existing createLimiter factory
  - `src/hooks/useAudioEngine.ts` — current React-managed engine lifecycle
  - `src/App.tsx` — all APP_* constant definitions and all callsites (confirmed single file)
  - `src/audio/parameterDefaults.ts` — TRACK_VOLUME_DEFAULT_DB, AUDIO_DB_MIN/MAX
  - `vitest.config.ts` — jsdom environment confirmed
  - `src/hooks/useTrackStrip.test.ts` — AudioContext mock pattern for unit tests

### Secondary (MEDIUM confidence)

- Web Audio API spec behavior: `AudioNode.disconnect(destinationNode)` allows disconnecting from a specific downstream node — this is standard Web Audio API, confirmed by MDN documentation structure and used implicitly in existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing code inspected
- Architecture patterns: HIGH — directly derived from existing codebase code, not speculative
- Pitfalls: HIGH — identified from actual code (e.g., the comparison sites in App.tsx at lines 98, 102, 106, 143, 159 were found by grep, not guessed)
- App.tsx migration map: HIGH — grep confirmed APP_* constants only exist in App.tsx

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain, 30-day estimate)
