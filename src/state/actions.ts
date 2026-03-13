/**
 * actions.ts — Discriminated union of all DAW state actions.
 *
 * Each action is a plain object with a `type` string discriminant.
 * Reducers switch on `action.type` with exhaustive checking.
 */

/** Add a new track to the project and auto-select it. */
export interface AddTrackAction {
  readonly type: 'ADD_TRACK';
  /** Pre-generated unique ID for the new track. */
  readonly id: string;
  readonly displayName: string;
}

/** Remove an existing track from the project. */
export interface RemoveTrackAction {
  readonly type: 'REMOVE_TRACK';
  readonly id: string;
}

/** Select a track in the UI (does not modify ProjectDocument). */
export interface SelectTrackAction {
  readonly type: 'SELECT_TRACK';
  readonly id: string;
}

/** Toggle record-arm for a track. */
export interface SetRecArmAction {
  readonly type: 'SET_REC_ARM';
  readonly trackId: string;
  readonly armed: boolean;
}

/** All actions that can be dispatched to the DAW reducers. */
export type DawAction = AddTrackAction | RemoveTrackAction | SelectTrackAction | SetRecArmAction;
