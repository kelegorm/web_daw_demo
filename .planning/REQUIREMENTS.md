# Requirements: Kelegorm DAW

**Defined:** 2026-03-12
**Core Value:** Audio and visual state stay synchronized through a clean reducer boundary — the engine is never directly touched by UI components.

## v1 Requirements

Requirements for milestone v1.0: State Architecture & Dynamic Tracks.

### Engine Architecture

- [ ] **ENG-01**: Audio engine lives as a module-level singleton, not managed by React lifecycle
- [ ] **ENG-02**: Engine survives React StrictMode double-mount without creating duplicate AudioContexts
- [ ] **ENG-03**: Engine exposes `createTrackSubgraph(trackId)` that creates a track strip (gain + mute + meter) wired to a shared pre-limiter bus
- [ ] **ENG-04**: Engine exposes `removeTrackSubgraph(trackId)` that disposes audio nodes and disconnects from bus
- [ ] **ENG-05**: Engine exposes `getTrackFacade(trackId)` replacing hardcoded APP_* constant lookups
- [ ] **ENG-06**: Shared `preLimiterBus` GainNode sums all track outputs before limiter → master → destination
- [ ] **ENG-07**: All APP_SYNTH_MODULE_ID, APP_PANNER_MODULE_ID, APP_TRACK_STRIP_ID, APP_LIMITER_MODULE_ID, APP_MASTER_STRIP_ID constants deleted

### State Management

- [ ] **STATE-01**: App state managed by `useReducer` with discriminated union actions
- [ ] **STATE-02**: State shape uses normalized track map (`byId` + `ids` array), not flat array
- [ ] **STATE-03**: Split Context pattern — separate StateContext and DispatchContext
- [ ] **STATE-04**: `DawProvider` wraps app and bridges reducer ↔ engine
- [ ] **STATE-05**: Track selection, rec-arm, and track list live in reducer state
- [ ] **STATE-06**: Transport playback values (isPlaying, currentStep, bpm) stay outside Context (read from hooks, not context)
- [ ] **STATE-07**: Audio values (volume, mute, meter levels) never stored in reducer — read from engine facades
- [ ] **STATE-08**: No new runtime libraries added — only React built-ins (useReducer, createContext)

### Track CRUD

- [ ] **CRUD-01**: User can add a new empty track via UI button
- [ ] **CRUD-02**: Added track gets a track strip wired to engine immediately (gain, mute, meters work)
- [ ] **CRUD-03**: Added track is auto-selected after creation
- [ ] **CRUD-04**: User can remove any regular track via UI button
- [ ] **CRUD-05**: Removed track's audio nodes are disposed before state settles
- [ ] **CRUD-06**: If selected track is removed, selection moves to adjacent track
- [ ] **CRUD-07**: Minimum 1 regular track enforced — remove button disabled or hidden when only 1 track remains

### App Cleanup

- [ ] **APP-01**: App.tsx gutted to `<DawProvider><Layout /></DawProvider>` (no state, no module lookups)
- [ ] **APP-02**: `useAudioEngine` hook deleted (replaced by engine singleton)
- [ ] **APP-03**: `useTrackSelection` hook deleted (replaced by reducer state)
- [ ] **APP-04**: `buildUiRuntime` either eliminated or reduced to selected-track device resolution only

### Component Migration

- [ ] **COMP-01**: Toolbar reads transport state from hooks, dispatches via context
- [ ] **COMP-02**: TrackZone reads track list from context, dispatches selection/mute/volume via context
- [ ] **COMP-03**: DevicePanel reads selected track devices from context or engine facade
- [ ] **COMP-04**: MidiKeyboard enablement follows selected track rec-arm state from context
- [ ] **COMP-05**: No prop drilling from App.tsx to any component
- [ ] **COMP-06**: All new files under 500 lines, no `any` or `unknown` types

### Backwards Compatibility

- [ ] **COMPAT-01**: All existing Vitest unit tests pass without modification (or with minimal adapter changes)
- [ ] **COMPAT-02**: All existing Playwright E2E tests pass
- [ ] **COMPAT-03**: Interface visually and functionally identical to current state (minus add/remove buttons)

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Device Management

- **DEV-01**: User can add devices (synth, panner, effects) to a track
- **DEV-02**: User can remove devices from a track
- **DEV-03**: User can reorder devices in a track's chain

### Multi-Track Sequencing

- **SEQ-01**: Each track can have its own MIDI clip and sequencer
- **SEQ-02**: Per-track play/record arm controls
- **SEQ-03**: Transport coordinates all track sequencers

### Persistence

- **PERSIST-01**: Project state saved to localStorage or file
- **PERSIST-02**: Project state restored on app load

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Undo/redo | No undo infrastructure exists; requires command pattern — separate milestone |
| Track rename | Nice-to-have but not needed for AC; auto-generated names suffice |
| Track reorder (drag) | UI complexity beyond milestone scope |
| New runtime libraries (Zustand, Redux, Jotai) | User constraint: React built-ins only |
| Transport state in Context | Causes re-render storm at playback rate; stays in transport hooks |
| Audio values in reducer | Drift risk between reducer and engine; read from facades |
| Device CRUD on tracks | Tracks start empty; device management is v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | — | Pending |
| ENG-02 | — | Pending |
| ENG-03 | — | Pending |
| ENG-04 | — | Pending |
| ENG-05 | — | Pending |
| ENG-06 | — | Pending |
| ENG-07 | — | Pending |
| STATE-01 | — | Pending |
| STATE-02 | — | Pending |
| STATE-03 | — | Pending |
| STATE-04 | — | Pending |
| STATE-05 | — | Pending |
| STATE-06 | — | Pending |
| STATE-07 | — | Pending |
| STATE-08 | — | Pending |
| CRUD-01 | — | Pending |
| CRUD-02 | — | Pending |
| CRUD-03 | — | Pending |
| CRUD-04 | — | Pending |
| CRUD-05 | — | Pending |
| CRUD-06 | — | Pending |
| CRUD-07 | — | Pending |
| APP-01 | — | Pending |
| APP-02 | — | Pending |
| APP-03 | — | Pending |
| APP-04 | — | Pending |
| COMP-01 | — | Pending |
| COMP-02 | — | Pending |
| COMP-03 | — | Pending |
| COMP-04 | — | Pending |
| COMP-05 | — | Pending |
| COMP-06 | — | Pending |
| COMPAT-01 | — | Pending |
| COMPAT-02 | — | Pending |
| COMPAT-03 | — | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 0
- Unmapped: 35 ⚠️

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after initial definition*
