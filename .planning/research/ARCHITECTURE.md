# Architecture Research

**Domain:** React DAW state architecture + dynamic audio graph
**Researched:** 2026-03-12
**Confidence:** HIGH — based on direct codebase inspection and official React/Web Audio API documentation

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MODULE BOUNDARY: Outside React tree (singleton, lives at module scope)     │
│                                                                             │
│  audioEngineSingleton: AudioEngine                                          │
│    ├── createTrackSubgraph(trackId) → { synth, panner, trackStrip }        │
│    ├── removeTrackSubgraph(trackId) → void (disconnects, disposes)          │
│    ├── getTrackFacade(trackId) → TrackFacade                                │
│    ├── getLimiter(id) → LimiterHook                                         │
│    └── getMasterStrip(id) → MasterStripHook                                 │
│                                                                             │
│  Signal chain per track:                                                    │
│    synth → panner → trackStrip → (insert to pre-limiter bus) → limiter     │
│                                           ↑                                 │
│    masterStrip ← limiter ←───────────────┘                                 │
│    destination ← masterStrip                                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  MODULE BOUNDARY: React Context tree                                        │
│                                                                             │
│  <DawProvider>   ← wraps entire app; owns useReducer, wires engine facade  │
│    │                                                                        │
│    ├── DawStateContext     { tracks, selectedTrackId, transport,            │
│    │                         recArmByTrackId, uiPlan }                     │
│    │                                                                        │
│    └── DawDispatchContext  dispatch(action) → state update                  │
│                            side-effects in provider (engine calls)          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  UI COMPONENTS (read context, dispatch actions, no direct engine access)    │
│                                                                             │
│  Toolbar ──────────── reads transport state, dispatches TRANSPORT_*        │
│  TrackZone ─────────── reads tracks[], dispatches TRACK_* / SELECT_TRACK   │
│  DevicePanel ──────── reads selected track devices (derived from state)    │
│  MidiKeyboard ──────── reads recArm for selected track, calls engine.noteOn │
│  VUMeter ───────────── reads MeterSource from engine (NOT from context)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component / Module | Responsibility | Implementation |
|---|---|---|
| `audioEngineSingleton` | Owns the full audio graph; track subgraph lifecycle; never re-created on React remount | Module-level `let` variable, initialized on first access via `getAudioEngine()` |
| `DawProvider` | Owns `useReducer`; subscribes to engine for side effects; bridges actions to engine calls | React component, wraps app root |
| `DawStateContext` | Read-only snapshot of all UI-visible state | `React.createContext` of reducer state |
| `DawDispatchContext` | Dispatch function only; stable reference across renders | Separate `React.createContext` — prevents re-renders in dispatch-only consumers |
| `useDawState()` | Custom hook: `useContext(DawStateContext)` | Thin wrapper, improves readability |
| `useDawDispatch()` | Custom hook: `useContext(DawDispatchContext)` | Thin wrapper |
| `dawReducer` | Pure function; all UI state transitions; no side effects | Plain TypeScript, fully testable without React |
| `buildTrackViewModel(state, engineFacades)` | Derives `TrackZoneModel` from reducer state + engine-sourced values | Pure function called in render path, replaces `buildUiRuntime` |
| `Toolbar` | Transport controls; reads `transport` from state | Dispatches `TRANSPORT_PLAY`, `TRANSPORT_STOP`, etc. |
| `TrackZone` | Track list, playhead, faders, mute/rec; reads `tracks` from state | Dispatches `TRACK_SET_MUTE`, `TRACK_SET_VOLUME`, `SELECT_TRACK` |
| `DevicePanel` | Device rack for selected track; reads derived device models | Dispatches `DEVICE_*` actions |
| `MidiKeyboard` | Note input; reads rec-arm for selected track | Calls `engine.noteOn/noteOff` directly (real-time path, not via reducer) |
| `VUMeter` | Meter bars; subscribes to `MeterSource` | No reducer involvement; purely reactive to `MeterSource.subscribe` |

---

## Recommended Project Structure

```
src/
├── engine/
│   ├── audioEngine.ts          ← MODIFIED: adds createTrackSubgraph, removeTrackSubgraph
│   ├── audioGraphPlan.ts       ← unchanged (plan types, DEFAULT plan)
│   ├── audioEngineSingleton.ts ← NEW: module-level singleton accessor
│   ├── meterSource.ts          ← unchanged
│   ├── transportService.ts     ← unchanged
│   └── types.ts                ← unchanged
│
├── state/                      ← NEW directory
│   ├── dawReducer.ts           ← NEW: reducer + action types + initial state
│   ├── dawContext.tsx          ← NEW: DawStateContext, DawDispatchContext, DawProvider
│   ├── useDawState.ts          ← NEW: useContext(DawStateContext)
│   ├── useDawDispatch.ts       ← NEW: useContext(DawDispatchContext)
│   └── dawReducer.test.ts      ← NEW: pure reducer tests (no React needed)
│
├── hooks/
│   ├── useAudioEngine.ts       ← DELETED (engine is no longer React-managed)
│   ├── useToneSynth.ts         ← keep create* factory; remove use* hook if not needed
│   ├── usePanner.ts            ← keep create* factory; remove use* hook
│   ├── useTrackStrip.ts        ← keep create* factory; remove use* hook
│   ├── useMasterStrip.ts       ← keep create* factory; keep use* only if still consumed
│   ├── useLimiter.ts           ← keep create* factory; keep use* if still consumed
│   ├── useTransportController.ts ← MODIFIED: reads from context, not standalone useState
│   ├── useSequencer.ts         ← unchanged
│   └── useTrackSelection.ts    ← DELETED (selection moves to reducer state)
│
├── ui-plan/
│   ├── uiPlan.ts               ← unchanged (plan types)
│   ├── defaultUiPlan.ts        ← unchanged
│   ├── buildUiRuntime.ts       ← MODIFIED or REPLACED by buildTrackViewModel in state/
│   └── deviceRegistry.ts      ← keep, but switch render to discriminated union
│
├── components/
│   ├── App.tsx                 ← GUTTED: only renders <DawProvider><Layout /></DawProvider>
│   ├── Toolbar.tsx             ← reads context; dispatches transport actions
│   ├── TrackZone.tsx           ← reads context; dispatches track actions
│   ├── DevicePanel.tsx         ← reads context; renders device rack
│   ├── MidiKeyboard.tsx        ← reads recArm from context; calls engine directly
│   ├── VUMeter.tsx             ← unchanged (already consumes MeterSource cleanly)
│   └── [device components]    ← unchanged
│
└── project-runtime/
    └── midiClipStore.ts        ← unchanged
```

---

## Architectural Patterns

### Pattern 1: Split State/Dispatch Contexts

**What:** Two separate React contexts — one for state snapshot, one for dispatch. Dispatch context is stable (never changes between renders). State context changes when state changes.

**Why:** Components that only dispatch (e.g., a button) do not re-render when state updates. Matches the recommendation in official React documentation for `useReducer` + context.

**Example:**
```typescript
// state/dawContext.tsx
export const DawStateContext = createContext<DawState | null>(null)
export const DawDispatchContext = createContext<React.Dispatch<DawAction> | null>(null)

export function DawProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(dawReducer, initialDawState)

  // Bridge: when dispatch causes state change, sync with engine
  // This is the ONLY place engine ↔ React sync happens
  useEffect(() => {
    // example: apply mute changes that arrived via reducer
    for (const track of state.tracks) {
      audioEngineSingleton.getTrackFacade(track.trackId)?.setTrackMuted(track.isMuted)
    }
  }, [state.tracks])

  return (
    <DawStateContext value={state}>
      <DawDispatchContext value={dispatch}>
        {children}
      </DawDispatchContext>
    </DawStateContext>
  )
}
```

**Constraint:** Actions that mutate engine state in real-time (note on/off, volume fader) must call engine facades directly (not through a useEffect sync loop) to avoid audio latency. The reducer handles only the React state update; the engine call is a side-effect fired from the dispatch handler or an action middleware layer inside DawProvider.

### Pattern 2: Module-Level Engine Singleton

**What:** The `AudioEngine` instance lives outside the React component tree, in module scope. React never owns it. A `getAudioEngine()` accessor initializes on first call.

**Why:** React StrictMode mounts and unmounts components twice in development. `useAudioEngine` (current impl) disposes the engine on first unmount, which means the second mount starts with no engine — causing a race condition detectable in tests. A module-level singleton is untouched by React mount/unmount cycles.

**How StrictMode double-mount is handled:**
- The current `useAudioEngine` hook creates and disposes on each mount/unmount cycle. This is the source of the strict mode issue in tests.
- Moving to module-level: the engine is initialized once, and `dispose()` is called only on `window.beforeunload` or a deliberate test teardown.
- In tests: each test suite explicitly creates a fresh engine (or uses a mock) by calling a `resetEngineForTest()` function that clears the module-level variable.

**Example:**
```typescript
// engine/audioEngineSingleton.ts
let _engine: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!_engine) {
    _engine = createAudioEngine(DEFAULT_AUDIO_GRAPH_PLAN, DEFAULT_AUDIO_MODULE_FACTORY_MAP)
  }
  return _engine
}

// For test teardown only:
export function resetEngineForTest(): void {
  _engine?.dispose()
  _engine = null
}
```

### Pattern 3: Per-Track Subgraph with Pre-Limiter Bus

**What:** Each track gets its own subgraph: `synth → panner → trackStrip`. The `trackStrip` output connects to a shared `preLimiterBus` (a GainNode). The bus feeds `limiter → masterStrip → destination`.

**Why:** The current engine creates one instance per AudioModuleKind (one synth, one panner, etc.) via `runtimeByKind` using a `Map<AudioModuleKind, unknown>`. This map key collision is the fundamental blocker to multi-track. The fix is a factory that produces a named track subgraph keyed by `trackId`, and a shared bus node for the sum point.

**Signal chain for N tracks:**
```
track1: synth1 → panner1 → trackStrip1 ──┐
track2: synth2 → panner2 → trackStrip2 ──┤──► preLimiterBus → limiter → masterStrip → destination
trackN: synthN → pannerN → trackStripN ──┘
```

**How to add a track:**
1. Call `audioEngine.createTrackSubgraph(trackId, plan)` — this builds synth+panner+trackStrip for the new track and connects trackStrip output to preLimiterBus
2. Dispatch `ADD_TRACK` action to reducer with the trackId + UiTrackPlan data
3. Reducer adds the track to `state.tracks`; UI re-renders with new row

**How to remove a track:**
1. Dispatch `REMOVE_TRACK`; reducer removes from `state.tracks`
2. DawProvider `useEffect` detects the removed trackId, calls `audioEngine.removeTrackSubgraph(trackId)` — disconnects trackStrip from bus, disposes all nodes

**Constraint:** The `preLimiterBus` GainNode must be created during engine initialization, not per-track. It replaces the current direct `trackStrip → limiter` edge in the graph plan.

### Pattern 4: Engine Facade Per Track

**What:** `audioEngine.getTrackFacade(trackId)` returns `{ synth: ToneSynthHook, panner: PannerHook, trackStrip: TrackStripHook }` for a specific track. The `TrackFacade` type groups the three intent-level facades by track.

**Why:** The current `APP_SYNTH_MODULE_ID`, `APP_PANNER_MODULE_ID`, `APP_TRACK_STRIP_ID` constants in `App.tsx` are the direct pain point. They are hard-coded module IDs resolved at boot from the default plan's first track. `getTrackFacade(trackId)` replaces all three with a single call keyed by the UI's stable `trackId`.

**Example:**
```typescript
// engine/audioEngine.ts
export interface TrackFacade {
  synth: ToneSynthHook
  panner: PannerHook
  trackStrip: TrackStripHook
}

// AudioEngine interface gains:
createTrackSubgraph(trackId: string): TrackFacade
removeTrackSubgraph(trackId: string): void
getTrackFacade(trackId: string): TrackFacade | undefined
```

---

## Data Flow

### Current Flow

```
App.tsx (render path)
  │
  ├── useAudioEngine()         → creates AudioEngine in useEffect (React-owned)
  ├── useToneSynth(engine.getSynth(APP_SYNTH_MODULE_ID))  ← hardcoded ID
  ├── usePanner(engine.getPanner(APP_PANNER_MODULE_ID))   ← hardcoded ID
  ├── useTrackStrip(...)       ← hardcoded ID
  ├── useMasterStrip(...)      ← hardcoded ID
  ├── useLimiter(...)          ← hardcoded ID
  ├── useTransportController(toneSynth, trackStrip, ...)
  ├── useTrackSelection(INITIAL_TRACK_ID)
  │
  ├── buildUiRuntime({uiPlan, midiClipStore, audioEngine, selectedTrackId})
  │     → calls audioEngine.getSynth/getPanner/getTrackStrip per device  ← every render
  │
  ├── Constructs trackZoneModel by:
  │     → iterating uiRuntime.trackZoneModel.tracks
  │     → checking if trackStripId === APP_TRACK_STRIP_ID to switch source  ← special-case
  │
  └── Constructs devicePanelModel by:
        → .find()ing devices by moduleId to override module value  ← .find() per render

Action dispatch path (e.g., setTrackMute):
  → TrackZone calls actions.setTrackMute(trackId, muted)
  → App.tsx handler: find track in uiRuntime, check if it matches APP_TRACK_STRIP_ID,
    call transport.setTrackMute OR runtimeTrack.trackStrip.setTrackMuted
    (two different code paths for "primary" vs "other" tracks)
```

**Problems visible in current flow:**
- `buildUiRuntime` runs on every render (no memoization, allocates new objects)
- `APP_*` constants couple the action dispatch to the boot-time track
- `.find()` inside action handlers is O(n) per dispatch
- Two code paths for "primary track" vs "other tracks" in mute/volume handlers
- Engine lifecycle tied to React mount/unmount (`useAudioEngine` + `useEffect`)
- `trackRecByTrackId` is loose `useState` in App — not co-located with track state

### Target Flow

```
Module initialization (once, outside React)
  audioEngineSingleton.ts
    └── getAudioEngine() → AudioEngine (initialized on first call)
          ├── preLimiterBus: GainNode (shared sum point)
          ├── limiter → masterStrip → destination (static)
          └── per-track subgraphs (dynamic)

React tree initialization
  <DawProvider>
    useReducer(dawReducer, initialDawState)
    ├── state.tracks: TrackRecord[]        ← one entry per track
    ├── state.selectedTrackId: string
    ├── state.transport: TransportState
    └── state.recArmByTrackId: Record<string, boolean>

Component render path
  TrackZone
    → useDawState() → state.tracks (pure data, no engine objects)
    → for each track: volumeDb, isMuted, isRecEnabled come from state
    → meterSource: reads getAudioEngine().getTrackFacade(trackId).trackStrip.meterSource
       (MeterSource is stable reference; reading it in render is safe)

Action dispatch path (e.g., setTrackMute)
  → TrackZone dispatches TRACK_SET_MUTE { trackId, muted }
  → DawProvider's bridge (not reducer): calls engine.getTrackFacade(trackId).trackStrip.setTrackMuted(muted)
  → reducer updates state.tracks[trackId].isMuted = muted
  → TrackZone re-renders with new isMuted value

Volume fader (real-time, latency-sensitive)
  → TrackZone dispatches TRACK_SET_VOLUME { trackId, db }
  → DawProvider's bridge: calls engine.getTrackFacade(trackId).trackStrip.setTrackVolume(db)
  → reducer updates state.tracks[trackId].volumeDb = db
```

### Key Data Flows

**1. Track mute action (non-latency-sensitive):**
```
User clicks M → dispatch(TRACK_SET_MUTE) → DawProvider bridge calls engine.setTrackMuted()
                                          → reducer: tracks[id].isMuted = true
                                          → React re-render: M button shows active
```

**2. Volume fader (latency-sensitive, but still needs React state for display):**
```
User drags fader → dispatch(TRACK_SET_VOLUME) → DawProvider bridge calls engine.setTrackVolume()
                                               → reducer: tracks[id].volumeDb = db
                                               → React re-render: fader position + dB label update
```

**3. Add track:**
```
dispatch(ADD_TRACK, { trackId, plan })
  → DawProvider bridge: engine.createTrackSubgraph(trackId) → subgraph created, connected to bus
  → reducer: tracks.push(newTrackRecord)
  → React re-render: new track row appears in TrackZone
```

**4. Note on (real-time, must NOT go through reducer):**
```
MidiKeyboard onKeyDown → engine.getTrackFacade(selectedTrackId).synth.noteOn(midi, velocity, time)
  (no dispatch, no reducer, no React state involved)
```

**5. Transport play:**
```
dispatch(TRANSPORT_PLAY)
  → DawProvider bridge: Tone.start(), transportController.play()
  → reducer: transport.playbackState = 'playing'
  → Toolbar re-renders with playing state; TrackZone playhead starts animating
```

---

## Anti-Patterns

### Anti-Pattern 1: Engine Objects in Reducer State

**What:** Storing `ToneSynthHook`, `TrackStripHook`, `MeterSource`, or any live audio object directly in reducer state.

**Why bad:** Reducer state must be serializable (for devtools, time-travel debugging, future persistence). Audio objects are not serializable. Storing them in state also means every reducer action shallow-copies them, causing spurious re-renders in consumers.

**Instead:** Keep engine objects outside reducer. Derive them from `getAudioEngine().getTrackFacade(trackId)` in component render (for stable references like `MeterSource`) or in the DawProvider bridge (for action side-effects).

### Anti-Pattern 2: Engine Calls Inside the Reducer

**What:** Calling `engine.setTrackMuted()` from inside `dawReducer`.

**Why bad:** Reducers must be pure functions. Side effects in reducers break time-travel debugging, testing, and double-invocation in StrictMode.

**Instead:** Put engine calls in the DawProvider bridge — a `useEffect` or a dispatch middleware wrapper. The reducer handles only the UI-visible state transition.

### Anti-Pattern 3: Re-Creating Engine on React Remount

**What:** Keeping `useAudioEngine` (the current `useEffect`-based hook) as the engine lifecycle owner.

**Why bad:** React StrictMode double-mounts components in development. The current `useAudioEngine` disposes the engine on first unmount, then tries to re-create it on second mount. This causes double-initialization, extra audio nodes, and test flakiness. Existing `useAudioEngine.test.tsx` already had to account for this behavior.

**Instead:** Module-level singleton via `getAudioEngine()`. The engine outlives any React component.

### Anti-Pattern 4: Per-Render Runtime Resolution

**What:** Calling `buildUiRuntime(...)` on every render (current `App.tsx` behavior). This allocates new objects every render (new arrays, new device model objects), causing child component re-renders even when the underlying data did not change.

**Instead:** The reducer state IS the runtime model for pure UI state (track name, mute, volume, rec-arm, selection). Engine-sourced values (meterSource stable references) are read in component render directly. No intermediate runtime builder needed.

### Anti-Pattern 5: Hardcoded Module IDs in App Scope

**What:** `APP_SYNTH_MODULE_ID`, `APP_PANNER_MODULE_ID`, etc. as module-scope constants.

**Why bad:** These constants are derived from `DEFAULT_UI_PLAN`'s first track, coupling the entire action-dispatch system to the boot-time track layout. Adding a second track (with different module IDs) requires modifying the switch/find logic in every action handler.

**Instead:** `getTrackFacade(trackId)` keyed by the track's stable UI `trackId`. The mapping from `trackId` to audio module IDs is the engine's internal concern.

### Anti-Pattern 6: Dual Code Paths for "Primary" vs "Other" Tracks

**What:** The current mute/volume handlers check `runtimeTrack.trackStripId === APP_TRACK_STRIP_ID` and use `transport.setTrackMute` for the primary track vs `runtimeTrack.trackStrip.setTrackMuted` for others.

**Why bad:** This exists because the transport controller owns mute state for track1. It will not scale to N tracks, and it conflates transport state with track-strip state.

**Instead:** Transport owns playback state only (playing/paused/stopped, bpm, loop, currentStep). Track mute is always via `engine.getTrackFacade(trackId).trackStrip.setTrackMuted(muted)`. Transport controller does not receive a `TrackStripHook` dependency.

---

## Integration Points

### Internal Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Boundary 1: Engine ↔ DawProvider                                           │
│                                                                             │
│  DawProvider reads from engine:                                             │
│    - getAudioEngine().getTrackFacade(id)    → to call setTrackMuted etc.   │
│    - getAudioEngine().getLimiter(id)        → to call setThreshold etc.    │
│    - getAudioEngine().getMasterStrip(id)    → to call setMasterVolume      │
│                                                                             │
│  DawProvider writes to engine:                                              │
│    - createTrackSubgraph(trackId)           → when ADD_TRACK dispatched    │
│    - removeTrackSubgraph(trackId)           → when REMOVE_TRACK dispatched │
│    - facade.trackStrip.setTrackMuted(...)   → when TRACK_SET_MUTE          │
│    - facade.trackStrip.setTrackVolume(...)  → when TRACK_SET_VOLUME        │
│    - facade.synth.setEnabled(...)           → when DEVICE_SET_ENABLED      │
│                                                                             │
│  Engine never calls into React (no callbacks, no state setters)            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Boundary 2: DawProvider ↔ Components (via context)                         │
│                                                                             │
│  Components read:                                                           │
│    useDawState()     → { tracks, selectedTrackId, transport, recArm }      │
│                                                                             │
│  Components write:                                                          │
│    useDawDispatch()  → dispatch(action)                                    │
│                                                                             │
│  Components with real-time engine access (bypassing reducer):               │
│    MidiKeyboard      → engine.getTrackFacade(selectedTrackId).synth.noteOn │
│    VUMeter           → engine.getTrackFacade(id).trackStrip.meterSource    │
│                         (subscribes to MeterSource, not through context)   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Boundary 3: Transport ↔ Sequencer ↔ Engine                                 │
│                                                                             │
│  Transport actions remain as dispatch calls → DawProvider bridge           │
│    TRANSPORT_PLAY   → Tone.start(), transportController.play()             │
│    TRANSPORT_STOP   → transportController.stop()                           │
│    TRANSPORT_SET_BPM → transportController.setBpm(bpm)                     │
│                                                                             │
│  Sequencer still uses createTransportCore + createSequencer (unchanged)    │
│  The sequencer's noteOn/noteOff calls go to engine via synth facade        │
│  (transport controller receives synth facade, not track strip)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### New Components / Modules Required

| Module | Type | Description |
|---|---|---|
| `src/state/dawReducer.ts` | NEW | Pure reducer, `DawState` type, all `DawAction` union, `initialDawState` |
| `src/state/dawContext.tsx` | NEW | `DawStateContext`, `DawDispatchContext`, `DawProvider` component |
| `src/state/useDawState.ts` | NEW | Custom hook: `useContext(DawStateContext)` |
| `src/state/useDawDispatch.ts` | NEW | Custom hook: `useContext(DawDispatchContext)` |
| `src/engine/audioEngineSingleton.ts` | NEW | `getAudioEngine()`, `resetEngineForTest()` |
| `src/engine/audioEngine.ts` | MODIFIED | Add `createTrackSubgraph`, `removeTrackSubgraph`, `getTrackFacade`, `TrackFacade` type; add `preLimiterBus` sum node |

### Modified Components

| Component | Change |
|---|---|
| `src/App.tsx` | Gutted to `<DawProvider><Layout /></DawProvider>`; remove all `use*` hook calls, constants, model construction |
| `src/hooks/useAudioEngine.ts` | Deleted; engine moves to singleton |
| `src/hooks/useTrackSelection.ts` | Deleted; selection moves to reducer `state.selectedTrackId` |
| `src/hooks/useTransportController.ts` | Remove `TrackStripHook` dependency; transport owns playback state only |
| `src/components/TrackZone.tsx` | Reads from context instead of props model; dispatches actions |
| `src/components/DevicePanel.tsx` | Reads from context; switch to discriminated union render |
| `src/components/Toolbar.tsx` | Reads transport state from context; dispatches transport actions |
| `src/components/MidiKeyboard.tsx` | Reads `recArm` from context; calls engine directly for noteOn/noteOff |
| `src/ui-plan/buildUiRuntime.ts` | Either deleted or reduced to device model resolution for selected track only |

### Suggested Build Order

This order respects existing dependencies and de-risks each step with the existing test suite.

**Phase 1: Engine multi-track foundation**
1. Add `preLimiterBus` GainNode to `createAudioEngine` (replaces direct trackStrip→limiter edge)
2. Add `createTrackSubgraph(trackId)`, `removeTrackSubgraph(trackId)`, `getTrackFacade(trackId)`, `TrackFacade` to `AudioEngine` interface and implementation
3. Add `audioEngineSingleton.ts` with `getAudioEngine()` and `resetEngineForTest()`
4. Unit test: `createTrackSubgraph` → `trackStrip.output` connected to `preLimiterBus`; `removeTrackSubgraph` → disconnected and disposed

*Rationale: All other phases depend on the engine being able to handle N tracks. This is the riskiest structural change and should be isolated first.*

**Phase 2: Reducer + context (pure UI state)**
1. Define `DawState`, `DawAction` union in `src/state/dawReducer.ts`
2. Implement `dawReducer` pure function (TRACK_SET_MUTE, TRACK_SET_VOLUME, SELECT_TRACK, SET_REC_ARM, TRANSPORT_*, ADD_TRACK, REMOVE_TRACK)
3. Create `DawProvider` in `src/state/dawContext.tsx` (wires useReducer, provides contexts, DawProvider bridge with engine side-effects)
4. Add `useDawState`, `useDawDispatch` custom hooks
5. Unit test: `dawReducer` for all actions in isolation (no React, no engine)

*Rationale: The reducer can be written and fully tested before any component is touched. Produces high-confidence pure test coverage.*

**Phase 3: App.tsx teardown**
1. Replace `App.tsx` body with `<DawProvider><Layout /></DawProvider>`
2. Move all model construction and hook calls out of App
3. Delete `useAudioEngine.ts`
4. Delete `useTrackSelection.ts` (selection now lives in reducer)

*Rationale: App.tsx is the most tangled file. Doing this after the reducer is stable means the replacement is drop-in. The existing E2E tests act as the regression gate.*

**Phase 4: Component context migration**
1. Migrate `Toolbar` to `useDawState` + `useDawDispatch`
2. Migrate `TrackZone` to context (remove `model`/`actions` props); reads `state.tracks`; dispatches TRACK_* actions
3. Migrate `DevicePanel` to context; switch deviceRegistry render to discriminated union
4. Migrate `MidiKeyboard` to read rec-arm from context; call engine directly for note events
5. VUMeter: no change needed (already consumes MeterSource cleanly)

*Rationale: Each component can be migrated independently. If a component is migrated and tests still pass, the bridge is working.*

**Phase 5: Transport decoupling**
1. Remove `TrackStripHook` dependency from `useTransportController`
2. Transport controller receives synth facade only; track mute goes through engine facade
3. Fix `useTransportController` to handle `sequencerClip` changes (existing R4 issue from agent findings)

*Rationale: Transport is currently the most coupled subsystem. Tackling it last means other refactors don't accidentally destabilize it.*

---

## Sources

- React official docs: [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context) — split state/dispatch context pattern, provider consolidation
- React official docs: [StrictMode](https://react.dev/reference/react/StrictMode) — double mount/unmount behavior in development
- Web Audio API: [MDN Using the Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API) — dynamic graph connection/disconnection, GainNode as unity-gain summing junction
- Web Audio API: [GainNode MDN](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) — multiple inputs sum at a GainNode
- Codebase: `src/engine/audioEngine.ts`, `src/App.tsx`, `src/hooks/useAudioEngine.ts`, `src/hooks/useTransportController.ts`, `src/hooks/useTrackStrip.ts` — all analyzed directly
- Codebase: `docs/plans/agent_findings_fix_plan_2026-03-12.md` — existing known pain points (R1–R5, A1–A5)
