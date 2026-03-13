/**
 * dawReducer.ts — Combined reducer delegating to projectReducer + uiReducer.
 *
 * CRITICAL: No engine imports. No side effects. No React imports.
 * Pure function: same input always produces same output.
 */
import type { DawState } from './types';
import type { DawAction } from './actions';
import { projectReducer } from './projectReducer';
import { uiReducer } from './uiReducer';

/**
 * Top-level reducer for the full DawState.
 *
 * Ordering is intentional:
 * 1. Run projectReducer first.
 * 2. Run uiReducer with the OLD project state (so REMOVE_TRACK can see the
 *    track list before removal for adjacent-track selection).
 */
export function dawReducer(state: DawState, action: DawAction): DawState {
  const newProject = projectReducer(state.project, action);
  // Pass state.project (OLD) so uiReducer can compute adjacency before removal.
  const newUi = uiReducer(state.ui, action, state.project);
  return { project: newProject, ui: newUi };
}
