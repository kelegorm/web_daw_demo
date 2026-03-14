import { useMemo, useEffect, type ReactNode } from 'react';
import { useTransportController } from '../hooks/useTransportController';
import type { TransportControllerState, TransportControllerActions } from '../hooks/useTransportController';
import type { ToneSynthHook } from '../hooks/useToneSynth';
import { getAudioEngine, DEFAULT_TRACK_ID } from '../engine/engineSingleton';
import { DEFAULT_MIDI_CLIP_SOURCE } from '../project-runtime/midiClipStore';
import { TransportStateCtx, TransportActionsCtx } from './TransportContext';

interface TransportProviderProps {
  toneSynth: ToneSynthHook;
  children: ReactNode;
}

export function TransportProvider({ toneSynth, children }: TransportProviderProps) {
  const transport = useTransportController(
    toneSynth,
    (muted) => getAudioEngine().getTrackFacade(DEFAULT_TRACK_ID).setMute(muted),
    DEFAULT_MIDI_CLIP_SOURCE,
  );

  const state: TransportControllerState = {
    isPlaying: transport.isPlaying,
    playbackState: transport.playbackState,
    bpm: transport.bpm,
    loop: transport.loop,
    isTrackMuted: transport.isTrackMuted,
    currentStep: transport.currentStep,
  };

  // Stable actions object — memoize to prevent unnecessary context consumer re-renders
  const actions = useMemo<TransportControllerActions>(() => ({
    play: transport.play,
    pause: transport.pause,
    stop: transport.stop,
    toggle: transport.toggle,
    setBpm: transport.setBpm,
    setLoop: transport.setLoop,
    setTrackMute: transport.setTrackMute,
    panic: transport.panic,
    getPositionSeconds: transport.getPositionSeconds,
  }), [
    transport.play,
    transport.pause,
    transport.stop,
    transport.toggle,
    transport.setBpm,
    transport.setLoop,
    transport.setTrackMute,
    transport.panic,
    transport.getPositionSeconds,
  ]);

  // Initialize E2E window globals on mount
  useEffect(() => {
    window.__panicCount = 0;
    window.__activeSteps = [];
  }, []);

  // Track active steps for E2E tests
  useEffect(() => {
    if (transport.currentStep >= 0) {
      window.__activeSteps = [...(window.__activeSteps ?? []), transport.currentStep];
    }
  }, [transport.currentStep]);

  // React 19 syntax: <Context value=...> (NOT <Context.Provider value=...>)
  return (
    <TransportStateCtx value={state}>
      <TransportActionsCtx value={actions}>
        {children}
      </TransportActionsCtx>
    </TransportStateCtx>
  );
}
