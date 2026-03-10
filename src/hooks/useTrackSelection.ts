import { useState, useCallback, createContext, useContext } from 'react';

export type TrackId = 'synth1' | 'master';

export interface TrackSelectionHook {
  selectedTrack: TrackId;
  selectTrack: (id: TrackId) => void;
}

export function createTrackSelection(): TrackSelectionHook {
  let selectedTrack: TrackId = 'synth1';
  const listeners: Array<() => void> = [];

  function selectTrack(id: TrackId) {
    selectedTrack = id;
    listeners.forEach(fn => fn());
  }

  function getSelectedTrack(): TrackId {
    return selectedTrack;
  }

  return {
    get selectedTrack() {
      return getSelectedTrack();
    },
    selectTrack,
  };
}

export function useTrackSelection(): TrackSelectionHook {
  const [selectedTrack, setSelectedTrack] = useState<TrackId>('synth1');

  const selectTrack = useCallback((id: TrackId) => {
    setSelectedTrack(id);
  }, []);

  return { selectedTrack, selectTrack };
}

export const TrackSelectionContext = createContext<TrackSelectionHook>({
  selectedTrack: 'synth1',
  selectTrack: () => {},
});

export function useTrackSelectionContext(): TrackSelectionHook {
  return useContext(TrackSelectionContext);
}
