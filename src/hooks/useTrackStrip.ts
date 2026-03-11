import { useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';
import {
  AUDIO_DB_MAX,
  AUDIO_DB_MIN,
  TRACK_VOLUME_DEFAULT_DB,
} from '../audio/parameterDefaults';

export interface TrackStripGraph {
  trackVolume: number;
  isTrackMuted: boolean;
  setTrackVolume: (db: number) => void;
  setTrackMuted: (muted: boolean) => void;
  getInputNode: () => GainNode;
  getOutputNode: () => GainNode;
  getTrackGainNode: () => GainNode;
  getAnalyserNode: () => AnalyserNode;
  getAnalyserNodeL: () => AnalyserNode;
  getAnalyserNodeR: () => AnalyserNode;
}

function dbToLinear(db: number): number {
  if (!isFinite(db)) return 0;
  return Math.pow(10, db / 20);
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

  return {
    get trackVolume() {
      return trackVolume;
    },
    get isTrackMuted() {
      return trackMuted;
    },
    setTrackVolume,
    setTrackMuted,
    getInputNode: () => inputGain,
    getOutputNode: () => outputGain,
    getTrackGainNode: () => trackGainNode,
    getAnalyserNode: () => analyserNode,
    getAnalyserNodeL: () => analyserNodeL,
    getAnalyserNodeR: () => analyserNodeR,
  };
}

export interface TrackStripHook extends TrackStripGraph {}

export function useTrackStrip(existingTrackStrip?: TrackStripGraph): TrackStripHook {
  const trackStripRef = useRef<TrackStripGraph | null>(null);

  if (!trackStripRef.current) {
    trackStripRef.current = existingTrackStrip ?? createTrackStrip();
  }

  const [trackVolume, setTrackVolumeState] = useState(() => trackStripRef.current!.trackVolume);
  const [isTrackMuted, setIsTrackMutedState] = useState(() => trackStripRef.current!.isTrackMuted);

  const setTrackVolume = useCallback((db: number) => {
    const strip = trackStripRef.current!;
    strip.setTrackVolume(db);
    setTrackVolumeState(strip.trackVolume);
  }, []);

  const setTrackMuted = useCallback((muted: boolean) => {
    const strip = trackStripRef.current!;
    strip.setTrackMuted(muted);
    setIsTrackMutedState(strip.isTrackMuted);
  }, []);

  const getInputNode = useCallback(() => trackStripRef.current!.getInputNode(), []);
  const getOutputNode = useCallback(() => trackStripRef.current!.getOutputNode(), []);
  const getTrackGainNode = useCallback(() => trackStripRef.current!.getTrackGainNode(), []);
  const getAnalyserNode = useCallback(() => trackStripRef.current!.getAnalyserNode(), []);
  const getAnalyserNodeL = useCallback(() => trackStripRef.current!.getAnalyserNodeL(), []);
  const getAnalyserNodeR = useCallback(() => trackStripRef.current!.getAnalyserNodeR(), []);

  return {
    trackVolume,
    isTrackMuted,
    setTrackVolume,
    setTrackMuted,
    getInputNode,
    getOutputNode,
    getTrackGainNode,
    getAnalyserNode,
    getAnalyserNodeL,
    getAnalyserNodeR,
  };
}
