# Pitfalls Research

**Domain:** React DAW refactoring (useState/prop-drilling → useReducer/Context + engine singleton + dynamic tracks)
**Researched:** 2026-03-12
**Confidence:** HIGH — findings derived from direct codebase analysis + verified against React docs, Web Audio API spec, Tone.js wiki

---

## Critical Pitfalls

### Pitfall 1: Reducer Invokes Audio Engine Side Effects Directly

**What goes wrong:** A developer writes a case in the reducer that calls `audioEngine.getTrackStrip(id).setTrackMuted(true)` or `audioEngine.dispose()` directly inside the reducer function. This works in development (sometimes) but causes double-execution bugs in React StrictMode — the reducer is called twice and the audio engine mutation fires twice. In Strict Mode, the second call's result is used but both engine mutations execute, leaving the engine in a wrong state (double-muted, double-disposed, stuck notes).

**Why it happens:** Reducer functions feel like the natural place to "handle" an action end-to-end. The pattern `dispatch({ type: 'MUTE_TRACK' })` → reducer → audio mutation looks clean but violates the purity contract. React explicitly documents that reducers are called twice in dev to detect impurities (react.dev/reference/react/useReducer).

**How to avoid:**
- Reducer only updates `{ tracks, selectedTrackId, ... }` shape — pure data, no engine calls.
- Audio engine mutations happen in a `useEffect` that reacts to state changes, or in event handler callbacks that call both `dispatch(...)` and `engine.method(...)` in sequence.
- Pattern: `onClick = () => { dispatch({ type: 'MUTE_TRACK', trackId }); engine.getTrackStrip(id).setTrackMuted(true); }` — dispatch and engine mutation are siblings, not nested.
- Do NOT route engine mutations through a middleware-style dispatch wrapper unless it is explicitly outside the reducer.

**Warning signs:**
- Stuck/doubled notes when muting during playback in dev
- Audio glitch on first interaction that goes away when StrictMode is removed
- Console shows "reducer called twice" effects (notes playing double in dev)

**Phase to address:** Phase building the reducer shape — establish the boundary rule before writing any cases.

---

### Pitfall 2: The `buildUiRuntime` Call Pattern Survives Into Context and Causes Full-Tree Re-renders on Every Audio Frame

**What goes wrong:** `buildUiRuntime(...)` is currently called unconditionally inside `AppWithEngine` on every render (no memoization). This is acceptable today when the tree is shallow. After introducing Context, if the result of `buildUiRuntime` is placed in Context value directly, every subscriber re-renders on every parent state change — including the 60fps playhead RAF loop via `playbackState`, the `currentStep` state updates (8 times per loop iteration), and `bpm`. The entire device panel and all track rows churn every step tick.

**Why it happens:** `buildUiRuntime` returns new object references on every call. Context compares value by reference. Even if the underlying audio modules haven't changed, a new `{ trackZoneModel, devicePanelModel }` object triggers all consumers.

**How to avoid:**
- Split contexts: separate `TrackListContext` (track metadata, rarely changes) from `TransportContext` (playhead, step, playbackState — changes frequently).
- `useMemo` the `buildUiRuntime` output, keyed on `[selectedTrackId, uiPlan, audioEngine]` — not on transport state.
- Transport position/step should flow through a ref (`useRef`) or a dedicated subscribe mechanism (the existing `MeterSource.subscribe` pattern), never through Context.
- VU meters already use the subscribe pattern correctly — follow it for playhead too.

**Warning signs:**
- React DevTools Profiler shows `DevicePanel` and all track rows re-rendering at 60fps
- Sluggish parameter knob response (every Knob re-renders 8x per second)
- CPU spikes at playback start that disappear when stopped

**Phase to address:** Phase introducing Context — design context shape before writing Provider.

---

### Pitfall 3: Engine Singleton Disposed and Recreated on React StrictMode Double-Mount

**What goes wrong:** `useAudioEngine` uses `useEffect` with `[]` deps. In React 18 StrictMode, effects are mounted, cleaned up (engine disposed), then mounted again. A second `createAudioEngine` call succeeds, but any Tone.js `Part` instances scheduled on the first mount's `Tone.getTransport()` are cancelled. If `createTransportCore` (R4 bug) still holds a reference to the first-mount's sequencer clip, it continues scheduling on the disposed engine's nodes. The symptom: silence with no errors, or intermittent audio on the first user interaction.

**Why it happens:** `Tone.getTransport()` is a global singleton (not bound to any particular AudioContext). A `Tone.Part` created in the first-mount cycle is cancelled by `part.cancel(0)` during dispose, but `coreRef.current` in `useTransportController` may hold a stale `Sequencer` from that first cycle — because `coreRef` is initialized with `if (!coreRef.current)`, meaning the second mount reuses the stale ref.

**How to avoid:**
- The `if (!coreRef.current)` guard must be cleared on cleanup: pair every `useRef` lazy-init with a cleanup that sets the ref to `null`.
- `useAudioEngine` should expose a stable identity object (returned from `useState`, not a `useRef`) so that downstream `useEffect` deps correctly trigger re-initialization when the engine is replaced.
- Test with StrictMode enabled throughout development — do not disable StrictMode to fix this.

**Warning signs:**
- Audio silent on first page load but works after hard-refresh
- Dev console shows `[audio-engine] unknown module id` thrown during second mount cycle
- `Tone.getTransport().state` is `'started'` but no notes play

**Phase to address:** Phase introducing `useAudioEngine` stabilization — before wiring Context.

---

### Pitfall 4: Sequencer Clip Captured Once at Core Creation (R4 — Existing Bug Made Worse)

**What goes wrong:** `createTransportCore` calls `createSequencer(...)` at construction time, which calls `resolveSequencerClip(clipInput)` immediately. The clip data is baked into the `Tone.Part` event array at construction. When dynamic tracks are added — each with their own clip — there is no way to swap the clip on an existing sequencer without tearing it down and recreating it. With the refactor adding per-track sequencer instances, if the approach mirrors the current single-track pattern, every "edit clip" or "change track" operation will silently replay the old clip.

**Why it happens:** `Tone.Part` is constructed with its event list upfront. The current architecture creates one Part per sequencer instance at boot. This was fine for one static track but becomes incorrect when tracks are dynamic.

**How to avoid:**
- Each track sequencer must support a `setClip(newClip)` method that stops the current Part, reconstructs with new events, and restarts if transport was playing.
- Alternatively, use `part.clear()` + `part.add(...)` for each new event (Tone.Part supports dynamic event mutation after construction) but test carefully — `part.cancel(0)` may be needed to flush pending scheduled events.
- Do NOT pass `clipInput` as a constructor parameter to a long-lived sequencer. Accept it as a mutable dependency.

**Warning signs:**
- Changing which clip a track plays has no audible effect until page reload
- New tracks added during playback play the default clip regardless of what was assigned
- `resolveSequencerClip` is only called once per sequencer lifetime

**Phase to address:** Phase adding per-track sequencer — design the `setClip` API before wiring track management.

---

### Pitfall 5: Tone.js Global Transport Is Shared — One Sequencer's Stop Halts All Tracks

**What goes wrong:** `Tone.getTransport()` is a process-wide singleton in Tone.js. All `Tone.Part` instances in the app are scheduled against this one transport. Calling `transport.stop()` from one track's sequencer stops the global transport, silencing all other tracks simultaneously. With dynamic tracks, the natural instinct is to create one sequencer per track, each managing its own start/stop. If any of them calls `Tone.getTransport().stop()`, every other track stops.

**Why it happens:** Tone.js was designed around one transport. The Tone.js maintainers explicitly declined to support multiple Transport instances (GitHub issue #108: "there can only be one Transport and one timeline"). The current code correctly delegates to a single `TransportService` — but this design must be preserved and not accidentally broken when sequencers are created per-track.

**How to avoid:**
- The single `TransportService` (or its equivalent after refactor) must remain the sole caller of `Tone.getTransport().start()` / `.stop()` / `.pause()`.
- Per-track sequencers own their `Tone.Part` lifecycle (start/stop the Part) but NEVER call `Tone.getTransport().stop()`.
- A per-track sequencer's `stop()` method should call `part.stop(0)` and `part.cancel(0)` only — not `transport.stop()`.
- Expose a `TransportController` singleton at app level that all tracks subscribe to.

**Warning signs:**
- Muting or disabling one track stops all audio
- Removing a track row from the UI causes all sequencers to stop
- Tests that call `seq.stop()` on a per-track sequencer find that other tracks have also stopped

**Phase to address:** Phase designing per-track sequencer — establish the stop/start ownership contract first.

---

### Pitfall 6: APP_* Module ID Constants Break When the Audio Graph Plan Changes (R1 — Hardcoded ID Assumption)

**What goes wrong:** `APP_SYNTH_MODULE_ID`, `APP_PANNER_MODULE_ID`, etc. are computed at module-load time by scanning `DEFAULT_UI_PLAN.tracks[0]`. After refactor, if a second track is added with a different synth module ID, these constants still point to the first track's modules. Any code that uses `APP_SYNTH_MODULE_ID` to look up an engine module for an arbitrary track will resolve the wrong module, silently applying the first track's synth parameters to the newly selected track.

**Why it happens:** The constants were introduced as a convenience for a single-track world. They don't encode "the selected track's synth" — they encode "the first-track's synth at boot time." This is correct only when there is exactly one track.

**How to avoid:**
- Remove all `APP_*` constants as R1 prescribes. Do this before adding any track CRUD.
- Module lookups must always flow through the runtime model (`uiRuntime.devicePanelModel.devices`) keyed on the currently selected track, not on boot-time constants.
- After removal, there should be no string literals like `'synth'` or `'track-strip'` in App.tsx — only IDs sourced from the plan/runtime at render time.

**Warning signs:**
- Selecting Track 2 opens its device panel but parameter changes affect Track 1's audio
- Adding a track causes the original track's controls to stop working
- `audioEngine.getSynth(APP_SYNTH_MODULE_ID)` throws `[audio-engine] unknown module id` for a non-default plan

**Phase to address:** First phase — must be resolved before any other work.

---

### Pitfall 7: Track Actions Use Runtime `.find()` with Stale UI Path (R2 — Existing Bug)

**What goes wrong:** `setTrackMute` and `setTrackVolume` in App.tsx call `uiRuntime.trackZoneModel.tracks.find((track) => track.trackId === trackId)` at action time. But `uiRuntime` is recomputed each render via `buildUiRuntime(...)` — it is not stable between renders. In a reducer/Context architecture, if the dispatch triggers a render but the Context value hasn't propagated yet, the closure inside the action handler may reference a stale `uiRuntime` from a previous render cycle. Mute actions on non-primary tracks thus call `runtimeTrack.trackStrip.setTrackMuted(muted)` on a stale facade object.

**Why it happens:** Action handlers are created inside the component body and capture `uiRuntime` by closure. If action handlers are memoized with `useCallback` while `uiRuntime` is a dep that changes every render (due to new object references from `buildUiRuntime`), you either get stale closures or no memoization benefit.

**How to avoid:**
- Build per-track action handlers once during model assembly, as R2 recommends.
- Pattern: for each track in the plan, construct `{ trackId, setMuted: (v) => engine.getTrackStrip(trackStripId).setTrackMuted(v) }`. These closures capture stable `trackStripId` strings and `engine` (the singleton), not the runtime model.
- Action handler construction must depend on `[audioEngine, uiPlan]` only — not on `selectedTrackId` or transport state.

**Warning signs:**
- Muting Track 2 sometimes mutes Track 1 instead
- Volume changes on non-primary tracks have no effect
- React DevTools shows action handlers being recreated every render

**Phase to address:** Same phase as R1 removal — must be done together.

---

### Pitfall 8: MIDI Keyboard Enablement Stays Tied to a Single Static Track ID (R3)

**What goes wrong:** `MidiKeyboard` receives `enabled={trackRecByTrackId[INITIAL_TRACK_ID] ?? false}`. After adding dynamic tracks, the keyboard is permanently bound to the boot-time track ID. Recording into Track 2 is impossible even if the user rec-arms it, because the MIDI keyboard checks the wrong ID. This is a UX breakage that is invisible in tests unless the test explicitly arm-enables a non-first track.

**Why it happens:** `INITIAL_TRACK_ID` is a module-level constant (evaluated once). It is used to both initialize the `trackRecByTrackId` state and to compute keyboard enablement. These are two separate concerns that happen to use the same constant, making refactoring easy to miss.

**How to avoid:**
- Keyboard enablement should be computed from `trackRecByTrackId[trackSelection.selectedTrack]` or from an explicit policy ("any armed regular track").
- If the product intent is "keyboard always follows selection," compute `enabled` from `selectedTrackId` + `trackRecByTrackId[selectedTrackId]`.
- Remove `INITIAL_TRACK_ID` usage from keyboard enablement entirely — it serves no purpose once selection is dynamic.

**Warning signs:**
- User rec-arms Track 2 and presses MIDI keys but no sound from Track 2
- The keyboard LED stays off even for a newly armed track
- Test for rec-arm of second track passes (state updates correctly) but keyboard note events fire into Track 1

**Phase to address:** Phase that introduces track selection as dynamic state.

---

### Pitfall 9: `buildUiRuntime` Eagerly Resolves All Tracks on Every Render (A2 — Performance + Error Blast Radius)

**What goes wrong:** With five tracks, `buildUiRuntime` resolves five `audioEngine.getTrackStrip(id)` + five `getDeviceRegistryEntry(kind).resolveModule(engine, moduleId)` calls per render. If one track has an invalid `trackStripId` (say, a newly added track whose engine module hasn't finished initializing), `buildUiRuntime` throws and the entire UI fails to render — not just that track. The current code has exactly this blast radius: one bad track ID crashes the whole app.

**Why it happens:** `resolveRegularTrackRuntime` calls `audioEngine.getTrackStrip(track.trackStripId)` which throws on unknown IDs. There is no try/catch and no lazy evaluation.

**How to avoid:**
- Resolve track list metadata (IDs, display names) eagerly for rendering the track list.
- Resolve device modules lazily — only for the selected track (as A2 prescribes).
- Wrapping per-track resolution in a try/catch and returning a degraded track model (visible error state, not a crash) is better than letting one bad track ID crash the UI.
- Add dynamic tracks to the engine BEFORE updating the plan that `buildUiRuntime` reads.

**Warning signs:**
- Adding a track causes a white screen
- Deleting a track throws `[audio-engine] unknown module id` because the plan and engine are updated out of order
- Any engine error during track initialization kills the entire render

**Phase to address:** Phase introducing track CRUD.

---

### Pitfall 10: VU Meter `MeterSource` Identity Instability After Reducer Refactor

**What goes wrong:** `VUMeter` subscribes to `meterSource` inside a `useEffect([meterSource])`. If the refactor causes a new `meterSource` reference to be produced every render (because the facade object is reconstructed on each `buildUiRuntime` call or because the hook that wraps `TrackStripHook` returns a new reference), `VUMeter` unsubscribes and re-subscribes on every render. At 60fps with step callbacks, this means 8+ subscription teardowns and recreations per second. Animated meters stutter or freeze.

**Why it happens:** The current `trackStripFacade` in `audioEngine.ts` is created once and is stable. After a reducer refactor, if someone wraps the facade in a new object each render (`{ ...trackStripFacade }`) or if the Context recomputation reconstructs hooks, a new reference is produced.

**How to avoid:**
- `MeterSource` references must be structurally stable across renders — same object identity for the same track strip.
- The engine's `trackStripFacade.meterSource` is already stable (created once in `createAudioEngine`). Preserve this — never spread-copy the facade.
- In Context, provide `meterSource` as a value sourced directly from `engine.getTrackStrip(id).meterSource` using a stable `useMemo([engine, trackStripId])`.

**Warning signs:**
- VU meters freeze or flicker after any reducer action
- React DevTools shows `VUMeter` remounting on every dispatch
- `meterSource.subscribe` is called more than once per second without transport running

**Phase to address:** Phase stabilizing the engine facade layer — before integrating meters into Context.

---

### Pitfall 11: `deviceRegistry.ts` `isDeviceModuleKind` Uses `in` Operator (R5 — Prototype Pollution Risk)

**What goes wrong:** `moduleKind in DEVICE_REGISTRY` returns `true` for any property that exists on `Object.prototype` (e.g., `'toString'`, `'constructor'`). If an external clip plan or serialized project file contains a device with `moduleKind: 'constructor'`, `getDeviceRegistryEntry` will not throw — it will return `DEVICE_REGISTRY['constructor']`, which is undefined, producing a cryptic `Cannot read properties of undefined` deeper in the stack.

**Why it happens:** Standard `in` operator checks prototype chain. For registry lookups using string keys from external/user data, `Object.hasOwn` is required.

**How to avoid:**
- Replace `moduleKind in DEVICE_REGISTRY` with `Object.hasOwn(DEVICE_REGISTRY, moduleKind)` as R5 prescribes.
- Apply the same fix to `createAudioEngine` where `!(node.kind in factoryMap)` is used.
- Use `Object.hasOwn` consistently for all string-keyed registry/map lookups.

**Warning signs:**
- App crashes with `Cannot read properties of undefined (reading 'render')` when loading a custom plan
- TypeScript does not catch this — the `in` operator is type-safe for the known keys but doesn't guard against prototype keys

**Phase to address:** Phase adding fail-fast validation hardening (low risk, low effort, do early).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `buildUiRuntime` called unconditionally in render | No memoization complexity | Full-tree re-render on every transport tick; grows worse with each added track | Acceptable only until Context is introduced |
| Action handlers inline in App.tsx closing over `uiRuntime` | Simple to write | Stale closure bugs on non-primary tracks; worsens with more tracks | Only acceptable with single-track prototype |
| Per-module APP_* constants | Readable references | Breaks as soon as plan shape changes; silent wrong-module bugs | Acceptable only with exactly one plan shape forever |
| Single `useState<Record<string, boolean>>` for rec-arm per track | Trivial to add tracks | Doesn't compose with reducer; keyboard enablement stays static | Fine for single-track but not after reducer migration |
| Eager `resolveRegularTrackRuntime` for all tracks | Simpler code path | One invalid track crashes full render; scales poorly | Fine with one or two known-valid tracks |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Context value includes transport step/position | All consumers re-render 8x per loop cycle | Keep step/position in refs or dedicated subscription; never in Context value | As soon as any component subscribes to the Context |
| `buildUiRuntime` result in Context value (new refs every call) | Device panel and all tracks re-render on every `selectedTrackId` change or bpm change | Memoize `buildUiRuntime` result on stable deps; split stable data from volatile | At 3+ tracks with per-track meter views |
| VU meter subscription to unstable `meterSource` reference | Meter flickers or reads zero | Memoize `meterSource` on `[engine, trackStripId]`; verify object identity is stable | On any dispatch that reconstructs wrapper objects |
| Per-track RAF loop for playhead per track | CPU scales linearly with track count | One RAF loop at app level; distribute position to all tracks via callback or ref | With 4+ tracks open simultaneously |
| `resolveClipLayout` called inside render for every track row | Recalculates pixel geometry on every render pass | Memoize on `[clip, bpm]` | With 8+ clips visible simultaneously |
| Tone.js Transport DOM updates in the Part callback | Audio thread and render thread contend; visual glitch or audio jank | Use `Tone.Draw` for any visual update triggered from audio callback | Immediately — even with one track |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Deleting a track while it's playing leaves stuck notes | Notes sustain forever with no way to stop them | Before removing a track, call `synth.panic()` on that track's synth; stop the track's Part |
| Adding a track during playback causes brief silence | Jarring; destroys the illusion of a professional tool | Pre-initialize the new track's audio graph nodes in a suspended state, connect, then schedule start on next transport beat boundary |
| MIDI keyboard stops working after track selection changes | User selects a new track, presses keys, nothing happens | Keyboard enablement must follow selection + rec-arm state, not be pinned to a boot-time ID |
| Removing the only track leaves the engine in an indeterminate state | Transport shows "playing" but there is nothing to play; user can't stop audio | Enforce a minimum of one track at all times, or implement a "no active tracks" empty state that stops transport |
| Track rec-arm is a boolean in a `Record<string, boolean>` that persists across track deletion | Deleted track's ID accumulates in the record; potential memory leak in long sessions | Clean up rec-arm state on track removal |
| VU meter assigned to a removed track's MeterSource | `meterSource` subscription fires after track deletion; potential error or ghost meter | Null-guard `meterSource` on track removal; unsubscribe is handled by VUMeter's cleanup but the prop reference must be cleared |

---

## "Looks Done But Isn't" Checklist

- [ ] Muting Track 1 while Track 2 is playing does not stop Track 2
- [ ] Removing Track 1 while Track 2 is playing continues Track 2 playback uninterrupted
- [ ] MIDI keyboard fires notes into the currently selected rec-armed track, not a hardcoded track
- [ ] Adding a new track and selecting it shows its devices in the device panel, not Track 1's devices
- [ ] Transport `stop()` calls `panic()` on ALL active track synths, not just the primary synth
- [ ] Reducer dispatch of `MUTE_TRACK` does not produce double-mute in StrictMode dev
- [ ] `buildUiRuntime` with a 3-track plan does not render `APP_SYNTH_MODULE_ID` in the console (those constants are gone)
- [ ] VU meters continue animating after a second track is added (no re-subscription storm)
- [ ] A track with an unresolvable `trackStripId` shows an error state, not a white screen
- [ ] `isDeviceModuleKind('constructor')` returns `false`
- [ ] Deleting a track and re-adding it with the same display name works correctly (no ID collision)
- [ ] Transport position/step does NOT appear in any React Context value (verified via DevTools Profiler)
- [ ] Per-track action handlers do NOT close over `uiRuntime` (they close over stable engine + ID strings)

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-----------------|--------------|
| P1: Reducer invokes engine side effects | Phase: Define reducer shape and boundary contract | Test: Run reducer in isolation (no engine) — reducer must not import audioEngine |
| P2: `buildUiRuntime` causes full-tree re-renders | Phase: Design Context shape before writing Provider | Verify: React DevTools Profiler shows DevicePanel not re-rendering during playback |
| P3: Engine disposal/recreation in StrictMode | Phase: Stabilize `useAudioEngine` lifecycle | Test: With StrictMode on, audio works correctly on first interaction |
| P4: Sequencer clip baked in at construction (R4) | Phase: Per-track sequencer design | Test: `setClip` on a running sequencer plays the new clip within one loop cycle |
| P5: Global Transport stop halts all tracks | Phase: Per-track sequencer design | Test: Per-track sequencer `stop()` does not call `Tone.getTransport().stop()` |
| P6: APP_* constants break with plan changes (R1) | Phase 1 — before any other changes | Test: Delete constants; all tests still pass with IDs sourced from runtime |
| P7: Action handlers close over stale `uiRuntime` (R2) | Phase 1 — same phase as R1 | Test: Mute action on track N updates track N's strip, not track 1's |
| P8: MIDI keyboard pinned to INITIAL_TRACK_ID (R3) | Phase: Track selection becomes dynamic | Test: Rec-arm Track 2, press MIDI keys → Track 2 synth fires |
| P9: Eager track resolution — one bad ID crashes UI (A2) | Phase: Track CRUD introduction | Test: Adding a track with invalid stripId shows error row, not white screen |
| P10: MeterSource identity instability | Phase: Engine facade stabilization | Test: Dispatch 100 actions — VUMeter subscribe count stays at 1 per meter |
| P11: `in` operator prototype pollution (R5) | First phase — alongside R5 | Test: `isDeviceModuleKind('constructor')` returns false |

---

## Sources

- React docs — `useReducer` purity, StrictMode double-invocation, Context re-render behavior: [react.dev/reference/react/useReducer](https://react.dev/reference/react/useReducer), [react.dev/reference/react/StrictMode](https://react.dev/reference/react/StrictMode)
- Tone.js Transport singleton limitation (one Transport per app): [github.com/Tonejs/Tone.js/issues/108](https://github.com/Tonejs/Tone.js/issues/108)
- Tone.js Performance wiki (no DOM in transport callbacks, use Tone.Draw): [github.com/Tonejs/Tone.js/wiki/Performance](https://github.com/Tonejs/Tone.js/wiki/Performance)
- Web Audio node lifecycle / GC behavior: [github.com/WebAudio/web-audio-api/issues/904](https://github.com/WebAudio/web-audio-api/issues/904)
- React Context re-render on every value change: [developer way — performant context apps](https://www.developerway.com/posts/how-to-write-performant-react-apps-with-context)
- Stale closures in React hooks: [tkdodo.eu/blog/hooks-dependencies-and-stale-closures](https://tkdodo.eu/blog/hooks-dependencies-and-stale-closures)
- Direct codebase analysis: `src/App.tsx`, `src/engine/audioEngine.ts`, `src/hooks/useTransportController.ts`, `src/hooks/useSequencer.ts`, `src/ui-plan/buildUiRuntime.ts`, `src/ui-plan/deviceRegistry.ts`, `docs/plans/agent_findings_fix_plan_2026-03-12.md`
