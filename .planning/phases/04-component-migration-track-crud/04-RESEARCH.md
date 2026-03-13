# Phase 4: Component Migration + Track CRUD - Research

**Researched:** 2026-03-13
**Domain:** React context consumer migration; audio node lifecycle management during CRUD; prop elimination from Layout.tsx
**Confidence:** HIGH (all findings from direct codebase inspection; the domain is entirely internal — no external library unknowns)

## Summary

Phase 4 is a surgical migration, not a greenfield build. All infrastructure exists: DawStore has working `addTrack`/`removeTrack`/`selectTrack` methods, the engine's `createTrackSubgraph`/`removeTrackSubgraph` are already implemented, DawProvider exposes three stable consumer hooks (`useProjectState`, `useUiState`, `useDawDispatch`), and the reducer correctly handles adjacent-track selection on remove. The work is: (1) replace prop drilling in Layout.tsx with context reads in each component, (2) wire Add/Remove buttons through `useDawDispatch`, and (3) resolve the `buildUiRuntime` / `legacyEngineAdapter` tangle, which is the main technical decision of this phase.

The critical architectural problem is the `buildUiRuntime` + `legacyEngineAdapter` system in Layout.tsx. These two objects were legacy bridges for the old App.tsx model-assembly pattern. In Phase 4, components read from context directly, so `buildUiRuntime`'s output (the assembled `TrackZoneModel` and `DevicePanelModel`) becomes redundant for all data that is now in the reducer. However, `buildUiRuntime` still resolves device modules (ToneSynthHook, PannerHook, LimiterHook) for DevicePanel — which are NOT in the reducer (audio values are never stored in reducer per STATE-07). This device resolution must either stay in `buildUiRuntime` or move to a simpler, context-aware alternative.

The plan sequence must start with COMP-07 (Layout.tsx track selection from reducer instead of local useState), then proceed component by component, then wire Add/Remove buttons last (after TrackZone reads from context, so the button handlers land in the same component that renders the track list).

**Primary recommendation:** Migrate components in dependency order: Layout.tsx local state → Toolbar → TrackZone → DevicePanel → MidiKeyboard. Then wire CRUD. Replace `buildUiRuntime` with a thin per-component `useEngineAdapter` hook that reads engine facades by trackId from the singleton. Keep `legacyEngineAdapter` or replace it based on what `buildUiRuntime` is left doing after per-component context reads.

## Standard Stack

No new libraries — React built-ins only (STATE-08 hard constraint).

### Core (unchanged from prior phases)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | Context, hooks, useSyncExternalStore | `<Context value>` syntax already in use |
| TypeScript | 5.x | Type safety | Already in project |
| Tone.js | existing | Audio scheduling, synth | Already in project |

### Key Internal APIs Available Right Now

| File | What It Provides | Status |
|------|-----------------|--------|
| `src/context/useProjectState.ts` | `useProjectState(): ProjectDocument` | Ready |
| `src/context/useUiState.ts` | `useUiState(): UiState` | Ready |
| `src/context/useDawDispatch.ts` | `useDawDispatch(): DawDispatch` | Ready |
| `src/engine/engineSingleton.ts` | `getAudioEngine(): EngineApi`, `EngineApi.getTrackFacade(id)` | Ready |
| `src/state/DawStore.ts` | `addTrack()`, `removeTrack(id)`, `selectTrack(id)` | Ready |

**Installation:** None required.

## Architecture Patterns

### Recommended File Structure After Phase 4

```
src/
├── App.tsx                      # unchanged (DawProvider + Layout shell)
├── components/
│   ├── Layout.tsx               # loses all hook calls, model assembly, prop drilling;
│   │                            # becomes thin orchestrator or is further stripped
│   ├── Toolbar.tsx              # reads transport hooks directly; no props from Layout
│   ├── TrackZone.tsx            # reads useProjectState + useUiState + useDawDispatch;
│   │                            # renders Add/Remove buttons
│   ├── DevicePanel.tsx          # reads selected track engine facades via hook
│   ├── MidiKeyboard.tsx         # reads selected track rec-arm from useUiState or new recArm state
│   └── (other components unchanged)
├── context/
│   ├── DawProvider.tsx          # unchanged
│   ├── useDawDispatch.ts        # unchanged
│   ├── useProjectState.ts       # unchanged
│   └── useUiState.ts            # unchanged
└── hooks/
    └── useTransportController.ts  # may need decoupling from TrackStripHook (Phase 5 target,
                                   # but COMP-01 must not break it)
```

### Pattern 1: Component Context Consumer — Read-Only State

**What:** Components call `useProjectState()` and `useUiState()` instead of receiving props. Data flows from DawStore → context → hook → render.

**When to use:** Toolbar (needs transport state from hooks, not context), TrackZone (needs track list + selectedTrackId), DevicePanel (needs selectedTrackId to determine which device modules to show).

**Example:**
```typescript
// TrackZone — AFTER migration (no Props interface from Layout)
import { useProjectState } from '../context/useProjectState'
import { useUiState } from '../context/useUiState'
import { useDawDispatch } from '../context/useDawDispatch'

export default function TrackZone() {
  const project = useProjectState()   // track list
  const ui = useUiState()             // selectedTrackId
  const dispatch = useDawDispatch()   // selectTrack, addTrack, removeTrack
  // ...renders from project.tracks.ids, project.tracks.byId
}
```

**Caution:** TrackZone currently receives audio values (meterSource, volumeDb, isMuted) that are NOT in the reducer (STATE-07). These still need engine facade reads — see Pattern 3.

### Pattern 2: Dispatch-Only Consumer — CRUD Buttons

**What:** Components call `useDawDispatch()` to trigger engine + state changes. The dispatch object is stable (created via useMemo([store])), so button handlers do not cause unnecessary re-renders.

**When to use:** Add Track button, Remove Track button (in TrackZone or a dedicated component), any other write-only action.

```typescript
function AddTrackButton() {
  const dispatch = useDawDispatch()
  return <button onClick={() => dispatch.addTrack()}>Add Track</button>
}

function RemoveTrackButton({ trackId }: { trackId: string }) {
  const dispatch = useDawDispatch()
  const project = useProjectState()
  const isLast = project.tracks.ids.length <= 1

  return (
    <button
      onClick={() => dispatch.removeTrack(trackId)}
      disabled={isLast}
      aria-disabled={isLast}
    >
      Remove
    </button>
  )
}
```

**DawStore already enforces min-1:** `removeTrack` returns early if `tracks.ids.length <= 1`. The button disabled state is a UI affordance on top of the already-correct business rule.

### Pattern 3: Engine Facade Reads for Audio Values

**What:** Audio values (gain, mute state, meter source) are never in the reducer (STATE-07). Components that need them must call `getAudioEngine().getTrackFacade(trackId)` directly or via a thin hook.

**When to use:** TrackZone needs `meterSource`, `volumeDb` (from facade), and `isMuted` per track. DevicePanel needs to resolve the ToneSynthHook, PannerHook, LimiterHook for the selected track.

```typescript
// Pattern: read facade at render time per trackId
import { getAudioEngine } from '../engine/engineSingleton'

function TrackRow({ trackId }: { trackId: string }) {
  const project = useProjectState()
  const track = project.tracks.byId[trackId]

  // Audio values: NOT in reducer — read from engine directly
  const facade = getAudioEngine().getTrackFacade(trackId)
  // But facade.getGain(), facade.isMuted() return snapshot values, not reactive state
  // For reactive meter/volume display, existing useTrackStrip hook wraps facade reactively
}
```

**Critical decision:** The existing `useTrackStrip(TrackStripGraph)` hook adds React state around facade values (useState for volume, muted). It requires a `TrackStripGraph` argument. For new context-driven components, either:
- (a) Pass `getAudioEngine()._legacy.getTrackStripGraph(trackId)` to `useTrackStrip` — keeps existing hook
- (b) Write a new thin hook `useTrackFacade(trackId)` that wraps `TrackFacade` with useState — avoids _legacy leakage

Option (b) is cleaner and avoids extending _legacy usage beyond what's already there. A `useTrackFacade(trackId)` hook returning `{ gain, muted, meterSource, setGain, setMuted }` sourced from `TrackFacade` is simpler than `useTrackStrip(TrackStripGraph)` and has no _legacy dependency.

### Pattern 4: buildUiRuntime Fate

**What:** `buildUiRuntime` currently does two things:
1. Iterates the UiPlan track list and resolves per-track `TrackStripHook` from the AudioEngine
2. Resolves per-selected-track device modules (ToneSynthHook, PannerHook, LimiterHook) for DevicePanel

After Phase 4, item 1 is replaced by `useProjectState()` + `getAudioEngine().getTrackFacade(trackId)` per track row. Item 2 is the only remaining job.

**Options:**
- **A. Keep buildUiRuntime for device resolution only:** Remove the track iteration, keep the device resolution call for DevicePanel. The `legacyEngineAdapter` still feeds into it. Lowest diff but leaves legacy structure.
- **B. Delete buildUiRuntime, inline device resolution in DevicePanel:** DevicePanel calls `getAudioEngine()` directly for device module resolution by kind. The `DEVICE_REGISTRY` already maps `DeviceModuleKind → resolveModule(audioEngine, moduleId)`. DevicePanel can call `deviceRegistry.resolveModule(engine, moduleId)` directly.
- **C. Write a useSelectedTrackDevices hook:** Reads selected track's deviceIds from ProjectDocument, resolves modules from engine, returns ready-to-render device list.

**Recommendation:** Option C (useSelectedTrackDevices hook). Keeps DevicePanel free of direct engine coupling, is testable in isolation, and cleanly replaces buildUiRuntime's remaining job. The hook lives in `src/context/` or `src/hooks/` and returns `UiRuntimeDeviceModel[]`.

### Pattern 5: Rec-Arm State Migration

**What:** `trackRecByTrackId` is currently a `Record<string, boolean>` local state in Layout.tsx. MidiKeyboard receives `enabled={trackRecByTrackId[INITIAL_TRACK_ID]}`. After Phase 4, MIDI keyboard enablement must follow the CURRENTLY SELECTED track's rec-arm state (COMP-04).

**Options:**
- **A. Keep rec-arm in Layout.tsx local state, but key it by selectedTrackId from context.** Simple but rec-arm state is lost when a track is removed.
- **B. Move rec-arm to reducer.** Adds a new `REC_ARM_TRACK` action and `recArmByTrackId: Record<string, boolean>` to UiState. Reducer auto-disarms removed tracks on REMOVE_TRACK. Cleanest but requires reducer change.
- **C. Keep rec-arm in local state, but initialize new tracks as armed and clean up removed tracks manually.**

**Note from prior decisions:** STATE-05 says "Track selection, rec-arm, and track list live in reducer state." This means option B (reducer) is the architecturally correct choice. However, no `recArmByTrackId` field exists in `UiState` yet. Adding it requires:
  - New action `SET_REC_ARM` in actions.ts
  - New field in `UiState` in types.ts
  - New case in `uiReducer.ts`
  - Clean-up on `REMOVE_TRACK` in uiReducer

This is a small but real reducer change. If this is deemed too large for Phase 4, option A is acceptable as a stopgap (Layout.tsx local state keyed by selectedTrackId, not hardcoded to INITIAL_TRACK_ID).

### Anti-Patterns to Avoid

- **Passing props through Layout.tsx to children:** COMP-05 explicitly forbids prop drilling from App.tsx (and by extension Layout.tsx) to any component.
- **Calling `useTrackStrip` or `useToneSynth` directly in context-migrated components:** These hooks take graph objects as arguments, requiring Layout.tsx to pass them. The migration goal is to eliminate this coupling.
- **Storing audio values (gain, muted, meter) in context:** STATE-07. These are engine state, not reducer state. They do not belong in DawProvider's contexts.
- **Calling `buildUiRuntime` inside migrated components:** After migration, components read from context directly. buildUiRuntime's model assembly is redundant for any component that reads from context.
- **Extending `_legacy` beyond its current footprint:** The _legacy API exists to support the migration period. Phase 4 should reduce, not increase, usage of `_legacy`.
- **Calling `getAudioEngine()` inside a hot render path without memoization:** `getAudioEngine()` is O(1) (returns the singleton), but facade method calls (`getGain()`, `isMuted()`) are synchronous imperative reads. For meter display (60fps rAF loop), this is fine. For volume labels (render-time reads), it's fine too. No memoization needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Track list iteration | Custom array scan | `project.tracks.ids.map(id => project.tracks.byId[id])` | Normalized map is O(1) lookup |
| Min-1 enforcement | Custom guard in button | DawStore already returns early; button just sets `disabled` | DawStore is the single source of truth |
| Adjacent track selection | Custom algorithm | Already in uiReducer REMOVE_TRACK case | Logic is tested |
| Audio node wiring on add | Custom connect() | `dispatch.addTrack()` calls `engine.createTrackSubgraph(id)` internally | DawStore.addTrack() wires engine before state update |
| State subscription | Custom pub-sub | useSyncExternalStore (already in DawProvider) | Already solved |
| Stable dispatch refs | Manual useCallback | `dispatch` from `useDawDispatch()` is already stable (useMemo([store])) | Already implemented |

**Key insight:** The infrastructure is complete. Phase 4 is wiring up what already exists.

## Common Pitfalls

### Pitfall 1: TrackZone Needs Audio Values Not in Context

**What goes wrong:** After removing props from TrackZone, the component still needs per-track `volumeDb`, `isMuted`, and `meterSource` — none of these are in the reducer. A naive migration removes props but breaks the audio value displays.

**Why it happens:** STATE-07 intentionally keeps audio values out of the reducer. TrackZone's current `TrackZoneTrackViewModel` includes `volumeDb`, `isMuted`, and `meterSource` — all sourced from engine facades.

**How to avoid:** Introduce a per-track facade hook (e.g., `useTrackFacade(trackId)`) that wraps `getAudioEngine().getTrackFacade(trackId)` with useState for reactive gain/mute. TrackZone renders a `TrackRow` sub-component that calls this hook per track. The meterSource is passed to VUMeter which has its own subscription loop.

**Warning signs:** Volume slider shows stale value after track is added, or VUMeter is blank.

### Pitfall 2: buildUiRuntime Throws When selectedTrackId Is Not in UiPlan

**What goes wrong:** The current `buildUiRuntime` flow calls `resolveSelectedTrackRuntime(selectedTrackId, resolvedTracks, ...)`. If `selectedTrackId` (from context, post-CRUD) does not match any track in the UiPlan, it throws: `[ui-plan] unknown selectedTrackId: ...`.

**Why it happens:** `DEFAULT_UI_PLAN.tracks` is a static list defined in `defaultUiPlan.ts`. When a new track is added via `dispatch.addTrack()`, the new track ID exists in `ProjectDocument` and `UiState`, but NOT in `DEFAULT_UI_PLAN`. The auto-select of the new track puts a non-UiPlan track ID into `selectedTrackId`, causing `buildUiRuntime` to throw on the next render.

**How to avoid:** This is the key reason `buildUiRuntime` must be replaced or substantially rewritten before CRUD is wired. If `buildUiRuntime` still runs after a track is added, it will throw. Either:
1. Replace buildUiRuntime entirely before wiring CRUD (cleanest).
2. Guard `buildUiRuntime` to not throw on unknown selectedTrackId.

Option 1 is strongly recommended. The CRUD plans (04-02 and beyond) should only wire the Add/Remove buttons AFTER buildUiRuntime has been removed from the render path.

**Warning signs:** React render error "unknown selectedTrackId" immediately after clicking Add Track.

### Pitfall 3: Rec-Arm State Lost When Track Is Removed

**What goes wrong:** If rec-arm is stored in Layout.tsx local state as `Record<string, boolean>`, removing a track does not clean up its entry. The Record grows indefinitely and may have stale keys. More importantly, if the removed track's ID is later reused (it won't be, due to idService.seed() — IDs are never reused), it would get the old rec-arm value.

**Why it happens:** Local state is not coordinated with the reducer's REMOVE_TRACK action.

**How to avoid:** If keeping rec-arm in local state (option A), at minimum pair `dispatch.removeTrack(id)` with `setTrackRecByTrackId(prev => { const next = {...prev}; delete next[id]; return next })`. If moving rec-arm to reducer (option B), this cleanup is automatic.

**Warning signs:** Rec-arm button shows wrong state after removing and re-adding tracks.

### Pitfall 4: useTransportController Still Takes TrackStripHook

**What goes wrong:** COMP-01 says Toolbar reads transport state from hooks. `useTransportController` currently takes `(toneSynth: ToneSynthHook, trackStrip: TrackStripHook, ...)` and calls `setTrackMuted` on the strip when mute changes. If Layout.tsx stops calling `useTrackStrip` and passing the result around, `useTransportController` loses its `trackStrip` argument.

**Why it happens:** Transport mute is wired through `trackStrip.setTrackMuted(muted)` in `createTransportCore`. This is identified as Phase 5 debt in the ROADMAP, but Phase 4's Toolbar migration cannot break it.

**How to avoid:** For Phase 4, keep `useTransportController` signature unchanged. The TrackStripHook argument still comes from `useTrackStrip(_track1Strip)` in Layout.tsx (Layout still coordinates the transport hook). Phase 5 will decouple this. The goal is: Toolbar reads transport state from transport hooks (which it already does via props — the migration is that Toolbar calls `useTransportController` itself or Layout passes the hook return values directly). Given Phase 5 owns transport decoupling, COMP-01 can be satisfied by keeping the transport hook in Layout and having Toolbar receive its state without prop drilling from App — which is already true (Layout is not App, and these are Layout-level props, not App.tsx props). Read COMP-05 carefully: "No prop drilling from App.tsx" — Layout to Toolbar is acceptable under this reading.

**Warning signs:** TypeScript error on useTransportController call if TrackStripHook argument is removed prematurely.

### Pitfall 5: COMP-05 Interpretation — "from App.tsx" vs "from Layout.tsx"

**What goes wrong:** COMP-05 says "No component receives props from App.tsx." App.tsx currently passes nothing to Layout (Layout takes no props). The ambiguity is: does COMP-05 mean App.tsx specifically, or does it mean no prop drilling from ANY parent?

**Why it matters:** Layout.tsx currently passes many props to Toolbar, TrackZone, DevicePanel, MidiKeyboard. If COMP-05 means "no props at all," these must be eliminated. If it means "no props from App.tsx," they are already satisfied.

**Resolution:** Reading SUCCESS CRITERIA #5 — "all data flows from context or engine facades directly into the component that needs it" — indicates the intent is zero prop drilling from the rendering-coordinate ancestor (Layout), not just from App.tsx. Components should be self-sufficient context consumers.

**How to avoid:** Design each component to call its own context hooks, not receive props from Layout.

### Pitfall 6: DevicePanel Track Name Shows Stale Data After Track Add/Remove

**What goes wrong:** DevicePanel shows a rotated track name (`model.selectedTrackDisplayName`). If this comes from buildUiRuntime's stale UiPlan, it will not update when a new track is added (new track has no UiPlan entry, no displayName in the plan).

**Why it happens:** `DEFAULT_UI_PLAN` is static. New tracks added via `dispatch.addTrack()` appear only in `ProjectDocument.tracks`, not in `DEFAULT_UI_PLAN.tracks`.

**How to avoid:** DevicePanel should read selectedTrackDisplayName from `ProjectDocument.tracks.byId[selectedTrackId]?.displayName` (context), not from UiPlan. This automatically updates when new tracks appear.

## Code Examples

Verified patterns from direct codebase inspection.

### Reading Track List from Context (useProjectState)

```typescript
// Source: src/context/useProjectState.ts + src/state/types.ts
import { useProjectState } from '../context/useProjectState'
import { useUiState } from '../context/useUiState'

function TrackZone() {
  const project = useProjectState()   // ProjectDocument
  const ui = useUiState()             // UiState { selectedTrackId }

  // Iterate tracks in order:
  const tracks = project.tracks.ids.map(id => project.tracks.byId[id])

  return tracks.map(track => (
    <TrackRow
      key={track.id}
      trackId={track.id}
      displayName={track.displayName}
      isSelected={track.id === ui.selectedTrackId}
    />
  ))
}
```

### Wiring Add/Remove Track Buttons

```typescript
// Source: src/state/DawStore.ts — addTrack() and removeTrack() already implemented
import { useDawDispatch } from '../context/useDawDispatch'
import { useProjectState } from '../context/useProjectState'

function TrackCrudButtons({ trackId }: { trackId: string }) {
  const dispatch = useDawDispatch()
  const project = useProjectState()
  const isOnlyTrack = project.tracks.ids.length <= 1

  return (
    <>
      <button onClick={() => dispatch.addTrack()}>Add Track</button>
      <button
        onClick={() => dispatch.removeTrack(trackId)}
        disabled={isOnlyTrack}
        aria-disabled={isOnlyTrack}
      >
        Remove
      </button>
    </>
  )
}
```

### Reading Engine Facade for Audio Values (per-track)

```typescript
// Source: src/engine/engineSingleton.ts — getTrackFacade() returns TrackFacade
// TrackFacade interface: src/engine/types.ts
import { getAudioEngine } from '../engine/engineSingleton'
import { useState, useCallback } from 'react'

// Thin hook: wraps TrackFacade in React state for reactive volume/mute display
function useTrackFacade(trackId: string) {
  const engine = getAudioEngine()
  const facade = engine.getTrackFacade(trackId)

  const [gain, setGainState] = useState(() => facade.getGain())
  const [muted, setMutedState] = useState(() => facade.isMuted())

  const setGain = useCallback((db: number) => {
    facade.setGain(db)
    setGainState(facade.getGain())
  }, [facade])

  const setMuted = useCallback((muted: boolean) => {
    facade.setMute(muted)
    setMutedState(facade.isMuted())
  }, [facade])

  return { gain, muted, meterSource: facade.meterSource, setGain, setMuted }
}
```

### Device Resolution for DevicePanel

```typescript
// Source: src/ui-plan/deviceRegistry.ts — DEVICE_REGISTRY with resolveModule
// The hook pattern replaces buildUiRuntime's device resolution:
import { useProjectState } from '../context/useProjectState'
import { useUiState } from '../context/useUiState'
import { getAudioEngine } from '../engine/engineSingleton'
import { DEVICE_REGISTRY } from '../ui-plan/deviceRegistry'

function useSelectedTrackDevices() {
  const project = useProjectState()
  const ui = useUiState()
  const selectedTrack = project.tracks.byId[ui.selectedTrackId]
  if (!selectedTrack) return []

  // For Phase 4 with empty tracks: new tracks have no deviceIds,
  // so this returns [] for new tracks (empty device panel is correct)
  return selectedTrack.deviceIds.map(deviceId => {
    const device = project.devices[deviceId]
    // ... resolve module from engine via DEVICE_REGISTRY
  })
}
```

Note: The default track ('track-1') has `deviceIds: ['dev-synth', 'dev-panner']` in DEFAULT_PROJECT_DOCUMENT. New tracks added in Phase 4 have `deviceIds: []` (empty tracks by prior decision). So DevicePanel will be blank for new tracks, which is the correct behavior.

### Migrating MidiKeyboard Rec-Arm to Follow Selected Track

```typescript
// Source: src/components/MidiKeyboard.tsx — currently receives enabled prop
// Phase 4 change: reads selected track's rec-arm from UiState
// (requires either UiState.recArmByTrackId or Layout.tsx local state keyed by selectedTrackId)

// Option A: Layout.tsx local state (simpler, Phase 4)
const { selectedTrackId } = useUiState()
const recEnabled = trackRecByTrackId[selectedTrackId] ?? false
// MidiKeyboard receives: enabled={recEnabled}

// Option B: UiState.recArmByTrackId (cleaner, requires reducer change)
const ui = useUiState()
const recEnabled = ui.recArmByTrackId[ui.selectedTrackId] ?? false
```

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| App.tsx assembles models, passes as props | Layout.tsx does the same (Phase 3 output) | Phase 4 eliminates this in favor of context |
| buildUiRuntime resolves all track + device models | buildUiRuntime still in Layout.tsx (unchanged from Phase 3) | Phase 4 removes or replaces it |
| legacyEngineAdapter bridges singleton → AudioEngine interface | Still in Layout.tsx module scope | Phase 4 should reduce its scope |
| useTrackSelection: local useState hook | Inlined in Layout.tsx (Phase 3 output) | Phase 4 wires to useUiState().selectedTrackId |
| Track list: static UiPlan | Static DEFAULT_UI_PLAN + dynamic ProjectDocument | Phase 4 unifies these; only ProjectDocument is used |

**Deprecated/outdated (Phase 4 scope):**
- `DEFAULT_UI_PLAN` / `UiPlan` system: No longer needed once components read from `ProjectDocument` (context). Can be deleted in Phase 4 or deferred.
- `buildUiRuntime.ts`: Core model assembly purpose is superseded by context. Device resolution can be extracted to a hook.
- `legacyEngineAdapter`: Only needed by `buildUiRuntime`. If buildUiRuntime is replaced, legacyEngineAdapter can also be removed.
- `resolveInitialTrackId(DEFAULT_UI_PLAN)` in Layout.tsx: Replaced by `DEFAULT_UI_STATE.selectedTrackId` from the store.
- `INITIAL_TRACK_ID` constant in Layout.tsx: Replaced by `useUiState().selectedTrackId`.

## Open Questions

1. **buildUiRuntime replacement scope**
   - What we know: buildUiRuntime serves two purposes; both can be replaced by context hooks
   - What's unclear: Should the UiPlan system (uiPlan.ts, defaultUiPlan.ts, buildUiRuntime.ts) be deleted in Phase 4 or preserved for Phase 5?
   - Recommendation: Plan 04-01 or 04-02 should explicitly decide and execute the deletion as part of the plan. Leaving buildUiRuntime in place while migrating components creates the Pitfall 2 problem (throws on unknown selectedTrackId during CRUD).

2. **Rec-arm in reducer vs local state**
   - What we know: STATE-05 specifies rec-arm belongs in reducer state; current implementation uses Layout.tsx local state
   - What's unclear: Whether Phase 4 should add `SET_REC_ARM` action + `recArmByTrackId` to UiState, or defer to Phase 5
   - Recommendation: Add rec-arm to the reducer in Phase 4 (it's a small change, and COMP-04 requires correct behavior). The alternative of keeping local state "keyed by selectedTrackId" satisfies COMP-04 functionally but leaves debt.

3. **useTransportController signature during Toolbar migration**
   - What we know: Transport is Phase 5 debt; COMP-01 requires Toolbar reads transport state from hooks
   - What's unclear: Whether COMP-01 means "Toolbar calls useTransportController itself" or "Toolbar gets transport values without Layout.tsx prop drilling"
   - Recommendation: For Phase 4, keep transport hook in Layout.tsx but pass transport state as a stable object reference (or have Toolbar call useTransportController directly). Phase 5 owns the deeper refactor.

4. **4-plan structure vs actual work**
   - What we know: ROADMAP lists 04-01 (Toolbar), 04-02 (TrackZone+CRUD), optional 04-03 (DevicePanel), 04-04 (MidiKeyboard)
   - What's unclear: Whether CRUD buttons belong in 04-02 or need a separate plan once buildUiRuntime is resolved
   - Recommendation: Do buildUiRuntime removal in 04-01 (as part of clearing the field before component migration), then proceed with component-by-component migration.

5. **legacyEngineAdapter fate**
   - What we know: legacyEngineAdapter wraps the singleton's internals under the AudioEngine interface for buildUiRuntime
   - What's unclear: After buildUiRuntime is replaced, does anything still need legacyEngineAdapter?
   - Recommendation: If buildUiRuntime is deleted and components read from getAudioEngine() directly (via TrackFacade), legacyEngineAdapter has no consumers and should be deleted. This also removes the `getSynth`, `getPanner`, `getTrackStrip` shape from the active codebase (these were from the old AudioEngine interface that audioEngine.ts implements).

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all files read in full:
  - `src/App.tsx` (18-line shell, confirmed)
  - `src/components/Layout.tsx` (full Layout function body with all hooks and model assembly)
  - `src/components/Toolbar.tsx` (Props interface, render structure)
  - `src/components/TrackZone.tsx` (TrackZoneModel, TrackZoneActions interfaces, render logic)
  - `src/components/DevicePanel.tsx` (DevicePanelModel interface, render logic)
  - `src/components/MidiKeyboard.tsx` (Props: synth + enabled, render logic)
  - `src/context/DawProvider.tsx` (DawDispatch interface, three contexts)
  - `src/context/useDawDispatch.ts`, `useProjectState.ts`, `useUiState.ts` (all three consumer hooks)
  - `src/state/DawStore.ts` (addTrack, removeTrack, selectTrack implementations)
  - `src/state/types.ts` (ProjectDocument, UiState, Track, Device types)
  - `src/state/defaultState.ts` (DEFAULT_PROJECT_DOCUMENT with track-1 + deviceIds)
  - `src/state/actions.ts` (DawAction discriminated union)
  - `src/state/dawReducer.ts`, `projectReducer.ts`, `uiReducer.ts`
  - `src/engine/engineSingleton.ts` (EngineApi interface, createTrackSubgraph, removeTrackSubgraph, TrackFacadeImpl)
  - `src/engine/types.ts` (TrackFacade, MasterFacade, MeterSource)
  - `src/hooks/useTrackStrip.ts` (TrackStripGraph, TrackStripHook, useTrackStrip)
  - `src/ui-plan/buildUiRuntime.ts` (full model assembly flow)
  - `src/ui-plan/defaultUiPlan.ts` (static DEFAULT_UI_PLAN)
  - `src/ui-plan/deviceRegistry.ts` (DEVICE_REGISTRY, resolveModule pattern)
  - `src/hooks/useTransportController.ts` (useTransportController signature and dependencies)
  - `.planning/ROADMAP.md` (Phase 4 goals, plan list, success criteria)
  - `.planning/REQUIREMENTS.md` (COMP-01 through COMP-07, CRUD-01 through CRUD-07)
  - `.planning/STATE.md` (accumulated decisions, blockers)
  - `.planning/phases/03-app-tsx-teardown/03-RESEARCH.md` (prior phase findings)
  - `.planning/phases/03-app-tsx-teardown/03-01-SUMMARY.md` (Phase 3 output state)
  - `src/components/TrackZone.test.tsx` (existing unit tests — must not break)
  - `src/components/DevicePanel.test.tsx` (existing unit tests — must not break)
  - `src/components/MidiKeyboard.test.tsx` (existing unit tests — must not break)
  - `e2e/trackzone.spec.ts` (E2E tests for track row selection, mute, volume, etc.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external libraries, all React built-ins already in use
- Architecture patterns: HIGH — derived from reading all files that will be touched
- buildUiRuntime fate: HIGH — the throw-on-unknown-selectedTrackId problem makes removal mandatory before CRUD wiring
- Pitfalls: HIGH — all from direct code inspection, not speculation
- Rec-arm in reducer: MEDIUM — the STATE-05 requirement is clear, but the implementation scope is a planning decision

**Research date:** 2026-03-13
**Valid until:** Codebase-specific research; valid until the files referenced above change. No external library version expiry.
