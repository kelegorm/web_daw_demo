# Plan: Sequencer Timing Hardening

## Overview

Current state:
- Sequencer timing behavior is critical for audible stability (note length, loop consistency, pause/stop correctness).
- Timing-related assumptions are currently spread across sequencer logic and tests.

Goal:
- Define and enforce one timing contract for sequencer note delivery.
- Guarantee note scheduling is transport-time based and regression-protected.

Scope constraints:
- Do not refactor UI plan/model architecture.
- Do not introduce `ProjectDocument` / `DawEngine` in this plan.
- Do not redesign transport topology; only harden timing semantics and tests.

## Timing Contract
- Note events (`noteOn`/`noteOff`) are scheduled in transport time, not via wall-clock JS timers.
- Note duration is derived from sequencer timing values (step duration + gate policy), not `setTimeout` delay drift.
- Loop/pause/stop transitions must not leak stale note events.

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- Manual smoke in `npm run dev`: play/pause/stop/loop are stable, no audible stuck notes, no missed note-offs across repeated loops.

---

### Task 1: Audit and codify sequencer timing paths
- [ ] Inspect `src/hooks/useSequencer.ts` and related transport calls for all note scheduling points.
- [ ] Remove or ban wall-clock note scheduling for sequenced notes.
- [ ] Ensure sequenced notes use transport-time scheduling end-to-end.
- [ ] Centralize timing calculations into named helpers/constants (no timing magic numbers inline).
- [ ] Add inline code comments for non-obvious timing decisions.
- [ ] Mark completed.

### Task 2: Harden automated timing regression coverage
- [ ] Add/adjust unit tests to verify transport-time `noteOn`/`noteOff` scheduling contract.
- [ ] Add/adjust tests for loop/pause/stop transitions so no stale note-offs or stuck notes survive state changes.
- [ ] Keep existing sequencer delivery regression tests green.
- [ ] Confirm loop/pause/stop timing regressions are covered by automated tests.
- [ ] Run validation commands and confirm green: `npm run test`, `npm run test:e2e`, `npm run build`, manual smoke in `npm run dev`.
- [ ] Mark completed.

### Task 3: Document timing invariants
- [ ] Add a short timing invariant section to sequencer-facing docs/comments used by contributors.
- [ ] Ensure the invariant states what is forbidden (`setTimeout` for sequenced note timing).
- [ ] Update `AGENTS.md` sequencing/runtime notes to match the implemented transport-time contract.
- [ ] Update `CLAUDE.md` sequencing/runtime notes to match the implemented transport-time contract.
- [ ] Mark completed.
