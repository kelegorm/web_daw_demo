---
phase: 03-app-tsx-teardown
verified: 2026-03-13T15:50:25Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "useTrackSelection.ts does not exist and nothing imports it — AND selection state lives in the reducer"
    status: partial
    reason: "useTrackSelection.ts IS deleted and no imports remain, satisfying the hook-deletion criteria. However, ROADMAP success criterion 3 states 'selection state lives in the reducer' — Layout.tsx uses local useState for selectedTrack instead of reading from DawStore/reducer. The DawStore has selectTrack dispatching SELECT_TRACK to the reducer and UiState.selectedTrackId exists, but Layout.tsx never reads from the store for this value."
    artifacts:
      - path: "src/components/Layout.tsx"
        issue: "Uses local useState<string>(INITIAL_TRACK_ID) + useCallback for track selection (lines 123-124). Does not read selectedTrackId from DawStore via context."
      - path: "src/state/DawStore.ts"
        issue: "selectTrack(id) and SELECT_TRACK reducer exist but are not consumed by Layout.tsx"
    missing:
      - "Layout.tsx should read selectedTrackId from useDawUiState() or equivalent context consumer instead of local useState"
      - "Track selection actions should dispatch to DawStore.selectTrack() rather than local setSelectedTrack()"
    note: "This deviation was explicitly documented as a design decision in 03-01-PLAN.md and 03-01-SUMMARY.md. The PLAN's must_haves only required hook deletion (not reducer integration). The gap exists against ROADMAP success criteria, not against the approved PLAN. Phase 4 context migration may address this."
---

# Phase 3: App.tsx Teardown Verification Report

**Phase Goal:** App.tsx contains nothing but `<DawProvider><Layout /></DawProvider>` — all state, hooks, and module lookups removed
**Verified:** 2026-03-13T15:50:25Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | App.tsx contains only DawProvider wrapping Layout — no useState, no useEffect, no hook calls, no module-level graphs | VERIFIED | App.tsx is 18 lines: 5 imports, module-level `new DawStore(...)`, `export default function App()` returning `<DawProvider store={_store}><Layout /></DawProvider>`. Zero matches for useState/useEffect/hook calls/DEFAULT_PLAN_ constants. |
| 2 | useTrackSelection.ts does not exist and nothing imports it | VERIFIED | `find src -name 'useTrackSelection*'` returns nothing. `grep -rn 'useTrackSelection' src/` returns no matches. |
| 3 | useAudioEngine.ts does not exist and nothing imports it | VERIFIED | `find src -name 'useAudioEngine*'` returns nothing. `grep -rn 'useAudioEngine' src/` returns no matches. |
| 4 | All Playwright E2E tests pass unchanged | VERIFIED | 79 passed (17.0s), 0 failed. All E2E tests including transport, sequencer, trackzone, vumeter, toolbar, midi-keyboard pass. |
| 5 | buildUiRuntime.ts is completely unchanged | VERIFIED | `diff` between commit a09ef8a (phase start) and current HEAD shows zero changes to src/ui-plan/buildUiRuntime.ts. |

**Score:** 4/5 truths verified (Truth 2 is partially satisfied — hook deletion is complete, but ROADMAP criterion "selection state lives in the reducer" is not met)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/App.tsx` | Minimal shell: module-level DawStore + DawProvider wrapping Layout, max 20 lines | VERIFIED | 18 lines. No useState, no useEffect, no hook calls, no module ID constants. Contains: 5 imports, `const _store = new DawStore(...)` at module level, `export default function App()` returning `<DawProvider store={_store}><Layout /></DawProvider>`. |
| `src/components/Layout.tsx` | All former App.tsx internals: module-level graphs, hook calls, model assembly, actions, JSX; min 150 lines | VERIFIED | 241 lines. Contains all module-level device graphs, wiring, legacyEngineAdapter, all 6 hook calls, model assembly, both useEffect hooks for window globals, full JSX. |
| `src/hooks/useTrackSelection.ts` | Deleted | VERIFIED | File does not exist. |
| `src/hooks/useTrackSelection.test.ts` | Deleted | VERIFIED | File does not exist. |
| `src/App.test.tsx` | Deleted | VERIFIED | File does not exist. |
| `src/hooks/useAudioEngine.ts` | Deleted (prior phase) | VERIFIED | File does not exist, no imports anywhere. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/App.tsx` | `src/state/DawStore.ts` | `new DawStore(getAudioEngine(), {...})` at module level | WIRED | Line 7: `const _store = new DawStore(getAudioEngine(), { project: DEFAULT_PROJECT_DOCUMENT, ui: DEFAULT_UI_STATE })` |
| `src/App.tsx` | `src/context/DawProvider.tsx` | `<DawProvider store={_store}>` | WIRED | Lines 14-16: `<DawProvider store={_store}><Layout /></DawProvider>` |
| `src/App.tsx` | `src/components/Layout.tsx` | `<Layout />` rendered as child | WIRED | Line 15: `<Layout />` inside DawProvider |
| `src/components/Layout.tsx` | `src/ui-plan/buildUiRuntime.ts` | `buildUiRuntime(...)` call in function body | WIRED | Line 125: `const uiRuntime = buildUiRuntime({...})` |
| `src/components/Layout.tsx` | `src/engine/engineSingleton.ts` | `getAudioEngine()` for track strip graph | WIRED | Lines 55-57: `const _singletonEngine = getAudioEngine(); const _track1Strip = _singletonEngine._legacy.getTrackStripGraph(DEFAULT_TRACK_ID); _pannerGraph.output.connect(_track1Strip.input)` |
| `src/components/Layout.tsx` | `src/state/DawStore.ts` (via App.tsx) | DawStore selection consumed by Layout | NOT WIRED | Layout.tsx does not read selectedTrackId from DawStore/context. Uses local useState instead. DawStore.selectTrack exists but is unreachable from Layout. |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| APP-01: App.tsx gutted to `<DawProvider><Layout /></DawProvider>` (no state, no module lookups) | SATISFIED | App.tsx is 18 lines with no state/hooks/module lookups. Has `store={_store}` prop which is necessary architecture, not a "module lookup." |
| APP-02: `useAudioEngine` hook deleted (replaced by engine singleton) | SATISFIED | Hook deleted in prior phase (01-03), confirmed absent — no file, no imports. |
| APP-03: `useTrackSelection` hook deleted (replaced by reducer state) | PARTIAL | Hook deleted and no imports remain. However "replaced by reducer state" is not satisfied — track selection uses local useState in Layout.tsx, not the reducer. DawStore.selectTrack dispatches to reducer but is never called. |
| APP-04: `buildUiRuntime` either eliminated or reduced to selected-track device resolution only | SATISFIED | buildUiRuntime.ts unchanged and callsite moved to Layout.tsx where it performs selected-track device resolution. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TODO/FIXME/placeholder/stub patterns found in App.tsx or Layout.tsx. |

### Human Verification Required

None — all behavioral checks are covered by the 79-test Playwright E2E suite which passed in full.

### Unit Tests

22 test files pass, 251 tests pass. 5 `ERR_REQUIRE_ESM` unhandled errors appear in output — these originate from `node_modules/jsdom/lib/api.js` and are a pre-existing jsdom@28 incompatibility documented in the codebase (not introduced by this phase). They do not cause any test failures.

### Gaps Summary

**One gap: APP-03 "selection state lives in the reducer" not satisfied.**

The `useTrackSelection.ts` hook is correctly deleted and has no surviving imports anywhere. The deletion half of APP-03 is complete. However, the ROADMAP success criterion specifies that selection state should live in the reducer after this phase. Instead, Layout.tsx uses `const [selectedTrack, setSelectedTrack] = useState<string>(INITIAL_TRACK_ID)` — a local React state that bypasses the DawStore entirely.

The DawStore does have the infrastructure: `selectTrack(id)` dispatches `SELECT_TRACK`, the reducer handles it, and `UiState.selectedTrackId` exists in `defaultState.ts`. But Layout.tsx never reads from the store for this value.

**Context:** This deviation was explicitly planned and documented. The PLAN's `must_haves` frontmatter only required hook deletion (not reducer integration). The SUMMARY documents the decision: "useTrackSelection inlined in Layout.tsx (useState + useCallback) rather than kept as a separate hook — hook has no reuse consumers and inlining reduces file count." Phase 4 (component-by-component context migration) is the intended venue to migrate components to read from context/store.

**Judgment call:** Whether this constitutes a blocking gap depends on whether the ROADMAP success criterion "selection state lives in the reducer" is interpreted as a hard requirement for Phase 3's completion gate, or as an aspirational description that Phase 4 will fulfill. The code works correctly — the E2E tests all pass. The gap is architectural, not functional.

---

_Verified: 2026-03-13T15:50:25Z_
_Verifier: Claude (gsd-verifier)_
