/**
 * useProjectState — consumer hook for ProjectContext.
 *
 * Returns the current ProjectDocument. Re-renders only when project structure
 * changes (addTrack / removeTrack). Selection changes (selectTrack) do NOT
 * cause re-renders in components that only call this hook (STATE-03).
 *
 * Must be used within a DawProvider ancestor.
 */
import { useContext } from 'react';
import type { ProjectDocument } from '../state/types';
import { ProjectContext } from './DawProvider';

export function useProjectState(): ProjectDocument {
  const value = useContext(ProjectContext);
  if (value === null) {
    throw new Error('useProjectState must be used within DawProvider');
  }
  return value;
}
