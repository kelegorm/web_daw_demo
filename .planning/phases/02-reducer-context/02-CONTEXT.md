# Phase 2: Reducer + Context - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A pure, engine-independent state layer owns all UI and project state. DawStore class (BLoC pattern) is the single source of truth, coordinating between the domain model and the audio engine. Fully exercised by unit tests before any component touches it. No new runtime libraries — React built-ins only (useSyncExternalStore, createContext).

</domain>

<decisions>
## Implementation Decisions

### State boundary — what lives where

- **Reducer state (ProjectDocument + UiState):** track IDs, display names, device references, clip data, selectedTrackId
- **Engine facades (never in state):** mute, gain, pan, recArm, meter levels, gain reduction — all audio values
- **Reducer is structural only** — no audio values, no display preferences (those live in components/hooks near the component that uses them)
- **recArm lives on the engine facade** — it gates MIDI-to-device flow, which is an audio routing concern, not a structural one

### Four-layer architecture

1. **Layer 1 — Domain Model** (`src/state/`): `ProjectDocument` (pure data, no audio/UI knowledge) + `UiState` (separate, selection only, expandable in the future)
2. **Layer 2 — Application Controller** (`src/state/`): `DawStore` class (BLoC pattern) — owns state, coordinates engine, generates IDs
3. **Layer 3 — React Bridge** (`src/context/`): `DawProvider` + hooks via `useSyncExternalStore`
4. **Layer 3a — Audio Engine** (`src/engine/`): Peer to React bridge, NOT dependent on React updates. Called by DawStore, read by components for meters
5. **Layer 4 — UI Components** (`src/components/`): Read from context hooks + engine facades

Full architecture diagram: `02-ARCHITECTURE.md` (in this directory)

### ProjectDocument shape (normalized)

- Named **ProjectDocument** (music document concept — future multi-project support)
- `tracks`: normalized `{ byId, ids }` — each track has `id`, `displayName`, `deviceIds`, `clipIds`
- `devices`: normalized `{ byId }` — flat store, lookup by ID. Tracks reference by `deviceIds`
- `clips`: normalized `{ byId }` — flat store, lookup by ID. Tracks reference by `clipIds`
- `masterTrack`: `{ id, displayName, deviceIds }` — references devices in the shared devices store

### UiState (separate from ProjectDocument)

- `selectedTrackId` — separate from domain model, in its own state slice
- Expandable in the future for other UI preferences

### Context design

- **Two read contexts:** ProjectContext (domain) + UiContext (selection) — selection changes do NOT re-render project consumers
- **One dispatch context:** Single `useDawDispatch()` routes to DawStore methods (addTrack, removeTrack, selectTrack)
- **Combined reducer:** Top-level `dawReducer` delegates to `projectReducer` + `uiReducer` based on action type. Both are pure functions with discriminated union actions

### DawStore class (BLoC pattern)

- Owns state internally (private `#state: { project, ui }`)
- Internally uses reducer pattern (pure function + discriminated union actions) for state transitions
- Coordinates engine calls: **engine first, state second** — if engine fails, state never changes
- Exposes `subscribe()` + `getProjectSnapshot()` + `getUiSnapshot()` for `useSyncExternalStore`
- **Encapsulate concerns into small, focused parts** — example: ID generation logic (validation, creation, caching all existing IDs so they're never reused) belongs in its own encapsulated service

### Action design

- **Single atomic actions** — ADD_TRACK does everything (generate ID, add track, select it) in one dispatch
- **Composed from pure single-concern functions** — not chained sequential dispatches
- Reducer receives one action and updates all relevant state atomically

### File structure

- `src/state/` — reducers, actions, types, DawStore class, ID service
- `src/context/` — DawProvider, useProjectState, useUiState, useDawDispatch (dedicated directory)
- Component-scoped hooks co-locate with their component starting in Phase 2

### buildUiRuntime and ui-plan fate

- **Delete entire `src/ui-plan/` directory** — UiPlan, defaultUiPlan, buildUiRuntime all go
- Whatever reducer+context replaces gets removed immediately from old locations (DRY, no duplication)
- `deviceRegistry` resolving logic moves to where it's needed (components or a utility)
- Remaining functionality (device kind → engine module resolution) gets a semantically correct name, pure functions, and unit tests

### Initial state bootstrapping

- **New `defaultProjectDocument` constant** replaces DEFAULT_UI_PLAN + DEFAULT_MIDI_CLIP_STORE
- Engine singleton pre-exists (as today), DawStore syncs with it by convention
- Initial ProjectDocument matches engine's default state
- DEFAULT_UI_PLAN and DEFAULT_MIDI_CLIP_STORE become unnecessary

### Claude's Discretion

- Exact ID generation algorithm (UUID, nanoid, incrementing — as long as uniqueness + never-reuse is guaranteed)
- Internal reducer action names and type discrimination approach
- How deviceRegistry is restructured after ui-plan deletion
- Error handling specifics in DawStore methods
- Exact file split within src/state/ (how many files, naming)

</decisions>

<specifics>
## Specific Ideas

- "DawStore is BLoC like in Flutter" — the class pattern should feel like Flutter's BLoC: clean separation of business logic from presentation
- "Encapsulate what you can into separate parts, SMALL AND PRETTY" — ID service is the canonical example: all logic regarding validating and creating new IDs, caching all existing IDs so they never be reused, in one place
- "Audio engine should not have to rely on React updates" — engine is a peer, not subordinate to React lifecycle
- "ProjectDocument as in music document" — named for the domain concept of a music project/document, not generic "state"
- "Single concern functions combined in reducer" — not chained dispatches, not monolithic reducers

</specifics>

<deferred>
## Deferred Ideas

- Multi-project / multi-document support — future milestone (motivated the ProjectDocument naming)
- UiState expansion beyond selectedTrackId — future phases as needed
- Component co-location of existing hooks — Phase 4 will move existing hooks to components; Phase 2 applies the pattern to new code only

</deferred>

---

*Phase: 02-reducer-context*
*Context gathered: 2026-03-13*
