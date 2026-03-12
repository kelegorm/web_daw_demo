import { useState, useCallback, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import { createSequencer, Sequencer } from './useSequencer';
import type { SequencerClipInput } from './useSequencer';
import type { ToneSynthHook } from './useToneSynth';
import type { TrackStripHook } from './useTrackStrip';
import { createTransportService, type TransportService } from '../engine/transportService';

export type PlaybackState = 'playing' | 'paused' | 'stopped';

export interface TransportControllerState {
  isPlaying: boolean;
  playbackState: PlaybackState;
  bpm: number;
  loop: boolean;
  isTrackMuted: boolean;
  currentStep: number;
}

export interface TransportControllerActions {
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  toggle(): Promise<void>;
  setBpm(bpm: number): void;
  setLoop(loop: boolean): void;
  setTrackMute(muted: boolean): void;
  panic(): void;
  getPositionSeconds(): number;
}

export type TransportController = TransportControllerState & TransportControllerActions;

export interface TransportCore {
  isPlaying: () => boolean;
  currentStep: () => number;
  isTrackMuted: () => boolean;
  play(): void;
  pause(): void;
  stop(): void;
  setBpm(bpm: number): void;
  setLoop(loop: boolean): void;
  setTrackMute(muted: boolean): void;
  panic(): void;
}

export interface TransportCoreDeps {
  noteOn: (midi: number, velocity: number, time?: number) => void;
  noteOff: (midi: number, time?: number) => void;
  synthPanic: () => void;
  setTrackMuted: (muted: boolean) => void;
  onStepChange?: (step: number) => void;
  sequencerClip?: SequencerClipInput;
}

/**
 * Pure factory: no React state. Accepts deps via object so tests can substitute.
 * State transitions:
 *   pause() — keeps current step, does NOT call panic()
 *   stop()  — resets step to -1, calls panic() exactly once
 *   setTrackMute(true) — silences via channel strip mute; sequencer timing continues
 */
export function createTransportCore(
  deps: TransportCoreDeps,
  transportService: TransportService,
): TransportCore {
  let _trackMuted = false;

  const seq: Sequencer = createSequencer(
    deps.noteOn,
    deps.noteOff,
    deps.synthPanic,
    transportService,
    (step) => {
      transportService.updateCurrentStep(step);
      deps.onStepChange?.(step);
    },
    deps.sequencerClip,
  );

  function play() {
    seq.start();
  }

  function pause() {
    // Does NOT reset step, does NOT call panic
    seq.pause();
  }

  function stop() {
    // Resets step to -1, calls panic exactly once (done inside createSequencer.stop)
    seq.stop();
  }

  function setBpm(bpm: number) {
    transportService.setBpm(bpm);
  }

  function setLoop(loop: boolean) {
    seq.setLoop(loop);
  }

  function setTrackMute(muted: boolean) {
    _trackMuted = muted;
    // Mute is applied in the channel strip gain stage.
    deps.setTrackMuted(muted);
    // Sequencer timing / step progression continues regardless of mute state
  }

  function panic() {
    deps.synthPanic();
  }

  return {
    isPlaying: () => seq.isPlaying(),
    currentStep: () => seq.currentStep(),
    isTrackMuted: () => _trackMuted,
    play,
    pause,
    stop,
    setBpm,
    setLoop,
    setTrackMute,
    panic,
  };
}

export function useTransportController(
  toneSynth: ToneSynthHook,
  trackStrip: TrackStripHook,
): TransportController {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [bpm, setBpmState] = useState(120);
  const [loop, setLoopState] = useState(true);
  const [isTrackMuted, setIsTrackMutedState] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const toneSynthRef = useRef(toneSynth);
  toneSynthRef.current = toneSynth;
  const trackStripRef = useRef(trackStrip);
  trackStripRef.current = trackStrip;

  const serviceRef = useRef<TransportService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = createTransportService(120);
  }

  const coreRef = useRef<TransportCore | null>(null);

  if (!coreRef.current) {
    coreRef.current = createTransportCore(
      {
        noteOn: (midi, velocity, time) => toneSynthRef.current.noteOn(midi, velocity, time),
        noteOff: (midi, time) => toneSynthRef.current.noteOff(midi, time),
        synthPanic: () => toneSynthRef.current.panic(),
        setTrackMuted: (muted) => trackStripRef.current.setTrackMuted(muted),
        onStepChange: (step) => setCurrentStep(step),
      },
      serviceRef.current,
    );
  }

  const play = useCallback(async () => {
    await Tone.start();
    coreRef.current!.play();
    setPlaybackState('playing');
  }, []);

  const pause = useCallback(() => {
    coreRef.current!.pause();
    setPlaybackState('paused');
  }, []);

  const stop = useCallback(() => {
    coreRef.current!.stop();
    setPlaybackState('stopped');
    setCurrentStep(-1);
  }, []);

  const toggle = useCallback(async () => {
    if (coreRef.current!.isPlaying()) {
      pause();
    } else {
      await play();
    }
  }, [play, pause]);

  const setBpm = useCallback((newBpm: number) => {
    setBpmState(newBpm);
    coreRef.current!.setBpm(newBpm);
  }, []);

  const setLoop = useCallback((newLoop: boolean) => {
    setLoopState(newLoop);
    coreRef.current!.setLoop(newLoop);
  }, []);

  const setTrackMute = useCallback((muted: boolean) => {
    setIsTrackMutedState(muted);
    coreRef.current!.setTrackMute(muted);
  }, []);

  const panic = useCallback(() => {
    coreRef.current!.panic();
  }, []);

  const getPositionSeconds = useCallback((): number => {
    return serviceRef.current!.getSnapshot().positionSeconds;
  }, []);

  useEffect(() => {
    return () => {
      coreRef.current?.stop();
      serviceRef.current?.dispose();
    };
  }, []);

  const isPlaying = playbackState === 'playing';

  return {
    isPlaying,
    playbackState,
    bpm,
    loop,
    isTrackMuted,
    currentStep,
    play,
    pause,
    stop,
    toggle,
    setBpm,
    setLoop,
    setTrackMute,
    panic,
    getPositionSeconds,
  };
}
