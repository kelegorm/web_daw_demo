/**
 * useTrackFacade.ts — React hook wrapping a TrackFacade with local reactive state.
 *
 * Provides gain, muted, and meterSource from the engine singleton for a specific
 * track. Replaces direct TrackStripHook usage in components (Plan 04-02 onwards).
 *
 * CRITICAL: Does not subscribe to engine state changes via polling — local React
 * state is updated synchronously when setGain/setMuted are called.
 */
import { useState, useCallback } from 'react';
import { getAudioEngine } from '../engine/engineSingleton';
import type { MeterSource } from '../engine/types';

export interface TrackFacadeHook {
  readonly gain: number;
  readonly muted: boolean;
  readonly meterSource: MeterSource;
  setGain(db: number): void;
  setMuted(muted: boolean): void;
}

export function useTrackFacade(trackId: string): TrackFacadeHook {
  const facade = getAudioEngine().getTrackFacade(trackId);

  const [gain, setGainState] = useState(() => facade.getGain());
  const [muted, setMutedState] = useState(() => facade.isMuted());

  const setGain = useCallback(
    (db: number) => {
      facade.setGain(db);
      setGainState(facade.getGain());
    },
    [facade],
  );

  const setMuted = useCallback(
    (muted: boolean) => {
      facade.setMute(muted);
      setMutedState(facade.isMuted());
    },
    [facade],
  );

  return { gain, muted, meterSource: facade.meterSource, setGain, setMuted };
}
