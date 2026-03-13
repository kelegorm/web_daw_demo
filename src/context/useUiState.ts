/**
 * useUiState — consumer hook for UiContext.
 *
 * Returns the current UiState (selectedTrackId, etc.). Re-renders only when
 * UI selection changes (selectTrack). Project structure changes (addTrack /
 * removeTrack) do NOT cause re-renders in components that only call this hook
 * (STATE-03).
 *
 * Must be used within a DawProvider ancestor.
 */
import { useContext } from 'react';
import type { UiState } from '../state/types';
import { UiContext } from './DawProvider';

export function useUiState(): UiState {
  const value = useContext(UiContext);
  if (value === null) {
    throw new Error('useUiState must be used within DawProvider');
  }
  return value;
}
