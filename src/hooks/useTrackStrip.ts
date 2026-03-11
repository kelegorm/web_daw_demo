import { useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';
import {
  AUDIO_DB_MAX,
  AUDIO_DB_MIN,
  TRACK_VOLUME_DEFAULT_DB,
} from '../audio/parameterDefaults';
import { createMeterSource } from '../engine/meterSource';
import type { MeterSource } from '../engine/types';

export interface TrackStripGraph {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly trackVolume: number;
  readonly isTrackMuted: boolean;
  setTrackVolume(db: number): void;
  setTrackMuted(muted: boolean): void;
  readonly meterSource: MeterSource;
  dispose(): void;
}

export interface TrackStripHook {
  readonly trackVolume: number;
  readonly isTrackMuted: boolean;
  setTrackVolume(db: number): void;
  setTrackMuted(muted: boolean): void;
  readonly meterSource: MeterSource;
}

function dbToLinear(db: number): number {
  if (!isFinite(db)) return 0;
  return Math.pow(10, db / 20);
}

function safeDisconnect(node: { disconnect?: () => void } | null | undefined): void {
  if (!node?.disconnect) return;
  try { node.disconnect(); } catch { /* ignore */ }
}

export function createTrackStrip(audioContext?: AudioContext): TrackStripGraph {
  const context = audioContext ?? (Tone.getContext().rawContext as AudioContext);

  const inputGain = context.createGain();
  const trackGainNode = context.createGain();
  const analyserNode = context.createAnalyser();
  const channelSplitter = context.createChannelSplitter(2);
  const analyserNodeL = context.createAnalyser();
  const analyserNodeR = context.createAnalyser();
  const outputGain = context.createGain();

  inputGain.connect(trackGainNode);
  trackGainNode.connect(analyserNode);
  analyserNode.connect(outputGain);

  analyserNode.connect(channelSplitter);
  channelSplitter.connect(analyserNodeL, 0);
  channelSplitter.connect(analyserNodeR, 1);

  let trackVolume = TRACK_VOLUME_DEFAULT_DB;
  let trackMuted = false;

  function applyTrackGain() {
    const effectiveDb = trackMuted ? -Infinity : trackVolume;
    trackGainNode.gain.value = dbToLinear(effectiveDb);
  }

  function setTrackVolume(db: number) {
    trackVolume = isFinite(db)
      ? Math.max(AUDIO_DB_MIN, Math.min(AUDIO_DB_MAX, db))
      : -Infinity;
    applyTrackGain();
  }

  function setTrackMuted(muted: boolean) {
    trackMuted = muted;
    applyTrackGain();
  }

  setTrackVolume(trackVolume);

  const meterSource = createMeterSource(analyserNodeL, analyserNodeR);

  return {
    get input() { return inputGain; },
    get output() { return outputGain; },
    get trackVolume() { return trackVolume; },
    get isTrackMuted() { return trackMuted; },
    setTrackVolume,
    setTrackMuted,
    meterSource,
    dispose() {
      safeDisconnect(inputGain);
      safeDisconnect(trackGainNode);
      safeDisconnect(analyserNode);
      safeDisconnect(channelSplitter);
      safeDisconnect(analyserNodeL);
      safeDisconnect(analyserNodeR);
      safeDisconnect(outputGain);
    },
  };
}

export function useTrackStrip(existingTrackStrip: TrackStripHook): TrackStripHook {
  const trackStripRef = useRef<TrackStripHook>(existingTrackStrip);
  trackStripRef.current = existingTrackStrip;

  const [trackVolume, setTrackVolumeState] = useState(() => trackStripRef.current.trackVolume);
  const [isTrackMuted, setIsTrackMutedState] = useState(() => trackStripRef.current.isTrackMuted);

  const setTrackVolume = useCallback((db: number) => {
    const strip = trackStripRef.current;
    strip.setTrackVolume(db);
    setTrackVolumeState(strip.trackVolume);
  }, []);

  const setTrackMuted = useCallback((muted: boolean) => {
    const strip = trackStripRef.current;
    strip.setTrackMuted(muted);
    setIsTrackMutedState(strip.isTrackMuted);
  }, []);

  return {
    trackVolume,
    isTrackMuted,
    setTrackVolume,
    setTrackMuted,
    get meterSource() { return trackStripRef.current.meterSource; },
  };
}
