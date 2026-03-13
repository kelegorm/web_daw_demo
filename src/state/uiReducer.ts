/**
 * uiReducer.ts — Pure function transforming UiState slice.
 *
 * Receives the current ProjectDocument as a third argument so it can compute
 * adjacent track selection when the selected track is removed.
 *
 * CRITICAL: No engine imports. No side effects. No React imports.
 */
import type { UiState, ProjectDocument } from './types';
import type { DawAction } from './actions';

/**
 * Pure reducer for the UiState slice.
 *
 * @param state  - Current UI state.
 * @param action - Dispatched action.
 * @param project - The ProjectDocument BEFORE the action is applied. Used by
 *                  REMOVE_TRACK to find an adjacent track for selection.
 */
export function uiReducer(
  state: UiState,
  action: DawAction,
  project: ProjectDocument,
): UiState {
  switch (action.type) {
    case 'ADD_TRACK': {
      // Auto-select the newly added track.
      return { ...state, selectedTrackId: action.id };
    }

    case 'REMOVE_TRACK': {
      if (state.selectedTrackId !== action.id) {
        // Removing a track that is not selected — keep selection unchanged.
        return state;
      }

      // The selected track is being removed. Pick an adjacent track.
      const ids = project.tracks.ids;
      const removedIndex = ids.indexOf(action.id);

      // Prefer the track immediately after; fall back to the track before.
      const nextId = ids[removedIndex + 1] ?? ids[removedIndex - 1];

      // If there is no adjacent track (empty list after removal), keep the
      // old selectedTrackId — DawStore enforces min-1 track before dispatch.
      return {
        ...state,
        selectedTrackId: nextId ?? state.selectedTrackId,
      };
    }

    case 'SELECT_TRACK': {
      return { ...state, selectedTrackId: action.id };
    }

    default: {
      // Exhaustive check
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
