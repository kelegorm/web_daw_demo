/**
 * useDawDispatch — consumer hook for DispatchContext.
 *
 * Returns the stable DawDispatch object. The dispatch object reference is
 * stable across all re-renders (created once via useMemo([store]) in
 * DawProvider). Components calling only this hook will NEVER re-render due
 * to state changes.
 *
 * Must be used within a DawProvider ancestor.
 */
import { useContext } from 'react';
import type { DawDispatch } from './DawProvider';
import { DispatchContext } from './DawProvider';

export function useDawDispatch(): DawDispatch {
  const value = useContext(DispatchContext);
  if (value === null) {
    throw new Error('useDawDispatch must be used within DawProvider');
  }
  return value;
}
