# Stack Research

**Domain:** React state architecture for browser DAW
**Researched:** 2026-03-12
**Confidence:** HIGH

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | ^19.0.0 (already installed) | UI framework | No change needed; useReducer + Context are first-class in React 19 |
| TypeScript | ~5.7.2 (already installed) | Type safety for reducer state and actions | Discriminated union actions provide exhaustiveness checking in switch statements |
| useReducer (built-in) | React 19 | Replace scattered useState in App.tsx | Centralizes state transitions, makes dispatch the only write path to UI state |
| createContext (built-in) | React 19 | Distribute reducer state and dispatch without prop drilling | Split into two contexts: one for state reads, one for dispatch; prevents unnecessary re-renders |
| Module-level variable (no library) | n/a | Audio engine singleton, outside React lifecycle | Engine must not be managed by React lifecycle; module-level variable survives re-renders and StrictMode double invocation |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| use-immer | ^0.11.x | Mutable-style reducer updates for nested state | Optional. Use only if reducer case bodies become hard to read due to nested spread operations on track lists. The flat shape recommended below makes this unnecessary for MVP. |

No other libraries are recommended. The project decision to avoid Zustand/Redux is correct for this scope. The existing Tone.js and Web Audio stack is unchanged.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit-test reducers and selectors in isolation | Reducers are pure functions; test them without React or audio mocks |
| Playwright | E2E verification that refactor did not break transport/track flows | Existing test suite is the regression gate |

---

## Installation

No new runtime packages are required. The existing stack covers everything:

```bash
# Nothing to install for core patterns.
# Only add use-immer if nested reducer mutations become unreadable:
npm install use-immer
```

---

## Recommended Patterns

This section is the primary output. Specific patterns with rationale, not just option lists.

### 1. Reducer + Context: Split State and Dispatch

**Pattern:** Two separate contexts — one for state, one for dispatch.

```typescript
// src/state/AppStateContext.tsx

export const AppStateContext = createContext<AppState | null>(null)
export const AppDispatchContext = createContext<React.Dispatch<AppAction> | null>(null)

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState)
  return (
    <AppStateContext value={state}>
      <AppDispatchContext value={dispatch}>
        {children}
      </AppDispatchContext>
    </AppStateContext>
  )
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be inside AppStateProvider')
  return ctx
}

export function useAppDispatch(): React.Dispatch<AppAction> {
  const ctx = useContext(AppDispatchContext)
  if (!ctx) throw new Error('useAppDispatch must be inside AppStateProvider')
  return ctx
}
```

**Why split:** `dispatch` is stable (same reference across renders). Components that only dispatch (toolbar buttons, track controls) subscribe to the dispatch context and never re-render when state changes. Components that only read (meter displays, selection UI) subscribe to state and never get dispatch re-renders.

**React 19 note:** Context can now be written as `<AppStateContext value={state}>` instead of `<AppStateContext.Provider value={state}>`. Both forms work; the shorter form is preferred for new code.

---

### 2. Discriminated Union Actions with TypeScript

**Pattern:** All actions as a tagged union. No string literals scattered across call sites.

```typescript
// src/state/appActions.ts

export type AppAction =
  | { type: 'transport/play' }
  | { type: 'transport/pause' }
  | { type: 'transport/stop' }
  | { type: 'transport/set_bpm'; bpm: number }
  | { type: 'transport/set_loop'; loop: boolean }
  | { type: 'track/select'; trackId: string }
  | { type: 'track/set_mute'; trackId: string; muted: boolean }
  | { type: 'track/set_volume'; trackId: string; db: number }
  | { type: 'track/set_rec_arm'; trackId: string; enabled: boolean }
  | { type: 'track/add' }
  | { type: 'track/remove'; trackId: string }
```

**Why this shape:** TypeScript narrows `action` within each `case` branch. Accessing `action.bpm` outside the `transport/set_bpm` case is a compile error, not a runtime bug. The `type` field is a `string` literal, not an enum — this avoids the import overhead of an enum while keeping IDE autocomplete. The namespace prefix (`transport/`, `track/`) groups related actions visually and prevents collision.

**Reducer skeleton:**

```typescript
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'transport/set_bpm':
      return { ...state, transport: { ...state.transport, bpm: action.bpm } }
    case 'track/add': {
      const id = generateTrackId()
      return {
        ...state,
        tracks: {
          ...state.tracks,
          byId: { ...state.tracks.byId, [id]: createEmptyTrackState(id) },
          ids: [...state.tracks.ids, id],
        },
      }
    }
    case 'track/remove': {
      if (state.tracks.ids.length <= 1) return state  // enforce min 1
      const { [action.trackId]: _, ...remaining } = state.tracks.byId
      return {
        ...state,
        tracks: {
          byId: remaining,
          ids: state.tracks.ids.filter((id) => id !== action.trackId),
        },
        selectedTrackId:
          state.selectedTrackId === action.trackId
            ? (state.tracks.ids.find((id) => id !== action.trackId) ?? '')
            : state.selectedTrackId,
      }
    }
    default:
      return state
  }
}
```

**Note on `default`:** The `default: return state` case prevents TypeScript from requiring explicit handling of every action type when the reducer evolves. This is intentional for a growing action set. If you want exhaustiveness enforcement later, remove `default` and TypeScript will error on unhandled cases.

---

### 3. State Shape for Dynamic Track Lists

**Pattern:** Normalized tracks: `byId` map + `ids` order array. Not a flat array.

```typescript
// src/state/appState.ts

export interface TrackState {
  trackId: string
  displayName: string
  trackStripId: string      // links to engine module; populated on 'track/add'
  isRecArmed: boolean
  // NOTE: volumeDb and isMuted are NOT here.
  // They are audio engine state, read from engine on render, not stored in reducer.
}

export interface TracksState {
  byId: Record<string, TrackState>
  ids: string[]             // ordered for rendering; separate from lookup
}

export interface TransportState {
  playbackState: 'playing' | 'paused' | 'stopped'
  bpm: number
  loop: boolean
}

export interface AppState {
  transport: TransportState
  tracks: TracksState
  selectedTrackId: string
}
```

**Why normalized:** `.find()` on arrays is O(n) per action dispatch — the current bug in App.tsx where `uiRuntime.trackZoneModel.tracks.find(...)` is called inside every action handler. With `byId`, track lookup is O(1). The `ids` array preserves render order without a sort on every render.

**Why volumeDb and isMuted are NOT in reducer state:** These values live in the audio engine (the `TrackStripGraph`). The engine is the source of truth for audio parameters. Storing them in the reducer creates a two-source-of-truth bug: the reducer copy and the engine copy can drift. Instead, UI components read these values from the engine facade via a per-track hook or directly from the hook returned by `engine.getTrackStrip(trackStripId)`. The reducer only stores which tracks exist, their identity, and purely-UI state (rec-arm, selection).

---

### 4. Audio Engine as a Standalone Singleton

**Pattern:** Module-level variable initialized outside React. Context provides read-only access. React never owns lifecycle.

```typescript
// src/engine/engineSingleton.ts

import { createAudioEngine } from './audioEngine'
import { DEFAULT_AUDIO_GRAPH_PLAN, DEFAULT_AUDIO_MODULE_FACTORY_MAP } from './audioGraphPlan'
import type { AudioEngine } from './audioEngine'

let _engine: AudioEngine | null = null

export function getEngine(): AudioEngine {
  if (!_engine) {
    _engine = createAudioEngine(DEFAULT_AUDIO_GRAPH_PLAN, DEFAULT_AUDIO_MODULE_FACTORY_MAP)
  }
  return _engine
}

// Called at app teardown (e.g., test cleanup), not by React
export function disposeEngine(): void {
  _engine?.dispose()
  _engine = null
}
```

```typescript
// src/state/EngineContext.tsx

const EngineContext = createContext<AudioEngine | null>(null)

export function EngineProvider({ children }: { children: React.ReactNode }) {
  // getEngine() is idempotent — safe to call on every render, only creates once
  const engine = getEngine()
  return <EngineContext value={engine}>{children}</EngineContext>
}

export function useEngine(): AudioEngine {
  const ctx = useContext(EngineContext)
  if (!ctx) throw new Error('useEngine must be inside EngineProvider')
  return ctx
}
```

**Why module-level, not useRef:** The current `useAudioEngine` hook creates the engine inside `useEffect` and disposes it on cleanup. In React 19 StrictMode development, `useEffect` runs twice (setup → cleanup → setup), so the engine is created, disposed, and created again. This is correct behavior for effects but wrong for a singleton audio engine whose AudioContext should survive. A module-level variable is initialized once per module load and is immune to StrictMode double invocation.

**Why not `useRef` with null check:** The React docs recommend lazy `useRef` initialization for per-component singletons. But the audio engine is global — shared across all component instances. `useRef` is per-component-instance, not per-app. Module-level is the right scope.

**StrictMode safety:** In development, React double-invokes component bodies and effects but not module-level code. `getEngine()` with a null check is called harmlessly on both invocations, returning the same instance.

**Dispose strategy:** `disposeEngine()` is not called by React at all. It should be called in test `afterEach` hooks (when tests need a fresh engine) and in `main.tsx` `beforeunload` if desired. This is a deliberate tradeoff: the engine lives for the duration of the page session.

---

### 5. Dynamic Track Add/Remove: Engine Side Effects in Dispatch Middleware

**Problem:** `dispatch({ type: 'track/add' })` must also create a new `TrackStripGraph` in the engine and wire it into the audio graph. Reducers must be pure and cannot have side effects. Where do audio side effects go?

**Pattern:** Thin side-effect layer wrapping dispatch.

```typescript
// src/state/useAppActions.ts

export function useAppActions() {
  const dispatch = useAppDispatch()
  const engine = useEngine()

  return useMemo(() => ({
    addTrack() {
      const trackStripId = generateTrackStripId()
      // Audio side effect happens before dispatch so the engine is ready
      // before the reducer-derived render reads from it
      engine.addTrackStrip(trackStripId)
      dispatch({ type: 'track/add', trackStripId })
    },
    removeTrack(trackId: string, trackStripId: string) {
      dispatch({ type: 'track/remove', trackId })
      // Dispose after dispatch so the old render cycle finishes first
      engine.removeTrackStrip(trackStripId)
    },
    setTrackMute(trackId: string, trackStripId: string, muted: boolean) {
      engine.getTrackStrip(trackStripId).setTrackMuted(muted)
      // No dispatch needed — isMuted is engine state, not reducer state
    },
    setTrackVolume(trackId: string, trackStripId: string, db: number) {
      engine.getTrackStrip(trackStripId).setTrackVolume(db)
      // No dispatch needed — volumeDb is engine state, not reducer state
    },
    // ... transport, selection actions
  }), [dispatch, engine])
}
```

**Why this is cleaner than the current App.tsx pattern:** Currently, `trackZoneActions.setTrackMute` does a `.find()` to locate the runtime track, then branches on `trackStripId === APP_TRACK_STRIP_ID`. The `useAppActions` hook encodes the same logic, but receives `trackStripId` as a parameter (not searched by ID at call time), eliminating the `.find()` per action.

**Why `useMemo`:** The actions object must be stable to avoid re-creating child closures on every render. `dispatch` is stable by React contract; `engine` is stable from context (same module-level instance). The memoized object will never change after mount.

---

### 6. React 19 useReducer TypeScript Type Pattern

**Pattern:** Annotate the reducer function directly rather than passing type parameters to `useReducer`.

```typescript
// This is the React 19 recommended approach
function appReducer(state: AppState, action: AppAction): AppState {
  // ...
}

// Usage — no type arguments needed; contextual typing infers correctly
const [state, dispatch] = useReducer(appReducer, initialAppState)
```

**Why:** React 19 changed `useReducer` type signatures. The old pattern `useReducer<React.Reducer<State, Action>>(reducer)` no longer compiles. Annotating the reducer function directly is the simplest approach that works across React 18 and 19.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| Module-level engine singleton | `useAudioEngine` hook (current approach) | Only if the engine truly needs to be scoped to a component subtree (it does not for this app) |
| Split state + dispatch contexts | Single combined context `{ state, dispatch }` | If performance re-renders are not a concern and you want a simpler setup; acceptable for small apps |
| Normalized `byId` + `ids` tracks | Flat array of track objects | Only if track count is always tiny (< 5) and `.find()` cost is irrelevant; wrong default for any CRUD list |
| Audio volume/mute in engine only | Duplicate audio params in reducer state | Never recommended — creates two-source-of-truth bugs between React state and audio node state |
| `useAppActions` dispatch wrapper | Raw `dispatch` in component event handlers | Only if the app has no audio side effects on state changes |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Zustand | Adds dependency for functionality that useReducer + Context covers adequately; PROJECT.md explicitly defers this | useReducer + Context (built-in) |
| Redux Toolkit | Overkill for a single-user demo app; adds significant bundle weight and boilerplate | useReducer + Context (built-in) |
| Jotai / Recoil | Atom model is appropriate for fine-grained subscriptions at scale, not for a DAW with ~5 top-level state slices | useReducer + Context (built-in) |
| `useReducer<React.Reducer<S,A>>(reducer)` type pattern | Removed in React 19; already on React 19 | Annotate reducer function parameters directly |
| Storing `volumeDb` / `isMuted` in reducer state | Creates drift between React state and engine audio node state; double source of truth | Read from engine facade hooks (`engine.getTrackStrip(id).trackVolume`) |
| `useEffect` for engine creation | StrictMode double-invocation creates/disposes/creates engine in development; destroys AudioContext state | Module-level lazy singleton (`getEngine()`) |
| `useRef` null-guard for engine singleton | `useRef` is per-component-instance; engine is per-app | Module-level variable scoped to `engineSingleton.ts` |
| Immer for this state shape | State shape recommended above is shallow enough that spread operators are readable; Immer adds dependency without payoff | Plain spread in reducer cases |

---

## Stack Patterns by Variant

### If `buildUiRuntime` is kept (low risk, preserve existing runtime build)

Keep `buildUiRuntime` but call it only when `selectedTrackId` changes, not on every render. Memoize the result:

```typescript
const uiRuntime = useMemo(
  () => buildUiRuntime({ uiPlan, midiClipStore, audioEngine: engine, selectedTrackId }),
  [selectedTrackId]  // only recompute on selection change
)
```

This is a safe incremental step before full reducer migration.

### If `buildUiRuntime` is replaced by reducer state (cleaner, higher effort)

The `UiPlan` + `buildUiRuntime` abstraction becomes the reducer's initial state shape. `DEFAULT_UI_PLAN` seeds the `TracksState` at startup. Add/remove track actions extend/contract the same structure. No separate plan resolution pass needed at render time.

### Engine `addTrackStrip` capability needed for track CRUD

The current `AudioEngine` interface does not expose `addTrackStrip` or `removeTrackStrip`. These methods must be added to `AudioEngine` for dynamic track support. This is an engine-side milestone, not a React-side pattern, but it is a prerequisite for the `useAppActions.addTrack()` pattern above.

---

## Version Compatibility

| Concern | Notes |
|---------|-------|
| React 19 Context syntax | `<Ctx value={...}>` (no `.Provider`) is new in React 19; this project is already on React 19 so use the new syntax |
| React 19 useReducer types | Annotate reducer function directly, not via `useReducer<React.Reducer<S,A>>` |
| StrictMode double invocation | Module-level singleton is immune; `useEffect`-based engine creation is not |
| Tone.js AudioContext | Tone.js creates its own `AudioContext` via `Tone.getContext().rawContext`. The module-level engine singleton preserves this context across StrictMode double mounts. |

---

## Sources

- [React docs: Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context) — Official split-context pattern (HIGH confidence)
- [React docs: Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer) — Reducer purity rules, `useImmerReducer` documentation (HIGH confidence)
- [React docs: useReducer](https://react.dev/reference/react/useReducer) — TypeScript inference patterns for React 19 (HIGH confidence)
- [React docs: StrictMode](https://react.dev/reference/react/StrictMode) — Double-invocation behavior, lazy useRef pattern (HIGH confidence)
- [React docs: useRef — lazy initialization](https://react.dev/reference/react/useRef) — Null-guard pattern for avoiding re-creation, StrictMode caveat (HIGH confidence)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) — useReducer type changes, Context.Provider deprecation (HIGH confidence)
- [Kent C. Dodds: How to use React Context effectively](https://kentcdodds.com/blog/how-to-use-react-context-effectively) — Single vs split context tradeoffs, stable dispatch reference (MEDIUM confidence, consistent with official docs)
- [OneUptime: React Context Performance](https://oneuptime.com/blog/post/2026-01-24-react-context-performance-issues/view) — Split context performance rationale (MEDIUM confidence, 2026)
