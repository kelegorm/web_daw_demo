# Phase 5: Transport Decoupling + Integration Close-Out - Research

**Researched:** 2026-03-13
**Domain:** React hook decoupling, Tone.js Part lifecycle, Vitest + Playwright regression testing
**Confidence:** HIGH

## Summary

This phase has two parallel streams: (1) architectural surgery on `useTransportController` and the `createSequencer` Part lifecycle, and (2) a regression gate pass over the full Vitest + Playwright test suite. Both streams operate on code that already exists in this repository — no new libraries are needed.

The primary coupling to sever is `useTransportController`'s direct dependency on `TrackStripHook`. Currently, `trackStrip.setTrackMuted(muted)` is the only consumer of the `TrackStripHook` argument. The correct replacement is a plain callback `setTrackMuted: (muted: boolean) => void` in `TransportCoreDeps` — which already exists in the interface, already threaded through `createTransportCore`, and already tested. The React hook wrapper (`useTransportController`) is the only site that instantiates `trackStrip` as a parameter; removing it from the signature leaves a clean dep-injection interface with no transport/strip coupling.

The second stream is a known pre-existing issue: `jsdom@28` loaded under Node 20 with Vitest's CJS runner triggers `ERR_REQUIRE_ESM` for `html-encoding-sniffer`. This affects `DawProvider.test.tsx` (and potentially other `@vitest-environment jsdom` files) but is already documented and all those tests are marked `it.skip`. The 21 non-DOM test files (244 tests) all pass clean today. The regression task for this phase is to run both suites, confirm the 244-test baseline holds, and fix any new breakage introduced by Phase 4 or 5 changes.

**Primary recommendation:** Remove `TrackStripHook` from `useTransportController`'s signature — replace with the callback it already wraps. Drive the `setTrackMuted` callback from the engine facade via `useTrackFacade` or a direct engine call in Layout.

## Standard Stack

This phase introduces no new dependencies. All work is refactoring within the existing stack.

### Core (unchanged)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tone | ^15.x | Tone.Transport + Tone.Part scheduling | Already the runtime |
| react | ^18.x | Hook composition | Already the runtime |
| vitest | ^3.2.4 | Unit test runner | Already configured |
| @playwright/test | (existing) | E2E test runner | Already configured |

### No New Installations Required

```bash
# No new packages needed for Phase 5
```

## Architecture Patterns

### Recommended File Structure After Phase 5

```
src/
├── hooks/
│   ├── useTransportController.ts   # TrackStripHook removed from signature
│   └── useSequencer.ts             # Part lifecycle unchanged (already correct)
├── components/
│   └── Layout.tsx                  # Provides setTrackMuted callback from engine facade
│                                   # _legacy.getTrackStripGraph replaced by getTrackFacade
└── engine/
    └── engineSingleton.ts          # _legacy API can be deleted once Layout.tsx migrated
```

### Pattern 1: Removing TrackStripHook from useTransportController

**What:** Replace the `trackStrip: TrackStripHook` parameter with the internal callback it wraps, which already exists in `TransportCoreDeps.setTrackMuted`.

**When to use:** Always — the `TrackStripHook` parameter exists solely to feed `setTrackMuted`. Once the callsite provides that callback directly, the import disappears.

**Current signature (to change):**
```typescript
// Source: src/hooks/useTransportController.ts line 129-132
export function useTransportController(
  toneSynth: ToneSynthHook,
  trackStrip: TrackStripHook,                // <-- remove this
  sequencerClip: SequencerClipInput = DEFAULT_MIDI_CLIP_SOURCE,
): TransportController
```

**Target signature:**
```typescript
export function useTransportController(
  toneSynth: ToneSynthHook,
  setTrackMuted: (muted: boolean) => void,   // <-- plain callback
  sequencerClip: SequencerClipInput = DEFAULT_MIDI_CLIP_SOURCE,
): TransportController
```

**What changes inside the hook body:**
```typescript
// Before (lines 140-143):
const trackStripRef = useRef(trackStrip);
trackStripRef.current = trackStrip;
// ...
setTrackMuted: (muted) => trackStripRef.current.setTrackMuted(muted),

// After:
const setTrackMutedRef = useRef(setTrackMuted);
setTrackMutedRef.current = setTrackMuted;
// ...
setTrackMuted: (muted) => setTrackMutedRef.current(muted),
```

**What changes in the Layout.tsx callsite:**
```typescript
// Before (Layout.tsx line 61):
const transport = useTransportController(toneSynth, trackStrip, DEFAULT_MIDI_CLIP_SOURCE)

// After — drive mute from the engine facade directly:
const transport = useTransportController(
  toneSynth,
  (muted) => getAudioEngine().getTrackFacade(DEFAULT_TRACK_ID).setMute(muted),
  DEFAULT_MIDI_CLIP_SOURCE,
)
```

**Why this satisfies the success criteria:** The `TransportControllerState` interface still exposes `isTrackMuted` (needed by existing code and the `onTrackMuteSync` callback). The state remains self-contained in `useTransportController`. The `TrackStripHook` import is eliminated.

### Pattern 2: Per-Track Sequencer Part Scoping

**What:** Ensure `createSequencer.stop()` calls only `part.stop(0)` + `part.cancel(0)`, never `Tone.getTransport().stop()`.

**Current state:** The sequencer already does this correctly. The `stop()` function calls:
```typescript
// Source: src/hooks/useSequencer.ts line 153-163
part.stop(0);
part.cancel(0);
transport.stop();   // this is SequencerTransport.stop(), not Tone.getTransport().stop()
panic();
onStepChange?.(-1);
```

And `SequencerTransport` (passed in) is the `TransportService`, whose `.stop()` calls `Tone.getTransport().stop()`. This is the single-track design — stopping a sequencer stops the global transport.

**For multi-track safety (COMPAT-02):** Each track's sequencer must NOT call `Tone.getTransport().stop()` when removed during playback. The correct scope: `part.stop(0)` + `part.cancel(0)` only, without touching the global transport.

**Required change:** When removing a track, the Part must be scoped to just `part.stop(0)` + `part.cancel(0)`. The global transport stop must remain under `useTransportController` control only.

**Two approaches:**

Option A — Add a `dispose()` method to `Sequencer` that only stops the Part:
```typescript
// In createSequencer return value:
dispose() {
  _active = false;
  _isPlaying = false;
  part.stop(0);
  part.cancel(0);
  // NO transport.stop() here
  panic();
}
```

Option B — Pass a `stopTransport: boolean` flag to `stop()`.

**Recommendation:** Option A. A distinct `dispose()` method is semantically clear and avoids mutating the existing `stop()` contract (which the tests verify).

### Pattern 3: Transport in Context (COMP-01)

**What:** Move transport state (`isPlaying`, `bpm`, `loop`, `currentStep`) out of Layout props and into a React context so Toolbar can read it directly.

**When to use:** When the TrackZone `transport` prop seam and the Toolbar prop drilling are to be eliminated.

**Approach:** Create a `TransportContext` alongside the existing `DawProvider` split contexts. `useTransportController` can either be called inside the provider or a lightweight transport context wrapper can feed from it.

**Important constraint from STATE.md:** Reducer + context over Zustand/Redux (React built-ins only — STATE-08 hard constraint). Transport state is already managed by `useState` inside `useTransportController`, not the `dawReducer`. Transport context should be separate from `DawStateContext` and `DawUiContext`.

**Pattern:**
```typescript
// src/context/TransportContext.ts
const TransportStateContext = createContext<TransportControllerState | null>(null);
const TransportActionsContext = createContext<TransportControllerActions | null>(null);

export function useTransportState() { ... }
export function useTransportActions() { ... }
```

**Where to call the hook:** The hook must be called inside a React component. Options:
1. Call `useTransportController` in a `TransportProvider` component (clean)
2. Call it in `Layout.tsx` and pass the return value into a context (slightly less clean but simpler)

Option 1 is preferred — `TransportProvider` sits inside `DawProvider`:
```tsx
<DawProvider store={store}>
  <TransportProvider>
    <Layout />
  </TransportProvider>
</DawProvider>
```

This separates transport lifecycle from Layout.

### Pattern 4: Removing _legacy.getTrackStripGraph from Layout.tsx

**What:** `_singletonEngine._legacy.getTrackStripGraph(DEFAULT_TRACK_ID)` is used in Layout.tsx module scope to get the `_track1Strip` needed by `useTrackStrip`. Once the transport no longer accepts `TrackStripHook`, `useTrackStrip` and `_track1Strip` are no longer needed in Layout.

**When to use:** After Pattern 1 is complete — the `useTrackStrip(trackStrip)` hook call in Layout becomes dead code.

**After Pattern 1:**
```typescript
// These module-level lines in Layout.tsx become unnecessary:
// const _track1Strip = _singletonEngine._legacy.getTrackStripGraph(DEFAULT_TRACK_ID)
// ...
// const trackStrip = useTrackStrip(_track1Strip)  // ← dead code

// Delete them both. _legacy.getTrackStripGraph is no longer called anywhere.
// If _legacy has no other callers, the _legacy API can be removed from EngineApi.
```

### Anti-Patterns to Avoid

- **Calling `Tone.getTransport().stop()` in a per-track sequencer teardown:** This would silence all tracks when one is removed. Use `part.stop(0)` + `part.cancel(0)` only.
- **Putting transport state in `dawReducer`:** The roadmap explicitly states transport values (isPlaying, currentStep, bpm) are NOT in DawStateContext (Phase 2 success criterion #4). Keep them in a separate transport context or as hook state.
- **Removing `isTrackMuted` from `TransportControllerState`:** The `onTrackMuteSync` callback and existing Playwright tests rely on mute state flowing from the transport hook. Keep the state; only remove the `TrackStripHook` parameter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transport state sharing | Custom pub/sub or event bus | React.createContext + useContext | Already the pattern; STATE-08 mandates React built-ins only |
| Part cleanup on track remove | Manual timer or AudioContext cleanup | `part.stop(0)` + `part.cancel(0)` | Tone.js Part already has these methods |
| Test environment for DOM tests | Custom jsdom setup | Skip/defer — pre-existing known issue | jsdom@28+Node 20 CJS incompatibility; not Phase 5 scope |

**Key insight:** The sequencer Part cleanup pattern is already correct. The only bug is at the callsite level — when a track is removed, the code must call `dispose()` or the equivalent Part-only stop, not the global transport stop.

## Common Pitfalls

### Pitfall 1: Tone.getTransport().stop() Called on Track Remove

**What goes wrong:** If `removeTrack` in `DawStore` (or the Layout dispatch handler) calls the sequencer's `stop()` method directly, it also calls `transport.stop()` which globally halts all other tracks' sequencers.

**Why it happens:** The existing `Sequencer.stop()` is designed for "stop everything" — it calls the global transport stop. It was not designed for per-track teardown.

**How to avoid:** Add a `dispose()` method to `Sequencer` that only calls `part.stop(0)` + `part.cancel(0)` without touching the transport. Only `stop()` (which is the user-facing stop button) should halt the global transport.

**Warning signs:** During playback, clicking "Remove Track" causes the play button to show "stopped" state despite no stop button being pressed.

### Pitfall 2: useTransportController ref update race with callback change

**What goes wrong:** When `setTrackMuted` changes between renders (because Layout reconstructs it as an inline arrow function), the ref inside `useTransportController` needs to be updated in render, not in an effect, to avoid stale closure issues.

**Why it happens:** The existing code already handles this pattern correctly for `toneSynthRef` and `trackStripRef`. The pattern is: update the ref immediately on render body, not inside `useEffect`.

**How to avoid:** Follow the existing ref-update pattern:
```typescript
const setTrackMutedRef = useRef(setTrackMuted);
setTrackMutedRef.current = setTrackMuted;  // update in render body, not useEffect
```

**Warning signs:** Track mute toggles work initially then stop working after a re-render.

### Pitfall 3: isTrackMuted State Removed Prematurely

**What goes wrong:** If `isTrackMuted` is removed from `TransportControllerState` (thinking "the transport doesn't need to know about mute"), the `onTrackMuteSync` callback in Layout.tsx breaks and the existing Playwright tests fail.

**Why it happens:** `isTrackMuted` in the transport controller state is used to drive the UI mute state reactively. The TrackZone's `onMuteChanged` handler calls `onTrackMuteSync`, which calls `transport.setTrackMute`. The transport then holds the authoritative `isTrackMuted` boolean.

**How to avoid:** Keep `isTrackMuted` in `TransportControllerState`. Only remove the `TrackStripHook` from the *parameter* list. The internal `setTrackMuted` callback can route to the engine facade instead.

**Warning signs:** TypeScript errors on `transport.isTrackMuted` references in Layout or TrackZone.

### Pitfall 4: jsdom@28 ERR_REQUIRE_ESM Treated as New Failure

**What goes wrong:** The Vitest run shows 2 "Unhandled Errors" with `ERR_REQUIRE_ESM` from `html-encoding-sniffer`. If treated as new regressions, time is wasted trying to fix a pre-existing issue.

**Why it happens:** `jsdom@28` is ESM-only. Node 20 with Vitest's CJS runner cannot `require()` it. This was documented in `DawProvider.test.tsx` and is a pre-existing project-wide issue.

**How to avoid:** Treat the 2 unhandled errors as known noise. Focus on the test count: 244 tests pass = baseline met. The failing tests are all `it.skip`.

**Warning signs:** The test output shows "Test Files 21 passed (23)" — the 2 extra files are the 2 jsdom-environment files that produce unhandled errors, not new failures.

### Pitfall 5: TransportProvider Wrapping Order

**What goes wrong:** If `TransportProvider` is placed *outside* `DawProvider`, components inside `TransportProvider` cannot call `useDawDispatch()` (which requires `DawProvider` in the tree).

**Why it happens:** Context providers must be nested in the correct order: data dependencies go inside.

**How to avoid:** `DawProvider` wraps `TransportProvider` wraps `Layout`:
```tsx
<DawProvider store={store}>
  <TransportProvider>
    <Layout />
  </TransportProvider>
</DawProvider>
```

**Warning signs:** "must be used within DawProvider" runtime error when Toolbar or TrackZone tries to dispatch.

## Code Examples

### Removing TrackStripHook from useTransportController

```typescript
// Source: src/hooks/useTransportController.ts (before)
export function useTransportController(
  toneSynth: ToneSynthHook,
  trackStrip: TrackStripHook,
  sequencerClip: SequencerClipInput = DEFAULT_MIDI_CLIP_SOURCE,
): TransportController {
  // ...
  const trackStripRef = useRef(trackStrip);
  trackStripRef.current = trackStrip;
  // ...
  setTrackMuted: (muted) => trackStripRef.current.setTrackMuted(muted),
```

```typescript
// After (no TrackStripHook import, no trackStrip ref):
export function useTransportController(
  toneSynth: ToneSynthHook,
  setTrackMuted: (muted: boolean) => void,
  sequencerClip: SequencerClipInput = DEFAULT_MIDI_CLIP_SOURCE,
): TransportController {
  // ...
  const setTrackMutedRef = useRef(setTrackMuted);
  setTrackMutedRef.current = setTrackMuted;
  // ...
  setTrackMuted: (muted) => setTrackMutedRef.current(muted),
```

### Layout.tsx Callsite Change

```typescript
// Source: src/components/Layout.tsx (before)
const trackStrip = useTrackStrip(_track1Strip)   // dead after change
const transport = useTransportController(toneSynth, trackStrip, DEFAULT_MIDI_CLIP_SOURCE)

// After — drive mute from engine facade:
const transport = useTransportController(
  toneSynth,
  (muted) => getAudioEngine().getTrackFacade(DEFAULT_TRACK_ID).setMute(muted),
  DEFAULT_MIDI_CLIP_SOURCE,
)
// Delete: const _track1Strip = _singletonEngine._legacy.getTrackStripGraph(DEFAULT_TRACK_ID)
// Delete: const trackStrip = useTrackStrip(_track1Strip)
// Delete: useTrackStrip import
```

### Per-Track Sequencer Dispose (Part-only stop)

```typescript
// Source: src/hooks/useSequencer.ts — add dispose() to Sequencer interface and factory

export interface Sequencer {
  isPlaying: () => boolean;
  currentStep: () => number;
  start: () => void;
  pause: () => void;
  stop: () => void;
  setLoop: (loop: boolean) => void;
  dispose: () => void;   // NEW: Part-only cleanup, no global transport stop
}

// Inside createSequencer factory:
function dispose() {
  _active = false;
  _isPlaying = false;
  part.stop(0);
  part.cancel(0);
  // Deliberately does NOT call transport.stop()
  // Deliberately does NOT call panic() — caller decides whether to send note-offs
}

return {
  // ... existing methods
  dispose,
};
```

### TransportContext Pattern (COMP-01)

```typescript
// src/context/TransportContext.ts
import { createContext, useContext } from 'react';
import type { TransportControllerState, TransportControllerActions } from '../hooks/useTransportController';

const TransportStateCtx = createContext<TransportControllerState | null>(null);
const TransportActionsCtx = createContext<TransportControllerActions | null>(null);

export function useTransportState(): TransportControllerState {
  const ctx = useContext(TransportStateCtx);
  if (!ctx) throw new Error('useTransportState must be used within TransportProvider');
  return ctx;
}

export function useTransportActions(): TransportControllerActions {
  const ctx = useContext(TransportActionsCtx);
  if (!ctx) throw new Error('useTransportActions must be used within TransportProvider');
  return ctx;
}

export { TransportStateCtx, TransportActionsCtx };
```

```typescript
// src/context/TransportProvider.tsx
export function TransportProvider({ children }: { children: React.ReactNode }) {
  // useToneSynth and the setTrackMuted callback must be available here
  // This requires TransportProvider to be inside a scope where toneSynth is accessible,
  // OR toneSynth is provided via its own context
  const transport = useTransportController(toneSynth, setTrackMuted);

  const state: TransportControllerState = {
    isPlaying: transport.isPlaying,
    playbackState: transport.playbackState,
    bpm: transport.bpm,
    loop: transport.loop,
    isTrackMuted: transport.isTrackMuted,
    currentStep: transport.currentStep,
  };

  return (
    <TransportStateCtx.Provider value={state}>
      <TransportActionsCtx.Provider value={transport}>
        {children}
      </TransportActionsCtx.Provider>
    </TransportStateCtx.Provider>
  );
}
```

### Running the Regression Suite

```bash
# Vitest unit tests (expect: 21 files, 244 tests, 2 known jsdom errors)
npm run test

# Playwright E2E (expect: all specs pass)
npm run test:e2e
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useTransportController(toneSynth, trackStrip)` | `useTransportController(toneSynth, setTrackMuted)` | Phase 5 Plan 05-01 | TrackStripHook import removed, transport is strip-agnostic |
| `_legacy.getTrackStripGraph(DEFAULT_TRACK_ID)` in Layout | `getAudioEngine().getTrackFacade(trackId).setMute(muted)` callback | Phase 5 Plan 05-01 | `_legacy` API no longer used, can be deleted from EngineApi |
| `useTrackStrip(_track1Strip)` in Layout | Removed | Phase 5 Plan 05-01 | Hook no longer needed; mute routing goes through engine facade |
| Toolbar receives transport as props from Layout | Toolbar reads from `TransportContext` | Phase 5 Plan 05-01 | COMP-01 satisfied |
| TrackZone receives `transport` prop seam | TrackZone reads from `TransportContext` | Phase 5 Plan 05-01 | Phase 5 transport seam eliminated |

**Deprecated/outdated after Phase 5:**
- `TrackStripHook` parameter in `useTransportController`: replaced by callback
- `_legacy.getTrackStripGraph`: no callers remain after Layout.tsx cleanup
- `_legacy` API on `EngineApi`: can be deleted from `engineSingleton.ts` and `EngineApi` interface (after confirming no remaining callers)

## Open Questions

1. **Scope of COMP-01 in Plan 05-01**
   - What we know: COMP-01 = "Toolbar reads transport from hooks" (context) — deferred from Phase 4
   - What's unclear: Does COMP-01 require a full `TransportProvider` context, or just passing the transport hook return value as narrow props? The roadmap says "transport decoupling" which implies context.
   - Recommendation: Create `TransportContext` with split state/actions pattern (consistent with `DawStateContext`/`DawUiContext` pattern from Phase 2). This makes Toolbar a clean context consumer.

2. **Whether `_legacy` can be fully deleted**
   - What we know: After Pattern 4, `Layout.tsx` will no longer call `_legacy.getTrackStripGraph` or `_legacy.limiterGraph`. The `_limiterGraph` line uses `_singletonEngine._legacy.limiterGraph` — check if this is still needed after Layout cleanup.
   - What's unclear: Is `_legacy.limiterGraph` used anywhere other than Layout.tsx for `useLimiter`?
   - Recommendation: Grep for `_legacy` after Plan 05-01 changes. If no callers remain, delete the `_legacy` property from both the `EngineApi` interface and the `createEngineInternal` return.

3. **Whether `useTrackStrip` and `useTrackFacade` hooks conflict**
   - What we know: `useTrackStrip` wraps a `TrackStripHook` to add React state. `useTrackFacade` wraps a `TrackFacade` to add React state for the same purpose. Both exist.
   - What's unclear: After Phase 5, is `useTrackStrip` dead code? It is no longer called from Layout (Pattern 4 removes it). It may still be used in tests.
   - Recommendation: Do not delete `useTrackStrip` in Phase 5 — leave for a future cleanup phase. It's not causing any harm.

4. **onTrackMuteSync callback lifetime**
   - What we know: `onTrackMuteSync` in TrackZone calls `transport.setTrackMute(muted)` via Layout. After Phase 5, if transport is in context, TrackZone can call `useTransportActions().setTrackMute(muted)` directly.
   - What's unclear: Does `onTrackMuteSync` need to exist after transport is in context?
   - Recommendation: When TrackZone becomes a `TransportContext` consumer, delete `onTrackMuteSync` from the TrackZone prop interface and the callback from Layout.

## Sources

### Primary (HIGH confidence)
- Direct source code inspection of `src/hooks/useTransportController.ts` — current interface and impl
- Direct source code inspection of `src/hooks/useSequencer.ts` — Part lifecycle, stop() implementation
- Direct source code inspection of `src/components/Layout.tsx` — callsites and _legacy usage
- Direct source code inspection of `src/engine/engineSingleton.ts` — _legacy API surface
- `npm run test` output (2026-03-13) — 244 tests pass, 2 known jsdom errors, baseline confirmed
- `src/hooks/useTransportController.test.ts` — existing test coverage of `createTransportCore`
- `src/hooks/useSequencer.test.ts` — existing test coverage of `createSequencer`

### Secondary (MEDIUM confidence)
- `src/context/DawProvider.test.tsx` comment — documents jsdom@28 + Node 20 incompatibility
- `.planning/phases/04-component-migration-track-crud/04-03-PLAN.md` — documents Phase 5 seams

### Tertiary (LOW confidence)
- None — all findings are from direct code inspection of the repository

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, verified from package.json and existing code
- Architecture patterns: HIGH — derived from reading the actual source code and test contracts
- Pitfalls: HIGH — most are directly observable in the current codebase or documented in existing plan files
- Transport context pattern: MEDIUM — the approach is clear but exact provider placement (inside/outside Layout) has one open question about toneSynth availability

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain — only internal code changes)
