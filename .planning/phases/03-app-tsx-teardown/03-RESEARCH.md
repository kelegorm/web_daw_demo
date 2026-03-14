# Phase 3: App.tsx Teardown - Research

**Researched:** 2026-03-13
**Domain:** React application teardown — removing React lifecycle state from App.tsx, wiring DawProvider + Layout, deleting deprecated hooks, and deciding buildUiRuntime fate
**Confidence:** HIGH (all findings from direct codebase inspection; no external library questions to resolve)

## Summary

Phase 3 is a codebase surgery task, not a library-research task. The standard stack is already decided (React 19, built-ins only). The research question is: what exactly exists, what must be deleted, what must be created, and where are the landmines?

App.tsx currently does six jobs: creates module-level graphs (synth, panner), wires them into the singleton, builds a legacyEngineAdapter, calls six UI hooks, assembles composite models (TrackZoneModel, DevicePanelModel), and defines action callbacks. All of this must be redistributed — mostly moved into a new Layout component.

`buildUiRuntime` is the most complex decision. It currently serves two duties: resolving per-track audio hook instances from the AudioEngine interface, and resolving per-selected-track device modules for DevicePanel. The first duty belongs in Layout (or a dedicated hook). The second is its only real remaining job. Given that Phase 4 will migrate all components to context anyway (making buildUiRuntime's model construction redundant), the lowest-risk Phase 3 decision is to keep buildUiRuntime intact and move it wholesale into Layout — not to gut or refactor it. Gutting it risks breaking DevicePanel's device-resolution path and the existing unit tests for buildUiRuntime, which test the AudioEngine interface contract.

**Primary recommendation:** Create Layout.tsx to hold all current App.tsx internals (graphs, hooks, model assembly, actions), reduce App.tsx to `<DawProvider store={_store}><Layout /></DawProvider>`, delete useTrackSelection.ts, confirm useAudioEngine.ts is already gone, and keep buildUiRuntime.ts as-is with its callsite in Layout.

## Standard Stack

No new libraries. All work is within the existing stack.

### Core (in use, no changes needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | JSX, hooks, context | Already in project; React 19 `<Context value>` syntax is already used in DawProvider |
| TypeScript | 5.x | Type safety | Already in project |
| Tone.js | (existing) | Audio scheduling, synth | Already in project |

### Supporting (existing, consumed by Layout)
| File | Purpose | Status |
|------|---------|--------|
| `src/context/DawProvider.tsx` | React bridge, split contexts | Complete — Phase 2 |
| `src/state/DawStore.ts` | BLoC controller | Complete — Phase 2 |
| `src/state/defaultState.ts` | DEFAULT_PROJECT_DOCUMENT, DEFAULT_UI_STATE | Complete — Phase 2 |
| `src/engine/engineSingleton.ts` | `getAudioEngine()`, `DEFAULT_TRACK_ID` | Complete — Phase 1 |
| `src/ui-plan/buildUiRuntime.ts` | Model assembly from UiPlan + AudioEngine | Keep unchanged |

**Installation:** None required.

## Architecture Patterns

### Recommended File Structure After Phase 3

```
src/
├── App.tsx                    # AFTER: 5-8 lines — DawProvider + Layout only
├── components/
│   └── Layout.tsx             # NEW: everything App.tsx currently does
├── context/
│   ├── DawProvider.tsx        # unchanged
│   ├── useDawDispatch.ts      # unchanged
│   ├── useProjectState.ts     # unchanged
│   └── useUiState.ts          # unchanged
├── hooks/
│   ├── useTrackSelection.ts   # DELETED
│   └── (all other hooks)      # unchanged
├── state/
│   └── (all state files)      # unchanged
└── ui-plan/
    └── buildUiRuntime.ts      # unchanged
```

### Pattern 1: Module-level DawStore singleton

App.tsx needs to instantiate DawStore once. The correct approach is to create it at module level (not in a React component body), parallel to how getAudioEngine() already works.

```typescript
// src/App.tsx — after teardown
import { DawStore } from './state/DawStore'
import { DawProvider } from './context/DawProvider'
import { getAudioEngine } from './engine/engineSingleton'
import { DEFAULT_PROJECT_DOCUMENT, DEFAULT_UI_STATE } from './state/defaultState'
import Layout from './components/Layout'

const _store = new DawStore(getAudioEngine(), {
  project: DEFAULT_PROJECT_DOCUMENT,
  ui: DEFAULT_UI_STATE,
})

export default function App() {
  return (
    <DawProvider store={_store}>
      <Layout />
    </DawProvider>
  )
}
```

**Why module-level:** DawStore holds mutable state (listeners Set, snapshots). Creating it at module level matches the same pattern used for `getAudioEngine()`, `_synthGraph`, `_pannerGraph` already in App.tsx. React StrictMode double-mount would create two DawStore instances if created inside the component.

### Pattern 2: Layout.tsx — receives all displaced internals

Layout.tsx absorbs all module-level graphs, hook calls, model assembly, and action callbacks from App.tsx. It renders the four UI components (Toolbar, TrackZone, DevicePanel, MidiKeyboard).

Layout.tsx does NOT use DawProvider's state hooks yet (that is Phase 4). It is a pure extraction of current App.tsx internals. This keeps Phase 3 a file-structure refactor with no behavior change.

```typescript
// src/components/Layout.tsx — structure only
// Same content as current App function body + module-level graphs
// Imports move from App.tsx to Layout.tsx
// No new logic introduced
```

### Pattern 3: trackSelection replacement

`useTrackSelection` is replaced by `UiState.selectedTrackId` from the reducer (already in DawStore/DawProvider). But Layout.tsx is NOT migrating to context in Phase 3. The correct approach is to keep the local track selection state in Layout.tsx for now, using the same `useTrackSelection` call pattern — but since the hook itself is being deleted (APP-03), it must be inlined as a simple `useState`/`useCallback` pair within Layout.tsx.

```typescript
// Inside Layout.tsx — inline what useTrackSelection did
const [selectedTrack, setSelectedTrack] = useState<string>(INITIAL_TRACK_ID)
const selectTrack = useCallback((id: string) => setSelectedTrack(id), [])
```

This is the correct move for Phase 3. Phase 4 will replace this `useState` with the context-sourced `useUiState().selectedTrackId` and `useDawDispatch().selectTrack()`.

### Pattern 4: buildUiRuntime stays in Layout unchanged

`buildUiRuntime(input)` currently receives `{ uiPlan, midiClipStore, audioEngine, selectedTrackId }` and produces `{ trackZoneModel, devicePanelModel }`. Layout.tsx calls it exactly as App.tsx does now. No changes to buildUiRuntime.ts or its tests.

### Anti-Patterns to Avoid

- **Creating DawStore inside the App function body:** React StrictMode mounts twice; two DawStore instances would exist with separate listener sets and no synchronization.
- **Modifying buildUiRuntime.ts in Phase 3:** Its unit tests (buildUiRuntime.test.ts) cover its AudioEngine resolution contract. Any refactor belongs in Phase 4 (APP-04 scope).
- **Moving track selection to DawStore in Phase 3:** DawStore.selectTrack() dispatches SELECT_TRACK which updates `UiState.selectedTrackId`. Layout is not yet reading from context, so wiring this in Phase 3 requires reading from context — that is Phase 4's job.
- **Deleting DevicePanel/TrackZone prop interfaces:** These components still receive props (model + actions) in Phase 3. Their migration to context is Phase 4.
- **Touching App.test.tsx:** The App unit test imports and mocks many things from the current App.tsx structure. Phase 3 should either delete it (because App.tsx becomes trivial and has nothing to test) or leave it. Given that useAudioEngine.test.tsx was already deleted (not updated), deleting App.test.tsx is the consistent approach.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State subscription | Custom pub-sub | `useSyncExternalStore` (already in DawProvider) | Already solved in Phase 2 |
| Track selection state | Custom observer | `useState` + `useCallback` in Layout (interim) | Simple — Phase 4 migrates to reducer |
| DawStore creation | Factory function | Direct `new DawStore(engine, state)` at module level | DawStore constructor is already the factory |
| ID management | Custom ID gen | `idService` inside DawStore (already wired) | Already implemented |

**Key insight:** Phase 3 introduces zero new patterns. It moves code between files and deletes two files.

## Common Pitfalls

### Pitfall 1: App.test.tsx breaks after App.tsx becomes trivial

**What goes wrong:** App.test.tsx is 336 lines that mock getAudioEngine, createToneSynth, createPanner, useTrackStrip, useMasterStrip, useLimiter, useTransportController, buildUiRuntime, Toolbar, TrackZone, DevicePanel, and MidiKeyboard. After App.tsx becomes 8 lines (`<DawProvider><Layout /></DawProvider>`), none of these mocks are relevant — Layout.tsx has them.

**Why it happens:** The test file is tightly coupled to App.tsx's current structure. Phase 3 moves all the tested behavior into Layout.tsx.

**How to avoid:** Delete App.test.tsx as part of Plan 03-01 (consistent with how useAudioEngine.test.tsx was deleted). Layout.test.tsx is out of scope for Phase 3 (Phase 5's regression pass handles that).

**Warning signs:** TypeScript errors in App.test.tsx after App.tsx is changed — these confirm the test must be deleted.

### Pitfall 2: DawStore created inside App() causes double-mount issues

**What goes wrong:** If `new DawStore(...)` is inside the `App()` function body, React StrictMode calls App() twice. Two DawStore instances exist. The second replaces the first in the closure, leaving the first's listeners orphaned.

**Why it happens:** StrictMode intentional double-invocation of function components.

**How to avoid:** Create `_store` at module level, same as `_synthGraph`, `_pannerGraph`, `_singletonEngine`.

**Warning signs:** DawStore listeners never firing, or firing twice per action.

### Pitfall 3: useTrackSelection.ts deletion breaks TrackZone.test.tsx or other test files

**What goes wrong:** TrackZone.test.tsx imports from buildUiRuntime — check if any test imports from useTrackSelection.

**Why it happens:** useTrackSelection exports TrackSelectionContext and useTrackSelectionContext in addition to the hook — any consumer of those exports breaks on deletion.

**How to avoid:** Grep for all import sites before deleting. Confirmed callers: App.tsx (uses `useTrackSelection`). No other files import it — TrackSelectionContext and useTrackSelectionContext appear to be unused exports.

**Warning signs:** TypeScript compile errors on `import ... from './hooks/useTrackSelection'` after deletion.

### Pitfall 4: buildUiRuntime called in Layout creates re-execution on every render

**What goes wrong:** `buildUiRuntime(input)` is called synchronously in the function body on every render. If Layout re-renders frequently (e.g., during playback via transport hooks), this runs on every frame.

**Why it happens:** buildUiRuntime is not memoized. It is a pure function that re-executes all module resolutions.

**How to avoid:** Phase 3 preserves the current behavior — App.tsx already calls buildUiRuntime on every render without memoization, and E2E tests pass. This is a known performance debt (APP-04 deferred scope). Do not add useMemo in Phase 3 — it would change behavior and add complexity outside the stated scope.

**Warning signs:** None for Phase 3 — this was already true in App.tsx.

### Pitfall 5: INITIAL_TRACK_ID / DEFAULT_UI_PLAN constants

**What goes wrong:** App.tsx uses `resolveInitialTrackId(DEFAULT_UI_PLAN)` and `DEFAULT_UI_PLAN_TRACK_ID` equivalences. Layout.tsx must preserve the same initial track selection.

**Why it happens:** The initial track ID comes from the UiPlan, not from DawStore's DEFAULT_UI_STATE. These are currently in sync (both resolve to `'synth1'`), but they use different mechanisms.

**How to avoid:** Layout.tsx should import and use `resolveInitialTrackId(DEFAULT_UI_PLAN)` as `INITIAL_TRACK_ID` exactly as App.tsx does now. This keeps the interim track selection correct. Phase 4 will replace it with DawStore's `UiState.selectedTrackId`.

**Warning signs:** DevicePanel showing wrong track on initial load, or E2E test `click synth1 track row sets data-selected="true"` failing.

### Pitfall 6: _legacy.getTrackStripGraph still used

**What goes wrong:** App.tsx line 59 calls `_singletonEngine._legacy.getTrackStripGraph(DEFAULT_TRACK_ID)`. This is the bridge for the old Tone.js synth wiring. It must move to Layout.tsx verbatim.

**Why it happens:** The synth/panner graphs created at module level in App.tsx are wired into the singleton's track-1 strip. This wiring must be preserved in Layout.tsx's module-level setup.

**How to avoid:** Move the module-level constants (`_synthGraph`, `_pannerGraph`, wiring calls, `_limiterGraph`, `_masterStripHook`, `legacyEngineAdapter`) from App.tsx to Layout.tsx as module-level code.

**Warning signs:** Audio silence, E2E tests failing on playback.

## Code Examples

### Final App.tsx (target)

```typescript
// Source: direct codebase analysis — what App.tsx must become
import { DawStore } from './state/DawStore'
import { DawProvider } from './context/DawProvider'
import { getAudioEngine } from './engine/engineSingleton'
import { DEFAULT_PROJECT_DOCUMENT, DEFAULT_UI_STATE } from './state/defaultState'
import Layout from './components/Layout'

const _store = new DawStore(getAudioEngine(), {
  project: DEFAULT_PROJECT_DOCUMENT,
  ui: DEFAULT_UI_STATE,
})

export default function App() {
  return (
    <DawProvider store={_store}>
      <Layout />
    </DawProvider>
  )
}
```

### Layout.tsx module-level section (what moves from App.tsx)

```typescript
// Source: src/App.tsx lines 50-114 — moves verbatim to Layout.tsx module scope
import { createToneSynth } from '../hooks/useToneSynth'
import { createPanner } from '../hooks/usePanner'
import { getAudioEngine, DEFAULT_TRACK_ID } from '../engine/engineSingleton'
import type { MasterStripHook } from '../hooks/useMasterStrip'
import type { AudioEngine } from '../engine/audioEngine'
import {
  DEFAULT_PLAN_SYNTH_ID,
  DEFAULT_PLAN_PANNER_ID,
  DEFAULT_PLAN_TRACK_STRIP_ID,
  DEFAULT_PLAN_LIMITER_ID,
  DEFAULT_PLAN_MASTER_STRIP_ID,
} from '../engine/audioGraphPlan'

const _synthGraph = createToneSynth()
const _pannerGraph = createPanner()
_pannerGraph.connectSource(_synthGraph.getOutput())

const _singletonEngine = getAudioEngine()
const _track1Strip = _singletonEngine._legacy.getTrackStripGraph(DEFAULT_TRACK_ID)
_pannerGraph.output.connect(_track1Strip.input)

const _limiterGraph = _singletonEngine._legacy.limiterGraph

const _masterFacade = _singletonEngine.getMasterFacade()
const _masterStripHook: MasterStripHook = {
  get masterVolume() { return _masterFacade.getGain() },
  setMasterVolume(db: number) { _masterFacade.setGain(db) },
  get meterSource() { return _masterFacade.meterSource },
}

const legacyEngineAdapter: AudioEngine = { /* unchanged from App.tsx */ }
```

### Inline track selection (replaces useTrackSelection hook)

```typescript
// Inside Layout function body — inlined because useTrackSelection.ts is deleted
const [selectedTrack, setSelectedTrack] = useState<string>(INITIAL_TRACK_ID)
const selectTrack = useCallback((id: string) => setSelectedTrack(id), [])
// Used identically to the old: trackSelection.selectedTrack, trackSelection.selectTrack
```

### buildUiRuntime call in Layout (unchanged from App.tsx)

```typescript
// Source: src/App.tsx lines 127-132 — moves verbatim to Layout function body
const uiRuntime = buildUiRuntime({
  uiPlan: DEFAULT_UI_PLAN,
  midiClipStore: DEFAULT_MIDI_CLIP_STORE,
  audioEngine: legacyEngineAdapter,
  selectedTrackId: selectedTrack,
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| useAudioEngine.ts (hook) | `getAudioEngine()` singleton | Phase 1 (complete) | Already deleted — no action needed |
| useTrackSelection.ts (hook) | `UiState.selectedTrackId` in reducer | Phase 3 (this phase) | Delete the file; inline useState in Layout |
| State in App.tsx | DawProvider + DawStore | Phase 3 (this phase) | Move to App.tsx module-level + Layout |
| Prop drilling from App | Context consumption | Phase 4 (next phase) | Layout still prop-drills in Phase 3 |

**Deprecated/outdated:**
- `useTrackSelection.ts`: No longer needed — selection lives in reducer. But components still read it via prop in Phase 3; context consumption is Phase 4.
- `App.test.tsx`: Tests App.tsx's current complex wiring — will be entirely wrong after teardown. Delete alongside the refactor.
- `useAudioEngine.ts`: Already confirmed deleted. `src/hooks/useTrackSelection.test.ts` exists and tests the hook — delete it when the hook is deleted.

## Open Questions

1. **buildUiRuntime long-term fate (APP-04)**
   - What we know: APP-04 says "eliminated or reduced to selected-track device resolution only"
   - What's unclear: The roadmap says Phase 3 task 03-02 is "Reduce buildUiRuntime to selected-track device resolution only (or delete if possible), update all callsites"
   - Recommendation: Keep buildUiRuntime.ts completely unchanged in Phase 3 to de-risk. The 03-02 plan can execute the reduction, but the safer path is "move to Layout unchanged" and reduce in Phase 4 when components migrate to context. Planner should decide whether 03-02 reduces or defers.

2. **useTrackSelection.test.ts deletion**
   - What we know: `src/hooks/useTrackSelection.test.ts` exists and tests the hook
   - What's unclear: Whether to delete it with the hook or leave it
   - Recommendation: Delete it — the hook being deleted makes its test meaningless. Consistent with how useAudioEngine.test.tsx was deleted.

3. **App.test.tsx fate**
   - What we know: It is 336 lines that test App.tsx's current behavior, which will not exist after teardown
   - What's unclear: Whether to delete or rewrite for Layout
   - Recommendation: Delete. Writing Layout.test.tsx is Phase 5 regression work.

4. **window.__panicCount and window.__activeSteps globals**
   - What we know: App.tsx has two `useEffect` calls that write to window globals for E2E test observation
   - What's unclear: Whether Layout.tsx must preserve these
   - Recommendation: YES — the Playwright tests may depend on these. Move both `useEffect` hooks verbatim into Layout.tsx. The E2E success criterion (all Playwright tests pass) requires this.
   - Evidence: `sequencer.spec.ts` and `integration.spec.ts` likely access `window.__activeSteps` and `window.__panicCount`. These are set in App.tsx's `useEffect` on `transport.currentStep`.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `src/App.tsx` — all 245 lines read
- Direct codebase inspection of `src/context/DawProvider.tsx` — DawProvider interface and props confirmed
- Direct codebase inspection of `src/state/DawStore.ts` — constructor signature confirmed
- Direct codebase inspection of `src/state/defaultState.ts` — DEFAULT_PROJECT_DOCUMENT, DEFAULT_UI_STATE confirmed
- Direct codebase inspection of `src/hooks/useTrackSelection.ts` — hook implementation confirmed
- Direct codebase inspection of `src/ui-plan/buildUiRuntime.ts` — full interface confirmed
- Direct codebase inspection of `src/App.test.tsx` — test structure confirmed
- Direct codebase inspection of `e2e/*.spec.ts` — E2E test suite surveyed
- Direct codebase inspection of `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`

### Tertiary (LOW confidence — not verified, but low-stakes)
- `window.__panicCount` / `window.__activeSteps` usage in E2E specs: searched file names but did not read sequencer.spec.ts / integration.spec.ts in full. Assume they use these globals based on the fact that App.tsx sets them for E2E purposes.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external libraries; all work in existing files
- Architecture patterns: HIGH — derived directly from reading App.tsx, DawProvider, DawStore
- Pitfalls: HIGH — all identified from direct code inspection, not speculation
- buildUiRuntime fate: MEDIUM — the open question is a planning decision, not a technical unknown

**Research date:** 2026-03-13
**Valid until:** This research is codebase-specific and valid until the files it references change. No expiry on external library versions.
