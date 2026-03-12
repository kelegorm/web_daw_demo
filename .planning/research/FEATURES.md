# Feature Research

**Domain:** DAW dynamic track management + state architecture
**Researched:** 2026-03-12
**Confidence:** HIGH for scope-bounded behaviors; MEDIUM for DAW-convention references

---

## Context: What Already Exists

The codebase has one regular track ("synth1") and one fixed master track, hardcoded into `DEFAULT_UI_PLAN`. The audio graph is a single fixed chain:

```
synth -> panner -> track-strip -> limiter -> master-strip -> destination
```

Track-level UI state (selection, mute, rec-arm, volume) is currently scattered across `App.tsx` using `useState` and `useRef`. There is no shared reducer or context. The engine itself is created by `useAudioEngine` as a `useEffect`-managed singleton.

The user's stated acceptance criterion: **"the interface works exactly the same as it does now except for the add and remove buttons for the track."**

This is a precisely scoped refactor milestone, not a feature expansion.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add track button | Core CRUD — absent means static system | Low (UI) / Medium (wiring) | Button visible in toolbar or track list header. New track gets auto-generated ID and display name (e.g., "Track 2"). Audio graph for new track must be immediately wired and active. |
| Remove track button (per-track) | Users expect to undo mistakes; static tracks feel locked | Low (UI) / Medium (teardown) | Button in track header. Calls `dispose()` on the track's audio nodes immediately to avoid orphaned Web Audio nodes. |
| Minimum track guard (1 track) | Users are surprised when removing the last track breaks the UI | Low | The remove button must be disabled (or absent) when only one regular track remains. The spec states "min 1". |
| Selection correction after remove | If the removed track was selected, a different track becomes selected | Low | Industry standard: select the previous track; if none, select the first remaining track. Avoids empty device panel or crash. |
| New track immediately usable | Professional DAWs wire tracks synchronously — no loading state | Medium | Audio nodes created and connected before React re-renders. No "pending" state. |
| Track state isolated from peer tracks | Mute/volume/rec-arm on one track does not affect others | Low | Already works for existing track; must hold for dynamically added tracks. |
| Stable track IDs across operations | React `key` depends on stable IDs; Web Audio lookups use IDs | Low | Generate IDs at add-time using a counter or UUID-lite. Never reuse deleted IDs in the same session. |
| Reducer + Context for UI state | State scattered across `useState` in `App.tsx` is identified as a known refactor debt (R1, R2, A4 in `agent_findings_fix_plan_2026-03-12.md`) | Medium | `useReducer` + Context replaces per-concern `useState`. Dispatch is the single entry point for track add/remove/select/mute/volume changes. |
| Engine as standalone singleton | `useAudioEngine` currently creates the engine inside a `useEffect`, making it React-lifecycle-managed. This leaks AudioContext creation and teardown into render timing. | Medium | Move engine creation outside React component tree. A module-level singleton is the idiomatic pattern for Web Audio (confirmed: [audiojs/audio-context](https://github.com/audiojs/audio-context), React and Web Audio patterns). |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-track default name with numbering | "Track 1", "Track 2" avoids naming friction on add | Low | Purely cosmetic; doesn't affect audio. Reuse display count, not deleted count. |
| Disabled remove button (last track) vs hidden | Disabled communicates intent; hidden removes affordance | Low | Disabled + tooltip is more learnable. Hidden is simpler to implement. For a demo, disabled is sufficient. |
| Add button placed at bottom of track list | Follows all major DAWs (Ableton, Logic, Reaper); users know where to look | Low | Alternatively in toolbar; either works for a demo context. |
| Device panel updates immediately on track add | New track's device panel visible without extra click | Low | Achieved automatically if add-track action also dispatches `SELECT_TRACK` for the new ID. |

### Anti-Features (Commonly Requested, Often Problematic)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Undo/redo for track CRUD | Feels natural after deleting by mistake | Out of scope — requires action history stack, audio node resurrect path, and snapshot serialization. None of this infrastructure exists. Adding undo means building an entire command pattern or CRDT system. | Disabled remove button (guard) reduces accidents. Explicit confirmation can be added later. |
| Track reordering (drag-and-drop) | Users want to reorganize tracks | Requires stable ID-to-slot mapping, DOM drag events, and re-patching audio connections on reorder. Changes the audio graph topology non-trivially. | Fixed order for this milestone; reordering is v2+. |
| Track naming (inline rename) | Polished UX | Not in scope per "works exactly the same except for buttons" spec. Adds edit-mode state, blur handlers, and keyboard traps. | Use auto-generated names for now. |
| Per-track synth/device assignment on add | Newly added tracks feel empty without a device | Requires device instantiation policy, engine factory extension, and device panel binding for new module kinds. This is a significant engine capability expansion. | New tracks are "empty strips" (gain + meter) with no synth in this milestone. The device panel can show an empty or placeholder state for selected empty tracks. |
| Track color coding | Visual differentiation | Purely cosmetic, medium CSS effort, zero audio impact | Post-MVP. |
| Confirmation dialog before delete | Prevent accidental deletion | Adds a modal layer and async action handling to the reducer | Minimum guard (disabled at 1 track) is sufficient for a demo. |
| Save/restore track list across sessions | Persistence | Requires serialization, localStorage or backend, and engine rehydration from stored plan | Out of scope for this milestone entirely. |

---

## Feature Dependencies

```
[Reducer + Context] must exist before:
  -> [Add track] (action dispatched through reducer)
  -> [Remove track] (action dispatched through reducer)
  -> [Selection correction after remove] (reducer enforces post-remove selection invariant)
  -> [Minimum track guard] (reducer enforces invariant, view reads disabled state from derived state)

[Engine as standalone singleton] enables:
  -> [New track immediately usable] (engine.addTrackStrip() callable at any point, not tied to effect lifecycle)
  -> [Remove track cleanup] (dispose() callable without React lifecycle dependency)

[Stable track IDs] enables:
  -> [React key stability] (no unnecessary remounts on unrelated track changes)
  -> [Audio module lookup by ID] (AudioEngine.getTrackStrip(id) works correctly)

[Add track action] depends on:
  -> [Engine.addTrackStrip(id)] or equivalent track creation API
  -> [UiPlan / UiTrackPlan] data structure to register new track in UI layer
  -> [MidiClipStore or empty-clip sentinel] to satisfy clip rendering without error

[Remove track action] depends on:
  -> [Engine.removeTrackStrip(id)] or equivalent disposal API
  -> [Selection correction] (must run atomically with the remove in the reducer)
  -> [Minimum track guard check] (reducer rejects remove when tracks.length === 1)
```

---

## MVP Definition

### Launch With (v1)

These are the minimal behaviors required to satisfy the stated acceptance criterion and make the UI feel complete:

1. **Reducer + Context** for all track UI state: track list (ordered IDs + display names), selected track ID, per-track mute, per-track volume, per-track rec-arm, add/remove actions.
2. **Engine as standalone singleton** — created once outside the React tree, no `useEffect`-managed lifecycle.
3. **Add track** — button (toolbar or track list footer), creates a new `TrackStripGraph`, wires it through the engine immediately, appends a new `UiTrackPlan`-equivalent entry to reducer state, auto-selects the new track.
4. **Remove track** — per-track button in track header, disabled when track count is 1, calls `dispose()` on the removed track's audio graph, removes the entry from reducer state, corrects selection.
5. **Selection-after-remove** — reducer atomically sets selected track to the previous sibling, or the first remaining track if the removed track was first.
6. **Minimum guard** — remove button rendered as `disabled` (not hidden) when track count is 1.
7. **Existing behaviors preserved** — all existing E2E tests pass, transport/sequencer/MIDI keyboard function exactly as before.

### Add After Validation (v1.x)

Features that are low-risk but not part of the acceptance criterion:

- Track count display in toolbar ("2 tracks")
- Confirm delete for tracks with clips (low effort, reduces accidents)
- Auto-numbered display names that handle gaps correctly ("Track 1", "Track 3" after "Track 2" removed, next add becomes "Track 4")

### Future Consideration (v2+)

- Track reordering
- Per-track device assignment on add
- Track rename
- Undo/redo
- Persistence

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|-----------|---------------------|----------|
| Reducer + Context | High — unblocks all CRUD | Medium — focused refactor | P0 — must ship (architectural prerequisite) |
| Engine singleton | High — removes lifecycle risk | Low — module-level extraction | P0 — must ship (enables reliable dispose) |
| Add track (wired) | High — core CRUD | Medium — engine API + reducer + UI | P0 — must ship |
| Remove track (with dispose) | High — core CRUD | Medium — teardown + reducer + UI | P0 — must ship |
| Minimum track guard | Medium — prevents crash/confusion | Low — reducer invariant + disabled button | P0 — must ship |
| Selection correction on remove | Medium — prevents empty device panel | Low — reducer post-remove logic | P0 — must ship |
| Stable track IDs | High — correctness for React + audio | Low — ID counter or nanoid | P0 — must ship |
| Disabled (not hidden) remove button | Low — UX polish | Very Low | P1 — nice to have |
| Auto-numbered display names | Low — cosmetic | Low | P1 — nice to have |
| Per-track device on add | High — audio capability | High — engine + device registry expansion | P2 — future |
| Track rename | Low — polish | Medium | P2 — future |
| Undo/redo | Medium — accident recovery | Very High — command history + node resurrection | P3 — future |

---

## Scope Constraint Note

The user's spec is explicit: "acceptance criteria would be that the interface works exactly the same as it does now except for the add and remove buttons for the track." This means:

- **Do not** change existing transport, sequencer, MIDI keyboard, or device panel behavior.
- **Do not** add device instantiation on new tracks unless explicitly scoped.
- **Do** ensure the audio graph for any new track-strip is connected between the existing synth chain and the existing limiter, or as a parallel path — the exact topology is an architecture decision, not a feature decision.
- The reducer refactor is in scope **because** existing agent findings (`agent_findings_fix_plan_2026-03-12.md`) explicitly identified it as a prerequisite for track CRUD (R1, R2, A4), and the user's task includes it.

---

## Sources

- Codebase analysis: `src/App.tsx`, `src/engine/audioEngine.ts`, `src/engine/audioGraphPlan.ts`, `src/ui-plan/uiPlan.ts`, `src/ui-plan/defaultUiPlan.ts`, `src/ui-plan/buildUiRuntime.ts`, `src/hooks/useTrackSelection.ts`, `src/hooks/useTrackStrip.ts`, `src/hooks/useTransportController.ts`, `src/components/TrackZone.tsx`
- Known refactor targets: `docs/plans/agent_findings_fix_plan_2026-03-12.md`
- React official documentation: [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context) — HIGH confidence (official docs)
- Web Audio singleton pattern: [audiojs/audio-context](https://github.com/audiojs/audio-context) — MEDIUM confidence (community project, confirms pattern)
- React state management landscape 2025: [State of React 2025](https://2025.stateofreact.com/en-US/libraries/state-management/) — MEDIUM confidence (survey data)
- DAW UX conventions (add/remove/minimum guard): derived from direct knowledge of Ableton Live, Logic Pro, Reaper behavior — MEDIUM confidence (knowledge cutoff August 2025, patterns are stable conventions)
- Web Audio API node lifecycle: [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — HIGH confidence (official spec)
