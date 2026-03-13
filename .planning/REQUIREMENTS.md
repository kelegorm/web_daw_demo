# Requirements: Kelegorm DAW

**Defined:** 2026-03-12
**Core Value:** Audio and visual state stay synchronized through a clean reducer boundary — the engine is never directly touched by UI components.

## v1 Requirements

Requirements for milestone v1.0: State Architecture & Dynamic Tracks.

### Engine Architecture

- [x] **ENG-01**: Audio engine lives as a module-level singleton, not managed by React lifecycle
- [x] **ENG-02**: Engine survives React StrictMode double-mount without creating duplicate AudioContexts
- [x] **ENG-03**: Engine exposes `createTrackSubgraph(trackId)` that creates a track strip (gain + mute + meter) wired to a shared pre-limiter bus
- [x] **ENG-04**: Engine exposes `removeTrackSubgraph(trackId)` that disposes audio nodes and disconnects from bus
- [x] **ENG-05**: Engine exposes `getTrackFacade(trackId)` replacing hardcoded APP_* constant lookups
- [x] **ENG-06**: Shared `preLimiterBus` GainNode sums all track outputs before limiter → master → destination
- [x] **ENG-07**: All APP_SYNTH_MODULE_ID, APP_PANNER_MODULE_ID, APP_TRACK_STRIP_ID, APP_LIMITER_MODULE_ID, APP_MASTER_STRIP_ID constants deleted

### State Management

- [x] **STATE-01**: App state managed by `useReducer` with discriminated union actions
- [x] **STATE-02**: State shape uses normalized track map (`byId` + `ids` array), not flat array
- [x] **STATE-03**: Split Context pattern — separate StateContext and DispatchContext
- [x] **STATE-04**: `DawProvider` wraps app and bridges reducer ↔ engine
- [x] **STATE-05**: Track selection, rec-arm, and track list live in reducer state
- [x] **STATE-06**: Transport playback values (isPlaying, currentStep, bpm) stay outside Context (read from hooks, not context)
- [x] **STATE-07**: Audio values (volume, mute, meter levels) never stored in reducer — read from engine facades
- [x] **STATE-08**: No new runtime libraries added — only React built-ins (useReducer, createContext)

### Track CRUD

- [x] **CRUD-01**: User can add a new empty track via UI button
- [x] **CRUD-02**: Added track gets a track strip wired to engine immediately (gain, mute, meters work)
- [x] **CRUD-03**: Added track is auto-selected after creation
- [x] **CRUD-04**: User can remove any regular track via UI button
- [x] **CRUD-05**: Removed track's audio nodes are disposed before state settles
- [x] **CRUD-06**: If selected track is removed, selection moves to adjacent track
- [x] **CRUD-07**: Minimum 1 regular track enforced — remove button disabled or hidden when only 1 track remains

### App Cleanup

- [x] **APP-01**: App.tsx gutted to `<DawProvider><Layout /></DawProvider>` (no state, no module lookups)
- [x] **APP-02**: `useAudioEngine` hook deleted (replaced by engine singleton)
- [x] **APP-03**: `useTrackSelection` hook deleted (replaced by reducer state)
- [x] **APP-04**: `buildUiRuntime` either eliminated or reduced to selected-track device resolution only

### Component Migration

- [ ] **COMP-01**: Toolbar reads transport state from hooks, dispatches via context
- [x] **COMP-02**: TrackZone reads track list from context, dispatches selection/mute/volume via context
- [x] **COMP-03**: DevicePanel reads selected track devices from context or engine facade
- [x] **COMP-04**: MidiKeyboard enablement follows selected track rec-arm state from context
- [x] **COMP-05**: No prop drilling from App.tsx to any component
- [x] **COMP-06**: All new files under 500 lines, no `any` or `unknown` types
- [x] **COMP-07**: Layout.tsx track selection reads from DawStore/context (selectedTrackId from reducer, not local useState)

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
| ENG-01 | Phase 1 | Complete |
| ENG-02 | Phase 1 | Complete |
| ENG-03 | Phase 1 | Complete |
| ENG-04 | Phase 1 | Complete |
| ENG-05 | Phase 1 | Complete |
| ENG-06 | Phase 1 | Complete |
| ENG-07 | Phase 1 | Complete |
| STATE-01 | Phase 2 | Complete |
| STATE-02 | Phase 2 | Complete |
| STATE-03 | Phase 2 | Complete |
| STATE-04 | Phase 2 | Complete |
| STATE-05 | Phase 2 | Complete |
| STATE-06 | Phase 2 | Complete |
| STATE-07 | Phase 2 | Complete |
| STATE-08 | Phase 2 | Complete |
| CRUD-01 | Phase 4 | Complete |
| CRUD-02 | Phase 4 | Complete |
| CRUD-03 | Phase 4 | Complete |
| CRUD-04 | Phase 4 | Complete |
| CRUD-05 | Phase 4 | Complete |
| CRUD-06 | Phase 4 | Complete |
| CRUD-07 | Phase 4 | Complete |
| APP-01 | Phase 3 | Complete |
| APP-02 | Phase 3 | Complete |
| APP-03 | Phase 3 | Complete |
| APP-04 | Phase 3 | Complete |
| COMP-01 | Phase 5 | Pending |
| COMP-02 | Phase 4 | Complete |
| COMP-03 | Phase 4 | Complete |
| COMP-04 | Phase 4 | Complete |
| COMP-05 | Phase 4 | Complete |
| COMP-06 | Phase 4 | Complete |
| COMP-07 | Phase 4 | Complete |
| COMPAT-01 | Phase 5 | Pending |
| COMPAT-02 | Phase 5 | Pending |
| COMPAT-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-13 — Phase 4 requirements complete, COMP-01 moved to Phase 5*
