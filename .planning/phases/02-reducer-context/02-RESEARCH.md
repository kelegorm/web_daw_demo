# Phase 2: Reducer + Context - Research

**Researched:** 2026-03-13
**Domain:** React state management (useReducer, useSyncExternalStore, Context API), TypeScript discriminated unions, Vitest pure-function testing
**Confidence:** HIGH

## Summary

Phase 2 introduces a four-layer architecture: a pure domain model (`ProjectDocument` + `UiState`), a `DawStore` class (BLoC pattern) that owns state and coordinates the audio engine, a React bridge via `useSyncExternalStore`, and UI components that read from context hooks or engine facades directly. All decisions are locked in CONTEXT.md — no new runtime libraries, React built-ins only.

The standard approach is well-established in the React 19 ecosystem. `useSyncExternalStore` (React 18+, stable) is the correct hook for bridging a non-React store class to React's rendering model. The split-context pattern (separate `ProjectContext`, `UiContext`, `DispatchContext`) is an officially documented React pattern that prevents selection-change re-renders from propagating to project-data consumers.

The biggest implementation risk is `getSnapshot` stability: if `getProjectSnapshot()` or `getUiSnapshot()` return new object references on every call, React will infinite-loop. The `DawStore` must cache immutable snapshots and only replace them when state actually changes. The second risk is the existing jsdom@28 + Node 20.9.0 incompatibility — new reducer/store tests must use the `node` vitest environment (no `// @vitest-environment jsdom` comment), which is already the pattern for all non-DOM tests in this codebase.

**Primary recommendation:** Build `DawStore` to maintain two cached snapshot objects (`#projectSnapshot` and `#uiSnapshot`), replace them atomically with `Object.freeze`ed new objects on each state change, and never reconstruct them inside `getSnapshot`. Tests for reducers and the store class are plain Vitest node-environment unit tests — no React, no DOM, no mocking.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` (useReducer) | ^19.0.0 (already installed) | Pure reducer function + discriminated union actions inside DawStore | Built-in; zero deps; pairs with TypeScript exhaustive checks |
| `react` (createContext + useContext) | ^19.0.0 (already installed) | Three contexts: ProjectContext, UiContext, DispatchContext | Built-in split-context pattern; official React docs pattern |
| `react` (useSyncExternalStore) | ^19.0.0 (already installed) | Bridge DawStore → React render cycle | React 18+ built-in; designed exactly for class-based external stores |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript private class fields (`#`) | Already in tsconfig | Encapsulate `#state`, `#engine`, `#listeners` in DawStore | Already used in `TrackFacadeImpl` — follow same convention |
| `Object.freeze` (native) | Built-in | Ensure snapshot immutability at runtime | Call on each new snapshot object returned by `getProjectSnapshot`/`getUiSnapshot` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useSyncExternalStore` | `useReducer` in DawProvider directly | useReducer in DawProvider would make engine coordination awkward — DawStore BLoC pattern requires state to live outside React. STATE-08 also prohibits adding zustand/redux. |
| Split contexts | Single combined context | Single context re-renders ALL consumers on ANY change. Selection changes (very frequent) would re-render project-data consumers unnecessarily. |
| `Object.freeze` for snapshots | Custom equality check | Freeze is simpler and prevents accidental mutation. Works with `Object.is` comparison in useSyncExternalStore. |

**Installation:** No new packages needed. All APIs are in `react@^19.0.0` which is already installed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── state/
│   ├── types.ts            # ProjectDocument, UiState, Track, Device, Clip type definitions
│   ├── actions.ts          # DawAction discriminated union (ADD_TRACK | REMOVE_TRACK | SELECT_TRACK)
│   ├── projectReducer.ts   # Pure function: (ProjectDocument, DawAction) → ProjectDocument
│   ├── uiReducer.ts        # Pure function: (UiState, DawAction) → UiState
│   ├── dawReducer.ts       # Delegates to projectReducer + uiReducer based on action type
│   ├── idService.ts        # Encapsulated ID generation: validates uniqueness, never reuses
│   ├── defaultState.ts     # defaultProjectDocument constant (replaces DEFAULT_UI_PLAN)
│   └── DawStore.ts         # Class: owns state, coordinates engine, exposes subscribe/getSnapshot
├── context/
│   ├── DawProvider.tsx     # Bridges DawStore → three React contexts via useSyncExternalStore
│   ├── useProjectState.ts  # useContext(ProjectContext) — read-only project data
│   ├── useUiState.ts       # useContext(UiContext) — selection state
│   └── useDawDispatch.ts   # useContext(DispatchContext) — { addTrack, removeTrack, selectTrack }
```

### Pattern 1: DawStore Class with Snapshot Caching

**What:** Store class maintains two immutable cached snapshot objects. Snapshots are replaced only when state changes — never constructed inside `getSnapshot`.

**When to use:** Any time a non-React class (BLoC pattern) needs to drive React re-renders.

```typescript
// Source: React official docs — useSyncExternalStore
// https://react.dev/reference/react/useSyncExternalStore

class DawStore {
  #state: { project: ProjectDocument; ui: UiState }
  #engine: EngineApi
  #listeners: Set<() => void> = new Set()
  // Cached snapshots — same reference until state changes
  #projectSnapshot: ProjectDocument
  #uiSnapshot: UiState

  constructor(engine: EngineApi, initialState: { project: ProjectDocument; ui: UiState }) {
    this.#engine = engine
    this.#state = initialState
    // Initialize cached snapshots to same initial values
    this.#projectSnapshot = Object.freeze({ ...initialState.project })
    this.#uiSnapshot = Object.freeze({ ...initialState.ui })
  }

  // Called by useSyncExternalStore — MUST return same reference when unchanged
  getProjectSnapshot = (): ProjectDocument => this.#projectSnapshot

  getUiSnapshot = (): UiState => this.#uiSnapshot

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #dispatch(action: DawAction): void {
    const newProject = projectReducer(this.#state.project, action)
    const newUi = uiReducer(this.#state.ui, action)
    this.#state = { project: newProject, ui: newUi }
    // Replace snapshot references — Object.is will detect change
    this.#projectSnapshot = Object.freeze({ ...newProject })
    this.#uiSnapshot = Object.freeze({ ...newUi })
    this.#notify()
  }

  #notify(): void {
    this.#listeners.forEach(listener => listener())
  }

  // Public methods (engine first, then state)
  addTrack(): void {
    const id = idService.generate()
    this.#engine.createTrackSubgraph(id)            // engine first
    this.#dispatch({ type: 'ADD_TRACK', id })       // state second
  }

  removeTrack(id: string): void {
    // Enforce min-1 track
    if (this.#state.project.tracks.ids.length <= 1) return
    this.#engine.removeTrackSubgraph(id)
    this.#dispatch({ type: 'REMOVE_TRACK', id })
  }

  selectTrack(id: string): void {
    this.#dispatch({ type: 'SELECT_TRACK', id })   // UI only, no engine
  }
}
```

### Pattern 2: DawProvider with useSyncExternalStore

**What:** Provider component bridges DawStore to three separate contexts. Arrow function methods on DawStore (`subscribe =`, `getProjectSnapshot =`, `getUiSnapshot =`) are class-instance-bound and stable — safe to pass directly to `useSyncExternalStore` without `useCallback`.

**When to use:** Once per app, wraps the component tree above all consumers.

```typescript
// Source: React official docs — useSyncExternalStore
// https://react.dev/reference/react/useSyncExternalStore

// React 19: use <Context value=...> instead of <Context.Provider value=...>
// <Context.Provider> still works but is deprecated in React 19.

const ProjectContext = createContext<ProjectDocument | null>(null)
const UiContext = createContext<UiState | null>(null)
const DispatchContext = createContext<DawDispatch | null>(null)

export function DawProvider({ store, children }: { store: DawStore; children: React.ReactNode }) {
  const project = useSyncExternalStore(store.subscribe, store.getProjectSnapshot)
  const ui = useSyncExternalStore(store.subscribe, store.getUiSnapshot)

  // dispatch object is stable — store methods are bound arrow functions
  const dispatch: DawDispatch = useMemo(() => ({
    addTrack: () => store.addTrack(),
    removeTrack: (id) => store.removeTrack(id),
    selectTrack: (id) => store.selectTrack(id),
  }), [store])

  return (
    <ProjectContext value={project}>
      <UiContext value={ui}>
        <DispatchContext value={dispatch}>
          {children}
        </DispatchContext>
      </UiContext>
    </ProjectContext>
  )
}
```

### Pattern 3: Discriminated Union Actions with Exhaustive Check

**What:** All reducer actions are a TypeScript discriminated union. The `never` guard in the default case catches missing cases at compile time.

**When to use:** Both `projectReducer` and `uiReducer`.

```typescript
// Source: TypeScript handbook — Narrowing
// https://www.typescriptlang.org/docs/handbook/2/narrowing.html

type DawAction =
  | { type: 'ADD_TRACK'; id: string; displayName: string }
  | { type: 'REMOVE_TRACK'; id: string }
  | { type: 'SELECT_TRACK'; id: string }

function projectReducer(state: ProjectDocument, action: DawAction): ProjectDocument {
  switch (action.type) {
    case 'ADD_TRACK':
      return {
        ...state,
        tracks: {
          byId: { ...state.tracks.byId, [action.id]: { id: action.id, displayName: action.displayName, deviceIds: [], clipIds: [] } },
          ids: [...state.tracks.ids, action.id],
        },
      }
    case 'REMOVE_TRACK': {
      const { [action.id]: _removed, ...remaining } = state.tracks.byId
      return {
        ...state,
        tracks: {
          byId: remaining,
          ids: state.tracks.ids.filter(id => id !== action.id),
        },
      }
    }
    case 'SELECT_TRACK':
      return state  // projectReducer doesn't care about selection
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}
```

### Pattern 4: ID Service

**What:** Encapsulated service for ID generation. Caches all used IDs. IDs are never reused after removal.

**When to use:** DawStore delegates to idService when generating track IDs.

```typescript
// Encapsulated service — all ID logic in one place.
// Algorithm choice (nanoid, UUID, incrementing) is Claude's discretion per CONTEXT.md.
// Requirement: uniqueness + never-reuse guarantee.

export function createIdService() {
  const used = new Set<string>()

  // Register pre-existing IDs from initial state (call on construction)
  function seed(ids: string[]): void {
    ids.forEach(id => used.add(id))
  }

  function generate(): string {
    // Simple: incrementing counter as a string is sufficient for a demo app.
    // Could use crypto.randomUUID() for production uniqueness guarantees.
    let id: string
    do {
      id = `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    } while (used.has(id))
    used.add(id)
    return id
  }

  return { seed, generate }
}
```

### Anti-Patterns to Avoid

- **New object in getSnapshot:** Calling `{ ...this.#state.project }` inside `getProjectSnapshot()` creates a new reference on every call. React uses `Object.is` to detect changes — a new object every call causes infinite re-render. Cache the snapshot and only replace it when state actually changes.
- **Engine after state:** DawStore methods must call engine first, then update state. If engine throws, state remains consistent.
- **Chained dispatches for atomic actions:** `ADD_TRACK` should update both `projectReducer` and `uiReducer` in a single `dawReducer` call. Don't dispatch `ADD_TRACK` then separately dispatch `SELECT_TRACK` — single atomic action.
- **Context.Provider in React 19:** React 19 deprecates `<SomeContext.Provider value=...>` in favor of `<SomeContext value=...>`. Use the new syntax for new code.
- **jsdom in new reducer tests:** New unit tests for `projectReducer`, `uiReducer`, `dawReducer`, `DawStore`, and `idService` must NOT use `// @vitest-environment jsdom`. They are pure function tests that run in the `node` environment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscribing external store to React | Custom `useState` + `useEffect` subscription | `useSyncExternalStore` | `useEffect`-based subscriptions tear during concurrent rendering — React sees inconsistent state between render and commit. `useSyncExternalStore` is the concurrency-safe solution. |
| Context re-render optimization | Custom `shouldUpdate` logic, context selectors, `memo` wrappers | Split contexts (ProjectContext + UiContext) | Two contexts means selection changes only re-render UiContext consumers. Adding memo/selectors adds complexity that split contexts avoid entirely. |
| ID uniqueness tracking | Manual array scan or Set in multiple places | `idService` (single encapsulated service) | ID concerns (generation, validation, never-reuse cache) belong in one place. Scattered ID logic leads to duplicate IDs when tracks are removed and re-added. |
| Engine coordination | Mixing engine calls into reducers | DawStore methods coordinate engine; reducers are pure | Reducers must be pure for testing. Engine calls in reducers make them untestable without mocking. |

**Key insight:** `useSyncExternalStore` exists precisely for this pattern — a class-based store that lives outside React, with subscribe/getSnapshot. Do not reimplament it with `useEffect` + `useState`.

## Common Pitfalls

### Pitfall 1: getSnapshot Returns New Object Every Call

**What goes wrong:** `getProjectSnapshot()` reconstructs an object (`{ ...this.#state.project }`) every call. React detects a different reference on every render → logs warning "The result of getSnapshot should be cached" → triggers infinite re-render loop.

**Why it happens:** Developers conflate "return current state" with "return snapshot of current state". State can be mutable internally; snapshot must be immutable and stable.

**How to avoid:** Maintain `#projectSnapshot` and `#uiSnapshot` as class fields. Replace them (with `Object.freeze`) only inside `#dispatch()` when state changes. `getProjectSnapshot` simply returns `this.#projectSnapshot`.

**Warning signs:** Console warning "The result of getSnapshot should be cached"; runaway re-renders; UI hangs.

### Pitfall 2: subscribe/getSnapshot Defined Inline in DawProvider

**What goes wrong:** If `subscribe`, `getProjectSnapshot`, or `getUiSnapshot` are defined as lambda expressions inside `DawProvider`, they create new function references on every render, causing unnecessary re-subscriptions.

**Why it happens:** Arrow functions in JSX/TSX are recreated each render.

**How to avoid:** Define them as arrow-method class fields on `DawStore` (`subscribe = ...`, `getProjectSnapshot = ...`). Class field arrow functions are bound at construction and maintain stable reference identity. Pass them directly to `useSyncExternalStore`.

**Warning signs:** The store subscriber is being called more than expected; performance profiler shows excessive subscription churn.

### Pitfall 3: jsdom@28 + Node 20.9.0 Blocks Test Files

**What goes wrong:** Any test file with `// @vitest-environment jsdom` fails with `ERR_REQUIRE_ESM` from `html-encoding-sniffer` requiring `@exodus/bytes` ESM package. This is confirmed: jsdom@28 requires Node 20.19.0 minimum; the project runs Node 20.9.0.

**Why it happens:** jsdom@28's dependency `html-encoding-sniffer` requires a CJS-incompatible ESM module. Node 20.9.0 cannot load it. Confirmed 5 existing test files affected: `App.test.tsx`, `DevicePanel.test.tsx`, `TrackZone.test.tsx`, `MidiKeyboard.test.tsx`, `useToneSynth.test.ts`.

**How to avoid:** All new Phase 2 tests (reducers, DawStore, idService, context hooks) must NOT use `// @vitest-environment jsdom`. They are pure logic tests with zero DOM requirement. The default `node` environment is correct and already works.

**Warning signs:** `ERR_REQUIRE_ESM` error at test file startup; 5 existing files still fail with this error (known pre-existing issue, not caused by Phase 2 work).

### Pitfall 4: Snapshot Not Freezing Nested Objects

**What goes wrong:** `Object.freeze(snapshot)` only freezes the top-level object. Nested objects (e.g., `snapshot.tracks.byId`) remain mutable. Components mutating nested state bypass the pure-state guarantee.

**Why it happens:** Shallow freeze is the default behavior of `Object.freeze`.

**How to avoid:** For Phase 2 scope, rely on TypeScript `readonly` modifiers in type definitions to catch accidental mutation at compile time. Deep freeze adds runtime overhead and is not needed for correctness as long as reducers return new objects via spread (`{ ...state, tracks: { ...state.tracks, ... } }`).

**Warning signs:** State changes in one component are visible without re-render; reducer tests pass but runtime shows stale data.

### Pitfall 5: Engine Called Inside Reducer

**What goes wrong:** Calling `engine.createTrackSubgraph()` inside `projectReducer` makes the reducer impure — it has side effects. Reducer unit tests require mocking the engine.

**Why it happens:** Placing "do the full operation" logic in the reducer feels natural but breaks the pure-function contract.

**How to avoid:** Strictly enforce: reducers receive pure data, compute new pure data, return it. Engine coordination belongs only in `DawStore` public methods, before the `#dispatch()` call. This is documented in the architecture and matches the existing engine singleton pattern.

**Warning signs:** `projectReducer` imports from `src/engine/`; reducer tests need `vi.mock()`.

### Pitfall 6: ui-plan/ Deletion Leaves Dead Imports

**What goes wrong:** Deleting `src/ui-plan/` while `App.tsx`, `DevicePanel.tsx`, and `TrackZone.tsx` still import from it causes compile errors.

**Why it happens:** Migration is not atomic — old consumers exist until components are updated.

**How to avoid:** Plan deletion of `src/ui-plan/` as a single task that also updates all import sites in the same commit. Do not delete the directory before all consumers are migrated. The `deviceRegistry` render logic moves to a new location (not deleted).

**Warning signs:** TypeScript compile errors referencing deleted modules; `tsc -b` failing in CI.

## Code Examples

### Normalized State Shape (ProjectDocument)

```typescript
// Source: Architecture decision in 02-CONTEXT.md and 02-ARCHITECTURE.md

interface Track {
  readonly id: string
  readonly displayName: string
  readonly deviceIds: readonly string[]
  readonly clipIds: readonly string[]
}

interface Device {
  readonly id: string
  readonly kind: 'SYNTH' | 'PANNER' | 'LIMITER'
  readonly displayName: string
}

interface MasterTrack {
  readonly id: string
  readonly displayName: string
  readonly deviceIds: readonly string[]
}

interface NormalizedMap<T> {
  readonly byId: Readonly<Record<string, T>>
  readonly ids: readonly string[]
}

interface ProjectDocument {
  readonly tracks: NormalizedMap<Track>
  readonly devices: Readonly<Record<string, Device>>  // flat, not NormalizedMap
  readonly clips: Readonly<Record<string, MidiClip>>  // flat, not NormalizedMap
  readonly masterTrack: MasterTrack
}

interface UiState {
  readonly selectedTrackId: string
}
```

### Default Project Document

```typescript
// Replaces DEFAULT_UI_PLAN + DEFAULT_MIDI_CLIP_STORE
// Source: 02-CONTEXT.md — "Initial state bootstrapping"

import { DEFAULT_TRACK_ID } from '../engine/engineSingleton'

export const DEFAULT_PROJECT_DOCUMENT: ProjectDocument = {
  tracks: {
    byId: {
      [DEFAULT_TRACK_ID]: {
        id: DEFAULT_TRACK_ID,
        displayName: 'synth1',
        deviceIds: ['dev-synth', 'dev-panner'],
        clipIds: ['clip-default'],
      },
    },
    ids: [DEFAULT_TRACK_ID],
  },
  devices: {
    'dev-synth': { id: 'dev-synth', kind: 'SYNTH', displayName: 'Synth' },
    'dev-panner': { id: 'dev-panner', kind: 'PANNER', displayName: 'Panner' },
    'dev-limiter': { id: 'dev-limiter', kind: 'LIMITER', displayName: 'Limiter' },
  },
  clips: {
    'clip-default': { /* MidiClip data — same as current DEFAULT_MIDI_CLIP_STORE */ },
  },
  masterTrack: {
    id: 'master',
    displayName: 'Master',
    deviceIds: ['dev-limiter'],
  },
}
```

### Pure Reducer Unit Test Pattern (Vitest node environment)

```typescript
// Source: codebase convention — all non-DOM tests use node environment
// No @vitest-environment comment = node environment (vitest.config.ts default)

import { describe, it, expect } from 'vitest'
import { projectReducer } from './projectReducer'
import { DEFAULT_PROJECT_DOCUMENT } from './defaultState'

describe('projectReducer', () => {
  it('ADD_TRACK adds track to byId and ids', () => {
    const result = projectReducer(DEFAULT_PROJECT_DOCUMENT, {
      type: 'ADD_TRACK',
      id: 'track-2',
      displayName: 'Track 2',
    })
    expect(result.tracks.ids).toContain('track-2')
    expect(result.tracks.byId['track-2']).toMatchObject({ id: 'track-2', displayName: 'Track 2' })
    // Original state is unchanged (pure function)
    expect(DEFAULT_PROJECT_DOCUMENT.tracks.ids).not.toContain('track-2')
  })

  it('REMOVE_TRACK removes track and cleans up', () => {
    const stateWith2 = projectReducer(DEFAULT_PROJECT_DOCUMENT, {
      type: 'ADD_TRACK', id: 'track-2', displayName: 'Track 2',
    })
    const result = projectReducer(stateWith2, { type: 'REMOVE_TRACK', id: 'track-2' })
    expect(result.tracks.ids).not.toContain('track-2')
    expect(result.tracks.byId['track-2']).toBeUndefined()
  })
})
```

### buildUiRuntime Replacement: deviceRegistry Render Logic

```typescript
// deviceRegistry.ts is the ONLY part of src/ui-plan/ with logic that survives deletion.
// Its render() functions (createElement calls) move to a new location.
// Suggested: src/components/DeviceRenderer.ts or co-located with DevicePanel.
// Source: 02-CONTEXT.md — "deviceRegistry resolving logic moves to where it's needed"

// The kind → component mapping pattern survives unchanged:
export const DEVICE_KIND_TO_COMPONENT: Record<DeviceKind, React.ComponentType<...>> = {
  SYNTH: SynthDevice,
  PANNER: PannerDevice,
  LIMITER: LimiterDevice,
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Context.Provider value=...>` | `<Context value=...>` (Context as provider) | React 19 (Dec 2024) | `.Provider` deprecated; use new syntax for new code |
| `useEffect` + `useState` subscription to external store | `useSyncExternalStore` | React 18 (2022) | Concurrent-mode safe; prevents tearing; required for external class-based stores |
| Single combined state+dispatch context | Split contexts (state + dispatch separate) | React 16+ best practice, officially documented | Dispatch consumers don't re-render on state changes |
| Flat array for track list | Normalized map (`byId` + `ids`) | Redux Toolkit popularized ~2020; now standard | O(1) lookup by ID; consistent with normalized entity pattern |

**Deprecated/outdated:**
- `Context.Provider`: Still works in React 19 but deprecated — will be removed in a future major. New code should use `<Context value=...>`.
- `useEffect`-based subscription to external store: Works but not safe with concurrent rendering. `useSyncExternalStore` is the correct replacement.

## Open Questions

1. **buildUiRuntime replacement scope**
   - What we know: CONTEXT.md says delete `src/ui-plan/` entirely; `deviceRegistry` render logic moves to where it's needed
   - What's unclear: The exact landing place for `deviceRegistry`'s `render()` functions has not been decided — CONTEXT.md says "where it's needed (components or a utility)" but does not lock down a specific file
   - Recommendation: Planner should lock this down in the Phase 2 plan. Two viable options: (a) inline rendering in `DevicePanel.tsx` using a local `DEVICE_KIND_TO_COMPONENT` map, or (b) a new `src/components/renderDevice.ts` utility. Option (a) is simpler and recommended for Phase 2 scope since DevicePanel is the only consumer.

2. **App.tsx migration scope**
   - What we know: `App.tsx` currently builds `legacyEngineAdapter`, constructs `uiRuntime`, and passes models as props. These all get replaced by context hooks.
   - What's unclear: Whether all of `App.tsx` is migrated in Phase 2 or just the state layer is introduced while component wiring is Phase 3
   - Recommendation: The context layer (DawStore, DawProvider, reducers, hooks) can be built and fully tested in Phase 2 without touching any component. Component migration (replacing props with context hooks in TrackZone, DevicePanel, etc.) is Phase 3 scope. Phase 2 ends when `DawProvider` wraps the app and context hooks exist — not when components are fully migrated.

3. **defaultProjectDocument clip data**
   - What we know: `clips: { byId }` must match the current `DEFAULT_MIDI_CLIP_STORE` data so the sequencer still works
   - What's unclear: Whether `ProjectDocument.clips` stores the full `MidiClip` type from `midiClipStore.ts` or just references
   - Recommendation: For Phase 2, `clips.byId` stores full `MidiClip` objects (same type from `project-runtime/midiClipStore.ts`). The architecture diagram shows `clips: { byId: { "clip-1": { clipId, startBeat, lengthSteps, steps[] } } }` — this is the full clip data, not a reference.

## Sources

### Primary (HIGH confidence)

- `https://react.dev/reference/react/useSyncExternalStore` — API signature, subscribe contract, getSnapshot stability requirements, snapshot caching pitfall
- `https://react.dev/learn/scaling-up-with-reducer-and-context` — Split context pattern (StateContext + DispatchContext), reducer + context wiring, custom hooks pattern
- `https://react.dev/blog/2024/12/05/react-19` — React 19 context-as-provider syntax change (`<Context value=...>`), deprecation of `<Context.Provider>`
- `https://www.typescriptlang.org/docs/handbook/2/narrowing.html` — Discriminated union exhaustiveness check (`never` guard in switch default)
- Codebase: `src/engine/engineSingleton.ts` — existing private class field pattern (`#disposed`, `#strip`) to follow
- Codebase: `src/hooks/useTrackSelection.test.ts` — existing pure-function test pattern (no `@vitest-environment jsdom`)
- Codebase: `vitest.config.ts` — confirms `environment: 'node'` default; jsdom only when comment is present

### Secondary (MEDIUM confidence)

- `https://www.epicreact.dev/use-sync-external-store-demystified-for-practical-react-development-w5ac0` — Snapshot stability: stable references, class-field arrow functions for subscribe/getSnapshot, pitfall documentation
- `https://github.com/vitest-dev/vitest/issues/9281` — jsdom@28 requires Node 20.19.0 minimum; Node 20.9.0 causes `ERR_REQUIRE_ESM`; confirmed root cause
- `https://stevekinney.com/courses/react-performance/separating-actions-from-state-two-contexts` — Dispatch context stability (stable reference via useMemo or class field), re-render isolation pattern

### Tertiary (LOW confidence)

- General Web search results on discriminated unions, BLoC pattern in TypeScript — not directly cited; patterns verified against official TypeScript docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs are React built-ins with official documentation verified
- Architecture: HIGH — CONTEXT.md decisions are locked; architecture is fully documented in 02-ARCHITECTURE.md
- Pitfalls: HIGH for getSnapshot stability (verified via React docs + Epic React), HIGH for jsdom issue (verified via GitHub issue + local test run), MEDIUM for nested freeze (standard practice, not a React-specific doc)
- Code examples: MEDIUM — examples are synthesized from official docs + codebase patterns; exact TypeScript generics may need minor adjustment

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (React 19 is stable; no fast-moving APIs in scope)
