/**
 * projectReducer.ts — Pure function transforming ProjectDocument state.
 *
 * CRITICAL: No engine imports. No side effects. No React imports.
 * Must be testable with plain object input/output only.
 */
import type { ProjectDocument, Track } from './types';
import type { DawAction } from './actions';

/**
 * Pure reducer for the ProjectDocument slice.
 * Returns a new ProjectDocument given an action, or the same reference if
 * nothing changed.
 */
export function projectReducer(
  state: ProjectDocument,
  action: DawAction,
): ProjectDocument {
  switch (action.type) {
    case 'ADD_TRACK': {
      const newTrack: Track = {
        id: action.id,
        displayName: action.displayName,
        deviceIds: [],
        clipIds: [],
      };
      return {
        ...state,
        tracks: {
          byId: { ...state.tracks.byId, [action.id]: newTrack },
          ids: [...state.tracks.ids, action.id],
        },
      };
    }

    case 'REMOVE_TRACK': {
      const { [action.id]: _removed, ...remainingById } = state.tracks.byId;
      return {
        ...state,
        tracks: {
          byId: remainingById,
          ids: state.tracks.ids.filter((id) => id !== action.id),
        },
      };
    }

    case 'SELECT_TRACK': {
      // Selection is UI-only; projectReducer does not handle it.
      return state;
    }

    case 'SET_REC_ARM': {
      // Rec-arm is UI-only; projectReducer does not handle it.
      return state;
    }

    default: {
      // Exhaustive check — TypeScript will error if a new action type is
      // added to DawAction but not handled here.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
