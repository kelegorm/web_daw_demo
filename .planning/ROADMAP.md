# Roadmap: Kelegorm DAW

## Overview

Milestone v1.0 refactors the DAW from a single-track, App.tsx-managed prototype into a clean
reducer/context architecture with the audio engine as a standalone singleton and a dynamic track
list. Five phases execute in strict dependency order: engine foundation first (everything else
depends on it), then the pure state layer, then App.tsx teardown, then component migration with
Track CRUD wired through context, and finally transport decoupling as the integration close-out.
The existing E2E test suite acts as the regression gate at every phase boundary.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Engine Multi-Track Foundation** - Establish engine singleton, preLimiterBus, and track subgraph API
- [x] **Phase 2: Reducer + Context** - Pure state layer with normalized track map and split context
- [ ] **Phase 3: App.tsx Teardown** - Gut App.tsx to DawProvider + Layout, delete deprecated hooks
- [ ] **Phase 4: Component Migration + Track CRUD** - Migrate all components to context, wire Add/Remove track
- [ ] **Phase 5: Transport Decoupling + Integration Close-Out** - Isolate transport, sequencer cleanup, full regression gate

## Phase Details

### Phase 1: Engine Multi-Track Foundation

**Goal:** The audio engine manages N parallel track subgraphs through a stable, React-independent API

**Depends on:** Nothing (first phase)

**Requirements:** ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07

**Success Criteria** (what must be TRUE):
1. `getAudioEngine()` returns the same engine instance across multiple calls in the same session — no duplicate AudioContexts created, verified in unit tests including StrictMode simulation
2. Calling `createTrackSubgraph(trackId)` produces a working track strip (gain, mute, meters) connected to the shared `preLimiterBus`, and audio passes through the chain to destination
3. Calling `removeTrackSubgraph(trackId)` disconnects and disposes all audio nodes for that track — the engine no longer holds references to them and the preLimiterBus sum is updated
4. `getTrackFacade(trackId)` returns the correct facade for the given ID — no more APP_* constant lookups exist anywhere in the codebase
5. All unit tests that touch the audio graph pass; no existing Vitest tests are broken by this phase

**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Engine singleton + preLimiterBus + master chain + facade type definitions
- [x] 01-02-PLAN.md — createTrackSubgraph / removeTrackSubgraph / getTrackFacade + TrackFacade class
- [x] 01-03-PLAN.md — Delete APP_* constants, migrate App.tsx to singleton, delete useAudioEngine.ts

---

### Phase 2: Reducer + Context

**Goal:** A pure, engine-independent reducer owns all UI state and is fully exercised by unit tests before any component touches it

**Depends on:** Phase 1

**Requirements:** STATE-01, STATE-02, STATE-03, STATE-04, STATE-05, STATE-06, STATE-07, STATE-08

**Success Criteria** (what must be TRUE):
1. `dawReducer` is a pure function with no engine imports — all cases (ADD_TRACK, REMOVE_TRACK, SELECT_TRACK, SET_REC_ARM, etc.) can be tested with plain object input/output and zero React or audio setup
2. Track state is stored as a normalized map (`byId` + `ids`) — components can look up any track by ID in O(1) without scanning an array
3. `DawProvider` wraps the app and consumers can read state via `useDawState()` and dispatch via `useDawDispatch()` as two separate hooks — a dispatch-only consumer does not re-render when unrelated state changes
4. Transport playback values (isPlaying, currentStep, bpm) are NOT in DawStateContext — reading them from transport hooks does not cause context re-renders during playback
5. Audio values (volume dB, meter levels, mute state) are NOT in reducer state — they are read directly from engine facades

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — Domain types + discriminated union actions + pure reducers + ID service + default state
- [x] 02-02-PLAN.md — DawStore class (BLoC pattern) with engine coordination and snapshot caching
- [x] 02-03-PLAN.md — DawProvider + split contexts + consumer hooks (useProjectState, useUiState, useDawDispatch)

---

### Phase 3: App.tsx Teardown

**Goal:** App.tsx contains nothing but `<DawProvider><Layout /></DawProvider>` — all state, hooks, and module lookups removed

**Depends on:** Phase 2

**Requirements:** APP-01, APP-02, APP-03, APP-04

**Success Criteria** (what must be TRUE):
1. `App.tsx` has no `useState`, no `useEffect`, no engine hook calls, no module ID constants — its only job is to render DawProvider wrapping Layout
2. `useAudioEngine.ts` is deleted from the codebase — no import of it exists anywhere
3. `useTrackSelection.ts` is deleted from the codebase — selection state lives in the reducer
4. All existing Playwright E2E tests pass unchanged after this phase — the UI behaves identically to before the teardown from a user's perspective

**Plans:** TBD

Plans:
- [ ] 03-01: Gut App.tsx, wire DawProvider + Layout, delete useAudioEngine + useTrackSelection
- [ ] 03-02: Reduce buildUiRuntime to selected-track device resolution only (or delete if possible), update all callsites

---

### Phase 4: Component Migration + Track CRUD

**Goal:** Every component reads from context and dispatches through context — Add and Remove track buttons work end-to-end with correct audio wiring and selection behavior

**Depends on:** Phase 3

**Requirements:** CRUD-01, CRUD-02, CRUD-03, CRUD-04, CRUD-05, CRUD-06, CRUD-07, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06

**Success Criteria** (what must be TRUE):
1. Clicking "Add Track" creates a new track, immediately wires its strip to the engine (gain, mute, and meters functional), auto-selects the new track, and the DevicePanel updates to show the new track's state
2. Clicking "Remove Track" on any non-last track disposes its audio nodes, removes it from the track list, and selection moves to the adjacent track — all observable without page reload
3. The Remove Track button is visually disabled (not hidden) when exactly one track remains — a second click has no effect
4. MIDI keyboard input follows the rec-arm state of the currently selected track (not hardcoded to the initial track)
5. No component receives props from App.tsx — all data flows from context or engine facades directly into the component that needs it
6. All new files introduced in this phase are under 500 lines and contain no `any` or `unknown` types

**Plans:** TBD

Plans:
- [ ] 04-01: Toolbar context migration (transport state from hooks, dispatches via context)
- [ ] 04-02: TrackZone context migration + Add/Remove track buttons wired through useAppActions
- [ ] 04-03: DevicePanel context migration (selected-track device resolution from context or engine facade)
- [ ] 04-04: MidiKeyboard rec-arm follows selectedTrackId from context

---

### Phase 5: Transport Decoupling + Integration Close-Out

**Goal:** Transport owns only playback state, per-track sequencers correctly scope their Part lifecycle, and the full test suite is green with the interface visually and functionally identical to pre-refactor

**Depends on:** Phase 4

**Requirements:** COMPAT-01, COMPAT-02, COMPAT-03

**Success Criteria** (what must be TRUE):
1. `useTransportController` receives no `TrackStripHook` dependency — transport state (playing/paused/stopped, bpm, loop, currentStep) is fully isolated from track-strip state
2. Removing a track during active playback does not stop or glitch other tracks — per-track sequencer stop calls only `part.stop(0)` / `part.cancel(0)`, never `Tone.getTransport().stop()`
3. All existing Vitest unit tests pass without modification (or with only minimal import-path adapter changes)
4. All existing Playwright E2E tests pass — transport play/stop/BPM change, track/mixer controls, device panel controls, and meter activity all behave identically to pre-refactor

**Plans:** TBD

Plans:
- [ ] 05-01: Decouple useTransportController from TrackStripHook, per-track sequencer Part scoping
- [ ] 05-02: Full regression pass — run complete Vitest + Playwright suite, fix any remaining adapter issues

---

## Progress

**Execution Order:** 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine Multi-Track Foundation | 3/3 | ✓ Complete | 2026-03-12 |
| 2. Reducer + Context | 3/3 | ✓ Complete | 2026-03-13 |
| 3. App.tsx Teardown | 0/2 | Not started | - |
| 4. Component Migration + Track CRUD | 0/4 | Not started | - |
| 5. Transport Decoupling + Integration Close-Out | 0/2 | Not started | - |

---
*Roadmap created: 2026-03-12 for milestone v1.0 State Architecture & Dynamic Tracks*
*Last updated: 2026-03-13 — Phase 2 complete*
