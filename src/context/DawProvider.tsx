/**
 * DawProvider.tsx — React Bridge Layer (Layer 3).
 *
 * Bridges DawStore (Layer 2) to the React render cycle via useSyncExternalStore.
 * Three split contexts prevent unnecessary re-renders:
 *   - ProjectContext: structural project data (changes on addTrack/removeTrack)
 *   - UiContext: UI selection state (changes on selectTrack)
 *   - DispatchContext: stable dispatch object (never changes after mount)
 *
 * CRITICAL: React 19 context syntax (<Context value=...>, NOT <Context.Provider>).
 * CRITICAL: useSyncExternalStore, NOT useEffect/useState subscription.
 * No new runtime libraries — React built-ins only (STATE-08).
 */
import {
  createContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { ProjectDocument, UiState } from '../state/types';
import type { DawStore } from '../state/DawStore';

// ---------------------------------------------------------------------------
// DawDispatch — stable dispatch interface exposed to consumers
// ---------------------------------------------------------------------------

/**
 * Stable dispatch object wrapping DawStore action methods.
 * Reference is stable across re-renders (created once via useMemo([store])).
 */
export interface DawDispatch {
  addTrack(): string;
  removeTrack(id: string): void;
  selectTrack(id: string): void;
  setRecArm(trackId: string, armed: boolean): void;
}

// ---------------------------------------------------------------------------
// Context definitions — NOT exported. Access only via consumer hooks.
// Exported only as named exports for the hook files in this directory.
// ---------------------------------------------------------------------------

export const ProjectContext = createContext<ProjectDocument | null>(null);
export const UiContext = createContext<UiState | null>(null);
export const DispatchContext = createContext<DawDispatch | null>(null);

// ---------------------------------------------------------------------------
// DawProvider component
// ---------------------------------------------------------------------------

interface DawProviderProps {
  store: DawStore;
  children: ReactNode;
}

/**
 * DawProvider — wraps the application (or a subtree) with three contexts.
 *
 * useSyncExternalStore subscribes to DawStore and re-renders only the
 * context consumers whose slice changed (project vs ui are separate).
 *
 * DawStore's arrow-method class fields (subscribe, getProjectSnapshot,
 * getUiSnapshot) have stable reference identity — safe to pass directly
 * without useCallback wrapping.
 */
export function DawProvider({ store, children }: DawProviderProps) {
  const project = useSyncExternalStore(
    store.subscribe,
    store.getProjectSnapshot,
  );

  const ui = useSyncExternalStore(
    store.subscribe,
    store.getUiSnapshot,
  );

  const dispatch = useMemo<DawDispatch>(
    () => ({
      addTrack: () => store.addTrack(),
      removeTrack: (id: string) => store.removeTrack(id),
      selectTrack: (id: string) => store.selectTrack(id),
      setRecArm: (trackId: string, armed: boolean) => store.setRecArm(trackId, armed),
    }),
    [store],
  );

  // React 19 syntax: <Context value=...> (NOT <Context.Provider value=...>)
  return (
    <ProjectContext value={project}>
      <UiContext value={ui}>
        <DispatchContext value={dispatch}>
          {children}
        </DispatchContext>
      </UiContext>
    </ProjectContext>
  );
}
