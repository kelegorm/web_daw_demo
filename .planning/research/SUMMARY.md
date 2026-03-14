# Project Research Summary

**Project:** Kelegorm DAW
**Domain:** React DAW state architecture + dynamic audio graph
**Researched:** 2026-03-12
**Confidence:** HIGH

## Executive Summary

This milestone is a focused architectural refactor, not a feature expansion. The goal is to replace the current ad-hoc `useState` + prop-drilling pattern in `App.tsx` with a `useReducer` + split Context architecture, move the audio engine to a module-level singleton, and add the minimum engine API surface needed to support dynamic track add/remove. The user's acceptance criterion is precise: the interface behaves identically to today except that Add and Remove track buttons now work. All research agrees this is achievable with zero new runtime dependencies — React 19, TypeScript, and the existing Tone.js/Web Audio stack are sufficient.

The recommended approach is a five-phase build sequence: (1) engine multi-track foundation (add `preLimiterBus`, `createTrackSubgraph`/`removeTrackSubgraph`, `getTrackFacade`, and the module-level singleton), (2) pure reducer + context layer written and unit-tested in isolation, (3) `App.tsx` teardown and replacement with `<DawProvider>`, (4) component-by-component context migration, (5) transport decoupling. This order is driven by hard dependency ordering: every other phase depends on the engine being able to handle N tracks, and the reducer must exist before any component migration starts. The phase split also minimizes regression risk by keeping the existing E2E test suite as the gate at each step.

The two dominant risk categories are (a) React StrictMode interactions — the current `useEffect`-managed engine creates/disposes/creates on double-mount, and reducer cases that call engine methods directly will double-fire mutations — and (b) object identity instability after refactor causing churn in meter subscriptions and context consumers. Both are well-understood and have concrete preventions. The third risk, Tone.js global Transport ownership, must be respected: per-track sequencers must never call `Tone.getTransport().stop()`, only `part.stop()`. Existing transport encapsulation in `TransportService` is the right model and must not be broken during the per-track sequencer expansion.

---

## Key Findings

### Recommended Stack

No new runtime packages are required. The entire milestone is achievable with React 19 built-ins (`useReducer`, `createContext`) and the existing Tone.js/Web Audio stack. The only optional addition is `use-immer` if reducer case bodies for nested track state become unreadable — but the flat normalized state shape recommended below makes this unnecessary for MVP.

**Core technologies:**
- `useReducer` (React 19 built-in): Centralizes all UI state transitions; dispatch is the single write path — replaces ~8 `useState` calls in `App.tsx`
- Split `createContext` (React 19 built-in): Two contexts — `DawStateContext` for reads, `DawDispatchContext` for dispatch — prevents dispatch-only consumers from re-rendering on state changes
- Module-level singleton (`engineSingleton.ts`): Keeps the `AudioEngine` outside the React lifecycle entirely; immune to StrictMode double-mount that currently breaks `useAudioEngine`
- `useAppActions` wrapper: Thin layer that sequences audio side-effects with dispatch; keeps reducer pure while still co-locating action logic
- TypeScript discriminated union actions: Exhaustiveness-checked action type narrowing with zero runtime overhead; namespace prefixes (`transport/`, `track/`) prevent collision

**Key version note:** React 19 changed `useReducer` type signatures. Annotate the reducer function directly (`function appReducer(state: AppState, action: AppAction): AppState`) rather than using the old `useReducer<React.Reducer<S,A>>` form. React 19 Context syntax shortens `<Ctx.Provider value={x}>` to `<Ctx value={x}>`.

### Expected Features

The scope is deliberately narrow. Research confirms this is correct — attempting to add device instantiation, reordering, or persistence in this milestone would require infrastructure that does not exist.

**Must have (table stakes — P0):**
- Reducer + Context for all track UI state — unblocks all CRUD; architectural prerequisite
- Engine as standalone singleton — removes `useEffect` lifecycle risk; prerequisite for reliable dispose
- Add track button — wires a new `TrackStripGraph` into the engine before React re-renders; auto-selects new track
- Remove track button (per-track, with `dispose()`) — audio nodes released immediately; reducer atomically corrects selection
- Minimum track guard (1 track) — remove button disabled when count is 1; prevents indeterminate engine state
- Selection correction after remove — reducer picks the previous sibling or first remaining track atomically
- Stable track IDs — counter or UUID-lite generated at add-time; never reused in the session

**Should have (P1 — low effort, include if capacity allows):**
- Disabled (not hidden) remove button at minimum guard — communicates intent more clearly than hiding
- Auto-numbered display names ("Track 1", "Track 2") — cosmetic, zero audio impact

**Defer (v2+):**
- Track reordering (drag-and-drop) — requires re-patching audio connections on reorder; non-trivial topology change
- Per-track device assignment on add — requires device instantiation policy and engine factory extension
- Track rename (inline edit) — adds edit-mode state, blur handlers, keyboard traps
- Undo/redo — requires action history stack, audio node resurrection, snapshot serialization; entire command pattern
- Persistence across sessions — requires serialization, engine rehydration from stored plan

### Architecture Approach

The target architecture has three clearly separated layers with strict unidirectional data flow: (1) the audio engine as a module-level singleton that React never owns, (2) a `DawProvider` that owns `useReducer` and acts as the sole bridge between React actions and engine side-effects, and (3) UI components that read from context and dispatch actions but never reach into the engine directly (except `MidiKeyboard` and `VUMeter`, which use real-time engine paths that must bypass React for latency reasons).

**Major components:**
1. `audioEngineSingleton.ts` (NEW) — `getAudioEngine()` lazy initializer; `resetEngineForTest()` for test teardown; engine lives at module scope, outlives any component mount/unmount
2. `audioEngine.ts` (MODIFIED) — gains `createTrackSubgraph(trackId)`, `removeTrackSubgraph(trackId)`, `getTrackFacade(trackId)`, `TrackFacade` type; adds `preLimiterBus` GainNode as shared sum point for N parallel tracks
3. `src/state/dawReducer.ts` (NEW) — pure `DawState`/`DawAction` + `dawReducer`; no engine imports; fully testable without React
4. `src/state/dawContext.tsx` (NEW) — `DawProvider` owns `useReducer` + engine side-effect bridge; `DawStateContext` and `DawDispatchContext` as separate contexts
5. `App.tsx` (GUTTED) — reduced to `<DawProvider><Layout /></DawProvider>` with all hook calls, constants, and model construction removed
6. `useAppActions` hook — `useMemo`-stabilized action object; sequences engine calls before/after dispatch; the only place where `dispatch` and `engine.method()` appear together

**Critical data flow rule:** Audio parameters (volumeDb, isMuted) that must apply immediately are written to the engine directly from `useAppActions`, not stored in reducer state. Only purely-UI state (track identity, display name, rec-arm, selection, transport playback state) belongs in the reducer. This prevents the two-source-of-truth drift bug between React state and audio node state.

**Signal chain for N tracks:**
```
track1: synth1 → panner1 → trackStrip1 ──┐
track2: synth2 → panner2 → trackStrip2 ──┤──► preLimiterBus → limiter → masterStrip → destination
trackN: synthN → pannerN → trackStripN ──┘
```

### Critical Pitfalls

1. **Reducer invokes engine side effects directly** — React StrictMode double-invokes reducers in dev; any engine mutation inside a reducer case fires twice (double-mute, double-dispose, stuck notes). Prevention: reducer is a pure function with no engine imports. Engine calls happen in `useAppActions` (dispatch + engine call as siblings) or in a `DawProvider` `useEffect` bridge.

2. **Engine disposal/recreation in StrictMode (P3)** — `useAudioEngine` hook creates the engine in `useEffect` with `[]` deps; StrictMode mounts→cleanup→mounts, disposing and recreating the engine. The second mount's `coreRef` lazy-init guard (`if (!coreRef.current)`) retains stale sequencer references, causing silence with no errors. Prevention: move engine to module-level singleton; `if (!coreRef.current)` guards must have paired cleanup that nullifies the ref.

3. **Context value includes transport step/position (P2)** — if `buildUiRuntime` result or transport step state is placed in a Context value, every subscriber re-renders at 8x per loop cycle (60fps playhead). Prevention: keep step/position in refs or the existing `MeterSource.subscribe` pattern; never in Context. Split `TrackListContext` (stable) from `TransportContext` (volatile). VUMeter's existing subscribe pattern is the model to follow.

4. **Tone.js global Transport stop halts all tracks (P5)** — `Tone.getTransport()` is process-wide; a per-track sequencer calling `Tone.getTransport().stop()` silences everything. Prevention: per-track sequencers own their `Tone.Part` lifecycle only (`part.stop(0)`, `part.cancel(0)`); the single `TransportService` is the sole caller of `Tone.getTransport().start()/stop()`.

5. **APP_* module ID constants break with plan changes (P6/R1)** — `APP_SYNTH_MODULE_ID` etc. are computed at module-load time from `DEFAULT_UI_PLAN.tracks[0]`; they point to the first track's modules even when Track 2 is selected. Prevention: remove all `APP_*` constants before any CRUD work; replace with `engine.getTrackFacade(trackId)` keyed by the UI's stable `trackId`. This is the first change that must land.

---

## Implications for Roadmap

### Phase 1: Engine Multi-Track Foundation

**Rationale:** Every other phase depends on the engine being able to manage N track subgraphs. This is the highest-risk structural change (modifying the audio graph composition root) and must be isolated, tested, and stable before any React-side work begins. Also the correct time to remove `APP_*` constants (P6/R1) and fix `Object.hasOwn` registry guard (P11/R5) since they require touching the engine and plan layer anyway.

**Delivers:** `createTrackSubgraph`, `removeTrackSubgraph`, `getTrackFacade`, `TrackFacade` type, `preLimiterBus` GainNode, `audioEngineSingleton.ts`, elimination of `APP_*` constants, hardened `isDeviceModuleKind`

**Addresses:** Table-stakes "Add track (wired)", "Remove track (with dispose)", "Stable track IDs" (structural prerequisites)

**Avoids:** P6 (hardcoded ID constants), P11 (prototype pollution in registry), P9 (eager track resolution — engine must be ready before plan updates it)

**Unit test gate:** `createTrackSubgraph` connects `trackStrip.output` to `preLimiterBus`; `removeTrackSubgraph` disconnects and disposes; `getTrackFacade` returns correct facade per ID; `isDeviceModuleKind('constructor')` returns `false`

---

### Phase 2: Reducer + Context (Pure State Layer)

**Rationale:** The reducer is a pure TypeScript function with no engine imports — it can be written and exhaustively unit-tested before any component is touched. This produces high-confidence test coverage and a stable API surface for Phase 3. Establishing the reducer boundary rule here (no engine calls in reducer) prevents P1 from ever entering the codebase.

**Delivers:** `DawState` type, `DawAction` discriminated union, `dawReducer` pure function, `DawProvider` with engine bridge, `DawStateContext`/`DawDispatchContext`, `useDawState`/`useDawDispatch` hooks, normalized `byId+ids` track state

**Uses:** React 19 `useReducer`, split `createContext` pattern (STACK.md Pattern 1, 2, 3), `useAppActions` wrapper (STACK.md Pattern 5)

**Implements:** `src/state/` directory (dawReducer.ts, dawContext.tsx, useDawState.ts, useDawDispatch.ts)

**Avoids:** P1 (engine calls in reducer), P2 (transport state in Context value — keep step/position out of DawStateContext from day one)

**Unit test gate:** All `dawReducer` cases in isolation — no React, no engine; includes `ADD_TRACK`, `REMOVE_TRACK` with selection correction, minimum guard enforcement

---

### Phase 3: App.tsx Teardown

**Rationale:** `App.tsx` is the most tangled file and the source of R1, R2, A4 debt. Gutting it after the reducer is stable means the replacement is a drop-in. The existing E2E test suite acts as the full regression gate. This phase also deletes `useAudioEngine.ts` (solves P3 StrictMode engine disposal) and `useTrackSelection.ts` (selection now lives in reducer).

**Delivers:** `App.tsx` reduced to `<DawProvider><Layout /></DawProvider>`; deletion of `useAudioEngine.ts` and `useTrackSelection.ts`; engine now managed by module-level singleton exclusively

**Avoids:** P3 (StrictMode engine disposal — `useAudioEngine` is removed entirely), P7 (stale `uiRuntime` closures — `buildUiRuntime` called per `selectedTrackId` change at most, not per render)

**E2E gate:** All existing Playwright tests must pass unchanged

---

### Phase 4: Component Context Migration

**Rationale:** Each component can be migrated independently. The correct order is leaf-to-root: `Toolbar` first (simplest, transport only), then `TrackZone` (track list + CRUD buttons), then `DevicePanel` (selected-track device rack), then `MidiKeyboard` (rec-arm from context + direct engine note calls). `VUMeter` requires no change — it already consumes `MeterSource` via subscribe, not through context.

**Delivers:** All components reading from `DawStateContext`/`DawDispatchContext`; Add/Remove track buttons wired through `useAppActions`; `DevicePanel` switched to discriminated union render; `MidiKeyboard` rec-arm follows `selectedTrackId` from context (fixes P8/R3)

**Addresses:** All P0 features: "Add track button", "Remove track button", "Minimum track guard (disabled button)", "Selection correction after remove", "Device panel updates on track add"

**Avoids:** P8 (MIDI keyboard pinned to `INITIAL_TRACK_ID`), P9 (white-screen on bad track ID — lazy device resolution for selected track only), P10 (MeterSource identity — `meterSource` sourced from `engine.getTrackFacade(id).trackStrip.meterSource`, never reconstructed)

**E2E gate:** Add track → device panel shows new track; Remove track → correct track selected; MIDI keyboard follows rec-arm of selected track

---

### Phase 5: Transport Decoupling + Sequencer Cleanup

**Rationale:** Transport is currently the most coupled subsystem — `useTransportController` receives a `TrackStripHook` dependency (for mute), conflating transport state with track-strip state. This phase isolates transport to own only playback state (playing/paused/stopped, bpm, loop, currentStep). It also addresses the existing R4 bug (sequencer clip baked in at construction) which becomes critical once per-track sequencers are introduced.

**Delivers:** `useTransportController` no longer receives `TrackStripHook`; transport owns playback state only; per-track sequencer `setClip` API; `part.stop(0)`/`part.cancel(0)` correctly scoped (global transport owned solely by `TransportService`)

**Addresses:** P0 "Existing behaviors preserved" — all transport/sequencer E2E tests continue to pass

**Avoids:** P4 (sequencer clip baked at construction — `setClip` allows dynamic clip assignment), P5 (global Transport stop — per-track sequencer `stop()` does not call `Tone.getTransport().stop()`)

**E2E gate:** Transport play/stop/BPM change work identically to pre-refactor; sequencer clip changes take effect within one loop cycle; removing a track during playback does not stop other tracks

---

### Phase Ordering Rationale

- **Engine first (Phase 1 before all others):** `createTrackSubgraph`/`getTrackFacade` are called by `useAppActions` in Phase 4. The engine API must be stable before either the reducer action shape or the component actions reference it. Isolating the audio graph change also means audio regression is caught before any React work starts.

- **Reducer before components (Phase 2 before Phase 3/4):** Components read from context; context requires the reducer to exist. Writing the reducer in isolation means the action union and state shape are locked before any component touches them — prevents churn in component PRs.

- **App.tsx teardown before component migration (Phase 3 before Phase 4):** `App.tsx` currently constructs the models that components consume. Gutting it first eliminates the ambiguity of which prop or context a component should read from during migration.

- **Transport last (Phase 5):** Transport is the subsystem most likely to cause regression in existing tests. Leaving it for last means all other refactors don't accidentally destabilize it, and Phase 5 can be a focused, isolated change.

- **P0 features delivered across Phases 1–4:** No single phase is a feature-only phase; each phase is an architectural enabler that unlocks user-visible behavior by the end of Phase 4.

---

### Research Flags

Phases with well-documented patterns (skip research-phase during planning):
- **Phase 1 (Engine foundation):** GainNode as summing junction, `disconnect()`/`dispose()` lifecycle, dynamic Web Audio graph — all well-documented in MDN. No research phase needed.
- **Phase 2 (Reducer + Context):** Split context, discriminated union actions, normalized state shape — official React docs cover all patterns exhaustively. No research phase needed.
- **Phase 3 (App.tsx teardown):** Mechanical extraction; no novel patterns. No research phase needed.

Phases that may benefit from targeted planning research:
- **Phase 4 (Component migration — DevicePanel):** The `deviceRegistry.ts` discriminated union render switch and lazy-resolution-for-selected-track pattern may benefit from a planning spike to agree on the exact `buildTrackViewModel` API before writing. Low uncertainty, but the interface affects both Phase 4 and Phase 5.
- **Phase 5 (Per-track sequencer + clip API):** `Tone.Part` dynamic event mutation (`part.clear()` + `part.add()` vs teardown/recreate) is documented but has subtle timing edge cases during transport playback. A targeted spike verifying `setClip` behavior during active playback is recommended before committing to the API.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All patterns from official React 19 docs; no third-party library choices required; version compatibility confirmed against installed versions |
| Features | HIGH | Scope is tightly bounded by explicit user acceptance criterion; feature set derived from direct codebase analysis, not speculation |
| Architecture | HIGH | Based on direct inspection of `audioEngine.ts`, `App.tsx`, all hooks, and the existing agent findings plan; all boundary rules traceable to official docs |
| Pitfalls | HIGH | 11 pitfalls derived from codebase analysis + verified against React docs, Tone.js wiki, MDN Web Audio spec; not inferred from general knowledge |

**Overall confidence:** HIGH

### Gaps to Address

- **`buildUiRuntime` replacement scope:** Research recommends either deleting `buildUiRuntime` entirely (cleaner) or reducing it to selected-track device resolution only (safer). The exact replacement API (`buildTrackViewModel` shape) is not locked down. This decision affects Phase 2 (what goes in `DawState`) and Phase 4 (`DevicePanel` props). Resolve during Phase 2 planning before writing `DawState`.

- **Per-track sequencer `setClip` timing:** Research identifies that `part.clear()` + `part.add()` may need `part.cancel(0)` to flush pending events during active playback. The exact sequence is not verified empirically. Verify with a targeted test before Phase 5 implementation.

- **`AudioEngine.addTrackStrip` vs `createTrackSubgraph` naming:** Research uses `createTrackSubgraph` throughout (ARCHITECTURE.md) but STACK.md uses `engine.addTrackStrip`. These describe the same API. Phase 1 should canonicalize the method name on the `AudioEngine` interface before other phases reference it.

- **`buildUiRuntime` memoization as incremental step:** STACK.md notes that memoizing `buildUiRuntime` on `[selectedTrackId]` is a safe incremental step before full reducer migration. Whether to take this intermediate step or go straight to reducer state is a planning decision, not a research gap. Either path is valid.

---

## Sources

### Primary (HIGH confidence)
- [React docs: Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context) — split context pattern, provider consolidation, dispatch stability
- [React docs: useReducer](https://react.dev/reference/react/useReducer) — TypeScript inference patterns for React 19, StrictMode double-invocation, purity contract
- [React docs: StrictMode](https://react.dev/reference/react/StrictMode) — double mount/unmount behavior in development
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) — useReducer type changes, Context.Provider deprecation
- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — GainNode summing junction, dynamic graph connection/disconnection, node lifecycle
- Direct codebase analysis: `src/App.tsx`, `src/engine/audioEngine.ts`, all hooks, `buildUiRuntime.ts`, `deviceRegistry.ts`, `docs/plans/agent_findings_fix_plan_2026-03-12.md`

### Secondary (MEDIUM confidence)
- [Tone.js Transport singleton (GitHub issue #108)](https://github.com/Tonejs/Tone.js/issues/108) — one Transport per app; per-track Part ownership boundary
- [Tone.js Performance wiki](https://github.com/Tonejs/Tone.js/wiki/Performance) — use `Tone.Draw` for visual updates from audio callbacks
- [Kent C. Dodds: How to use React Context effectively](https://kentcdodds.com/blog/how-to-use-react-context-effectively) — split context tradeoffs, stable dispatch reference
- DAW UX conventions for add/remove/minimum guard — derived from Ableton Live, Logic Pro, Reaper patterns (knowledge cutoff August 2025)

### Tertiary (reference only)
- [Web Audio node GC behavior (WebAudio/web-audio-api#904)](https://github.com/WebAudio/web-audio-api/issues/904) — node disconnect does not guarantee GC; dispose pattern
- [React Context re-render behavior](https://www.developerway.com/posts/how-to-write-performant-react-apps-with-context) — per-value-change subscriber re-render; split context prevention

---
*Research completed: 2026-03-12*
*Ready for roadmap: yes*
