---
phase: 05-transport-decoupling-+-integration-close-out
plan: "02"
subsystem: ui
tags: [react, context, transport, toolbar, trackzone, layout, typescript]

# Dependency graph
requires:
  - phase: 05-transport-decoupling-+-integration-close-out
    plan: "01"
    provides: useTransportController accepting plain callback, decoupled from TrackStripHook

provides:
  - TransportStateCtx + TransportActionsCtx split contexts with fail-fast consumer hooks
  - TransportProvider component calling useTransportController, memoizing actions
  - Toolbar as zero-prop context consumer
  - TrackZone with transport/onTrackMuteSync props eliminated
  - Layout as thin coordinator — no useTransportController call, no transport prop passing

affects:
  - 05-03-PLAN.md (Integration close-out — transport context now available to all descendants)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split state/actions contexts — TransportStateCtx (re-renders on state change) + TransportActionsCtx (stable memo, never causes re-renders)"
    - "useMemo over actions object — useCallback-wrapped functions from useTransportController are stable refs; memo rarely recomputes"
    - "TransportProvider inside Layout — correct nesting: DawProvider > Layout > TransportProvider > children"
    - "window globals consolidated in TransportProvider — __panicCount init and __activeSteps tracking co-located with transport state owner"

key-files:
  created:
    - src/context/TransportContext.tsx
    - src/context/TransportProvider.tsx
  modified:
    - src/components/Toolbar.tsx
    - src/components/TrackZone.tsx
    - src/components/Layout.tsx

key-decisions:
  - "TransportProvider accepts toneSynth as prop from Layout — Layout owns the useToneSynth hook call because toneSynth is also needed for DevicePanel and MidiKeyboard; pulling hook into provider would require additional prop threading or a second context"
  - "actions object memoized with useMemo([transport.play, ...]) — useCallback-wrapped functions have stable identity so memo rarely recomputes; prevents unnecessary context consumer re-renders"
  - "__panicCount increment kept in Toolbar — panic button is in Toolbar, closest to the user action; __panicCount init and __activeSteps tracking moved to TransportProvider (owns transport state)"
  - "onMuteChanged routes to transportActions.setTrackMute only for DEFAULT_TRACK_ID — preserves sequencer sync without onTrackMuteSync callback seam; condition handles multi-track future correctly"

patterns-established:
  - "React 19 <Context value=...> syntax (NOT <Context.Provider>) — consistent with DawProvider pattern throughout codebase"
  - "Fail-fast null-check pattern in consumer hooks — useTransportState/useTransportActions throw on null, matching useProjectState/useUiState/useDawDispatch"

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 5 Plan 02: Transport Context Integration Summary

**TransportStateCtx + TransportActionsCtx split contexts created; Toolbar and TrackZone migrated to context consumers; Layout stripped of useTransportController call and transport prop passing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T22:36:40Z
- **Completed:** 2026-03-13T22:41:27Z
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

- `TransportContext.tsx` exports `useTransportState()` and `useTransportActions()` with fail-fast null guards — same pattern as DawProvider
- `TransportProvider.tsx` calls `useTransportController`, provides split state/actions contexts, consolidates `window.__panicCount` init and `window.__activeSteps` tracking
- `Toolbar.tsx` has no Props interface — reads all state/actions from context hooks; panic count tracking moved from Layout into Toolbar
- `TrackZone.tsx` has no `transport` or `onTrackMuteSync` props — reads transport from context; `onMuteChanged` directly calls `transportActions.setTrackMute` for DEFAULT_TRACK_ID
- `Layout.tsx` has no `useTransportController` import or call — thin coordinator: hooks + TransportProvider wrapper + narrow device seam props only
- `TransportProvider` wraps inside `Layout` (correct nesting: DawProvider > Layout > TransportProvider)
- All 244 Vitest tests pass; build succeeds with no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TransportContext + TransportProvider** - `b2557c1` (feat)
2. **Tasks 2 + 3: Migrate Toolbar/TrackZone, strip Layout** - `da49085` (feat)

Note: Tasks 2 and 3 were committed together because Task 2's Toolbar migration temporarily broke the build (Layout.tsx still passed props to Toolbar) until Task 3 updated Layout.tsx. The two tasks form one coherent atomic change.

**Plan metadata committed with SUMMARY.md and STATE.md**

## Files Created/Modified

- `src/context/TransportContext.tsx` — TransportStateCtx, TransportActionsCtx, useTransportState(), useTransportActions()
- `src/context/TransportProvider.tsx` — TransportProvider component; calls useTransportController; provides both contexts; consolidates window globals
- `src/components/Toolbar.tsx` — removed Props interface; reads transport state/actions from context; panic count tracking inline
- `src/components/TrackZone.tsx` — removed TransportProps, onTrackMuteSync from TrackZoneProps; reads transport from context hooks; onMuteChanged routes to transportActions.setTrackMute
- `src/components/Layout.tsx` — removed useTransportController import and call; removed handlePanic, __activeSteps useEffects, Toolbar/TrackZone transport props; wraps children in TransportProvider

## Decisions Made

- **TransportProvider accepts toneSynth as prop:** The synth graph is created at module level in Layout.tsx and `useToneSynth(_synthGraph)` is called inside the Layout function. The hook return is also needed for `DevicePanel` (`'dev-synth'`) and `MidiKeyboard`. Moving the hook call into TransportProvider would require either threading `toneSynth` back up to Layout via a second context or prop, or duplicating the hook. Layout owning the hook and passing `toneSynth` to `TransportProvider` as a prop is the cleanest approach with the least indirection.

- **Tasks 2 and 3 committed together:** Task 2 stripped Toolbar's Props interface, making Layout.tsx (which still passed transport props to Toolbar) fail TypeScript. Both tasks must be applied together for a buildable intermediate state. This is documented for future git bisect users.

- **useMemo for actions object:** `useTransportController` returns `useCallback`-wrapped functions with stable references. The memo will rarely recompute. This prevents `TransportActionsCtx` consumers from re-rendering whenever transport state changes.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all tasks completed without blockers.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `TransportProvider` is in place and working — Plan 05-03 can build on the context structure
- `_legacy.limiterGraph` still used in Layout.tsx for `useLimiter` — targeted in Phase 5 close-out plans
- `TrackZone` still receives `masterStrip` as a prop from Layout — master strip context is v2 scope

---
*Phase: 05-transport-decoupling-+-integration-close-out*
*Completed: 2026-03-13*
