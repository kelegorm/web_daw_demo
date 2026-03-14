---
phase: "03"
plan: "01"
name: "App.tsx Teardown — Layout extraction and shell reduction"
subsystem: "app-structure"
tags: ["react", "app-tsx", "layout", "refactor", "dayprovider", "dawstore"]
status: "complete"
completed: "2026-03-13"
duration: "2m 34s"

dependency-graph:
  requires:
    - "02-03: DawProvider + DawStore (React bridge layer)"
    - "02-01: ProjectDocument reducer"
    - "01-03: Engine singleton with legacyEngineAdapter pattern"
  provides:
    - "Minimal App.tsx shell: module-level DawStore + DawProvider wrapping Layout"
    - "Layout.tsx: all former App.tsx internals (device graphs, hooks, model assembly, actions, JSX)"
  affects:
    - "04: Component-by-component context migration — Layout.tsx is the starting point"

tech-stack:
  added: []
  patterns:
    - "Inline track selection via useState+useCallback (replaces useTrackSelection hook)"
    - "Module-level DawStore instantiation in App.tsx (StrictMode double-mount safety)"

key-files:
  created:
    - "src/components/Layout.tsx"
  modified:
    - "src/App.tsx"
  deleted:
    - "src/hooks/useTrackSelection.ts"
    - "src/hooks/useTrackSelection.test.ts"
    - "src/App.test.tsx"

decisions:
  - "useTrackSelection inlined in Layout.tsx (useState + useCallback) rather than kept as a separate hook — hook has no reuse consumers and inlining reduces file count"
  - "DawStore created at App.tsx MODULE LEVEL (not inside App function) — prevents React StrictMode double-mount from creating two engine instances"
  - "App.test.tsx deleted (not migrated) — consistent with useAudioEngine.test.tsx deletion precedent; the 336 lines test wiring that no longer exists"
  - "buildUiRuntime.ts kept completely unchanged — callsite moved to Layout.tsx verbatim"

metrics:
  tasks-completed: 2
  tasks-total: 2
  unit-tests: "251 passed (22 files)"
  e2e-tests: "79 passed"
  type-errors: 0
---

# Phase 03 Plan 01: App.tsx Teardown Summary

**One-liner:** App.tsx reduced to 18-line DawStore+DawProvider shell; all internals moved verbatim to new Layout.tsx component with inlined track selection.

## What Was Built

### Task 1 — Create Layout.tsx and rewrite App.tsx (commit: 137c666)

Created `src/components/Layout.tsx` containing all content from the original App.tsx:

- Module-level device graphs (`_synthGraph`, `_pannerGraph`) and their wiring into the engine singleton
- `_masterStripHook` adapter wrapping `MasterFacade` into `MasterStripHook` shape
- `legacyEngineAdapter` implementing the `AudioEngine` interface for `buildUiRuntime`
- All hook calls: `useToneSynth`, `usePanner`, `useTrackStrip`, `useMasterStrip`, `useLimiter`, `useTransportController`
- Track selection state inlined as `useState<string>(INITIAL_TRACK_ID)` + `useCallback` (replaces `useTrackSelection`)
- `buildUiRuntime` call with `selectedTrack` (formerly `trackSelection.selectedTrack`)
- Full model assembly: `trackZoneModel`, `devicePanelModel`, `trackZoneActions`
- Both `useEffect` hooks for `window.__panicCount` and `window.__activeSteps` (Playwright E2E observes these)
- Return JSX: `<div id="app">` with Toolbar, TrackZone, DevicePanel, MidiKeyboard

Import paths updated from `./` to `../` throughout (Layout lives in `components/` subdirectory).

Rewrote `src/App.tsx` as minimal shell (~18 lines):
- Module-level `new DawStore(getAudioEngine(), { project: DEFAULT_PROJECT_DOCUMENT, ui: DEFAULT_UI_STATE })`
- `export default function App()` returns `<DawProvider store={_store}><Layout /></DawProvider>`
- Zero useState, zero useEffect, zero hook calls, zero audio graph code

### Task 2 — Delete deprecated files (commit: 3302fb5)

Deleted three deprecated files (400 lines removed):
- `src/hooks/useTrackSelection.ts` — functionality inlined in Layout.tsx (APP-03)
- `src/hooks/useTrackSelection.test.ts` — tests the deleted hook
- `src/App.test.tsx` — 336 lines testing old App.tsx wiring, entirely irrelevant after teardown

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 0 errors |
| Hook calls in App.tsx | 0 |
| App.tsx line count | 18 |
| DawProvider in App.tsx | confirmed |
| buildUiRuntime callsite in Layout.tsx | confirmed |
| useTrackSelection files in src/ | 0 |
| useTrackSelection imports in src/ | 0 |
| useAudioEngine files in src/ | 0 |
| git diff buildUiRuntime.ts | empty (unchanged) |
| Unit tests (Vitest) | 251 passed |
| E2E tests (Playwright) | 79 passed |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 137c666 | feat(03-01) | Gut App.tsx to minimal shell, create Layout.tsx |
| 3302fb5 | chore(03-01) | Delete deprecated useTrackSelection and App.test.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

Phase 4 (component-by-component context migration) can start. The entry point is `src/components/Layout.tsx`, which now owns all the hook calls, model assembly, and action callbacks that Phase 4 will progressively move into context consumers.

Key starting facts for Phase 4:
- `buildUiRuntime.ts` is untouched — Phase 4 should evaluate whether to keep or replace it
- `legacyEngineAdapter` remains in Layout.tsx module scope — Phase 4 may relocate to engineSingleton or a dedicated adapter file
- The `_legacy.getTrackStripGraph(DEFAULT_TRACK_ID)` call in Layout.tsx is the remaining migration debt flagged in STATE.md
