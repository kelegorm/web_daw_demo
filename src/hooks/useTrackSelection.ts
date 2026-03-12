import { useState, useCallback, createContext, useContext } from 'react'

export interface TrackSelectionHook {
  selectedTrack: string
  selectTrack: (id: string) => void
}

export function createTrackSelection(initialTrackId = ''): TrackSelectionHook {
  let selectedTrack = initialTrackId

  function selectTrack(id: string) {
    selectedTrack = id
  }

  function getSelectedTrack(): string {
    return selectedTrack
  }

  return {
    get selectedTrack() {
      return getSelectedTrack()
    },
    selectTrack,
  }
}

export function useTrackSelection(initialTrackId = ''): TrackSelectionHook {
  const [selectedTrack, setSelectedTrack] = useState<string>(initialTrackId)

  const selectTrack = useCallback((id: string) => {
    setSelectedTrack(id)
  }, [])

  return { selectedTrack, selectTrack }
}

export const TrackSelectionContext = createContext<TrackSelectionHook>({
  selectedTrack: '',
  selectTrack: () => {},
})

export function useTrackSelectionContext(): TrackSelectionHook {
  return useContext(TrackSelectionContext)
}
