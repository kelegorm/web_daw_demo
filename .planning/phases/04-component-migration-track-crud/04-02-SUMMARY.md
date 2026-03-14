---
phase: 04-component-migration-track-crud
plan: 02
subsystem: ui
tags: [react, context, engine-facade, track-crud, dispatch]

# Dependency graph
requires:
  - phase: 04-01
    provides: useTrackFacade hook, DawProvider contexts (ProjectContext/UiContext/DispatchContext), addTrack/removeTrack reducers

provides:
  - TrackZone is a self-sufficient context consumer (no model/actions props from Layout)
  - Per-track audio values sourced from useTrackFacade (engine facade)
  - Add Track button wired via dispatch.addTrack()
  - Remove Track button wired via dispatch.removeTrack(trackId), disabled when isOnlyTrack
  - TrackRow sub-component per track (required by React hook rules — hooks can't be called in .map())
  - CRUD-01 through CRUD-07 all satisfied
  - COMP-02 satisfied (TrackZone reads from context)

affects:
  - 04-03: DevicePanel and MidiKeyboard migration; buildUiRuntime.ts deletion

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TrackRow sub-component pattern for per-track hook calls (avoids calling hooks inside .map())
    - Phase 5 seam props: transport/masterStrip/onTrackMuteSync passed from Layout as temporary thin props
    - onTrackMuteSync callback for transport-mute sync (Phase 5 debt — routes track-1 mute to transport.setTrackMute)

key-files:
  created: []
  modified:
    - src/components/TrackZone.tsx
    - src/components/Layout.tsx

key-decisions:
  - "TrackRow sub-component extracts per-track useTrackFacade call — React hook rules prohibit calling hooks inside .map()"
  - "transport and masterStrip remain as thin props on TrackZone (Phase 5 seams) — both are genuinely Layout-owned hook state, not context"
  - "onTrackMuteSync callback syncs track-1 mute with transport.setTrackMute — preserves existing sequencer mute behavior without coupling TrackRow to transport"
  - "dispatch removed from Layout.tsx — now only consumed within TrackZone via useDawDispatch() context"
  - "TrackZone.test.tsx deleted — tested prop-based interface that no longer exists; blocked by jsdom@28 incompatibility"

patterns-established:
  - "Sub-component extraction: when per-item hooks are needed in a list, extract a named sub-component (TrackRow) to satisfy React hook rules"
  - "Phase seam prop naming: interface props that will be removed in a future phase are grouped into TransportProps/MasterStripProps structs"

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 4 Plan 02: TrackZone Context Consumer + Track CRUD Summary

**TrackZone migrated to self-sufficient context consumer: reads track list from useProjectState, per-track audio from useTrackFacade, dispatches Add/Remove CRUD via useDawDispatch — Layout no longer assembles model or actions objects**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T21:13:30Z
- **Completed:** 2026-03-13T21:17:28Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- TrackZone now reads track list directly from ProjectDocument context (useProjectState)
- Per-track gain/muted/meterSource sourced from useTrackFacade(trackId) engine facade per track
- Add Track button calls dispatch.addTrack() — new tracks get working audio immediately
- Remove Track button calls dispatch.removeTrack(trackId), disabled/styled when isOnlyTrack (min-1 enforcement)
- Layout.tsx reduced by 46 lines — trackZoneModel and trackZoneActions construction completely removed
- CRUD-01 through CRUD-07 and COMP-02 all satisfied

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor TrackZone to context consumer with CRUD buttons** - `ba126ba` (feat)
2. **Task 2: Strip Layout.tsx of TrackZone model/actions assembly** - `92abba2` (feat)

**Plan metadata:** see docs commit below

## Files Created/Modified
- `src/components/TrackZone.tsx` — Removed TrackZoneModel/TrackZoneActions interfaces; added useProjectState/useUiState/useDawDispatch; extracted TrackRow sub-component for per-track useTrackFacade calls; added Add Track and Remove Track CRUD buttons
- `src/components/Layout.tsx` — Removed trackZoneModel/trackZoneActions construction; removed unused imports (TrackZoneModel, TrackZoneActions, DEFAULT_MIDI_CLIP_ID, useDawDispatch); updated TrackZone JSX to pass thin transport/masterStrip/onTrackMuteSync props

## Decisions Made
- TrackRow sub-component: React hook rules (no hooks in .map()) require a sub-component for per-track useTrackFacade calls. TrackRow is defined inside TrackZone.tsx — not exported.
- Phase 5 seam props: transport and masterStrip stay as thin props on TrackZone because they are genuinely Layout-owned reactive hook state, not context. Grouping them into TransportProps/MasterStripProps structs keeps the prop surface minimal and self-documenting.
- onTrackMuteSync: Layout provides this callback to sync track-1 mute with transport.setTrackMute. This preserves the existing sequencer mute behavior without coupling TrackRow directly to transport. Phase 5 removes this when transport is in context.
- dispatch removed from Layout: Layout no longer directly dispatches any actions — all dispatch now flows through context into TrackZone and (later) other components.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The TrackZone refactor was straightforward. The existing test failure (jsdom@28 + Node 20 ERR_REQUIRE_ESM) is a pre-existing blocker documented in STATE.md — all 244 unit tests pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 04-03 is unblocked: DevicePanel and MidiKeyboard remain as the only components still receiving model/actions from Layout
- buildUiRuntime.ts is still a types-only file — 04-03 moves UiRuntimeClipModel/UiRuntimeDeviceModel/DevicePanelModel to consuming files and deletes it
- TrackZone.tsx still imports UiRuntimeClipModel from buildUiRuntime.ts (04-03 moves it inline)
- The _legacy.getTrackStripGraph(DEFAULT_TRACK_ID) call remains in Layout.tsx module scope — device CRUD will address this

---
*Phase: 04-component-migration-track-crud*
*Completed: 2026-03-13*
