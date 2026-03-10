import { useRef, useCallback, useState } from 'react';
import * as Tone from 'tone';
import {
  AUDIO_DB_MAX,
  AUDIO_DB_MIN,
  MASTER_VOLUME_DEFAULT_DB,
  PANNER_ENABLED_DEFAULT,
  PANNER_PAN_DEFAULT,
  TRACK_VOLUME_DEFAULT_DB,
} from '../audio/parameterDefaults';

export interface PannerGraph {
  pan: number;
  trackVolume: number;
  masterVolume: number;
  setPan: (value: number) => void;
  setTrackVolume: (db: number) => void;
  setMasterVolume: (db: number) => void;
  setTrackMuted: (muted: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
  connectSource: (source: AudioNode | Tone.ToneAudioNode) => void;
  getPannerNode: () => StereoPannerNode;
  getGainNode: () => GainNode;
  getTrackGainNode: () => GainNode;
  getMixerNode: () => GainNode;
  getMasterGainNode: () => GainNode;
  getAnalyserNode: () => AnalyserNode;
  getAnalyserNodeL: () => AnalyserNode;
  getAnalyserNodeR: () => AnalyserNode;
  getMasterAnalyserNode: () => AnalyserNode;
  getMasterAnalyserNodeL: () => AnalyserNode;
  getMasterAnalyserNodeR: () => AnalyserNode;
}

function dbToLinear(db: number): number {
  if (!isFinite(db)) return 0;
  return Math.pow(10, db / 20);
}

export function createPanner(): PannerGraph {
  const audioContext = Tone.getContext().rawContext as AudioContext;

  // Track chain: input -> panner -> trackGain(volume+mute) -> trackAnalyser -> mix bus
  const inputGain = audioContext.createGain();
  const pannerNode = audioContext.createStereoPanner();
  const trackGainNode = audioContext.createGain();
  const analyserNode = audioContext.createAnalyser();
  const channelSplitter = audioContext.createChannelSplitter(2);
  const analyserNodeL = audioContext.createAnalyser();
  const analyserNodeR = audioContext.createAnalyser();

  // Master chain: mix bus -> (limiter inserted externally) -> masterGain -> masterAnalyser -> destination
  const mixerNode = audioContext.createGain();
  const masterGainNode = audioContext.createGain();
  const masterAnalyserNode = audioContext.createAnalyser();
  const masterChannelSplitter = audioContext.createChannelSplitter(2);
  const masterAnalyserNodeL = audioContext.createAnalyser();
  const masterAnalyserNodeR = audioContext.createAnalyser();

  inputGain.connect(pannerNode);
  pannerNode.connect(trackGainNode);
  trackGainNode.connect(analyserNode);
  analyserNode.connect(mixerNode);
  mixerNode.connect(masterGainNode);
  masterGainNode.connect(masterAnalyserNode);
  masterAnalyserNode.connect(audioContext.destination);

  analyserNode.connect(channelSplitter);
  channelSplitter.connect(analyserNodeL, 0);
  channelSplitter.connect(analyserNodeR, 1);

  masterAnalyserNode.connect(masterChannelSplitter);
  masterChannelSplitter.connect(masterAnalyserNodeL, 0);
  masterChannelSplitter.connect(masterAnalyserNodeR, 1);

  let enabled = PANNER_ENABLED_DEFAULT;
  let pan = PANNER_PAN_DEFAULT;
  let trackVolume = TRACK_VOLUME_DEFAULT_DB;
  let masterVolume = MASTER_VOLUME_DEFAULT_DB;
  let trackMuted = false;

  function applyTrackGain() {
    const effectiveDb = trackMuted ? -Infinity : trackVolume;
    trackGainNode.gain.value = dbToLinear(effectiveDb);
  }

  function setPan(value: number) {
    pan = Math.max(-1, Math.min(1, value));
    pannerNode.pan.value = pan;
  }

  function setTrackVolume(db: number) {
    trackVolume = isFinite(db)
      ? Math.max(AUDIO_DB_MIN, Math.min(AUDIO_DB_MAX, db))
      : -Infinity;
    applyTrackGain();
  }

  function setMasterVolume(db: number) {
    masterVolume = isFinite(db)
      ? Math.max(AUDIO_DB_MIN, Math.min(AUDIO_DB_MAX, db))
      : -Infinity;
    masterGainNode.gain.value = dbToLinear(masterVolume);
  }

  function setTrackMuted(muted: boolean) {
    trackMuted = muted;
    applyTrackGain();
  }

  function setEnabled(isEnabled: boolean) {
    if (isEnabled === enabled) return;
    enabled = isEnabled;

    if (!isEnabled) {
      // Bypass panner stage: input -> track gain
      inputGain.disconnect(pannerNode);
      inputGain.connect(trackGainNode);
    } else {
      // Restore panner stage
      inputGain.disconnect(trackGainNode);
      inputGain.connect(pannerNode);
    }
  }

  function connectSource(source: AudioNode | Tone.ToneAudioNode) {
    if (source instanceof AudioNode) {
      source.connect(inputGain);
    } else {
      source.connect(inputGain as unknown as Tone.ToneAudioNode);
    }
  }

  // Ensure node gains reflect defaults.
  setTrackVolume(trackVolume);
  setMasterVolume(masterVolume);

  return {
    get pan() {
      return pan;
    },
    get trackVolume() {
      return trackVolume;
    },
    get masterVolume() {
      return masterVolume;
    },
    get isEnabled() {
      return enabled;
    },
    setPan,
    setTrackVolume,
    setMasterVolume,
    setTrackMuted,
    setEnabled,
    connectSource,
    getPannerNode: () => pannerNode,
    getGainNode: () => trackGainNode,
    getTrackGainNode: () => trackGainNode,
    getMixerNode: () => mixerNode,
    getMasterGainNode: () => masterGainNode,
    getAnalyserNode: () => analyserNode,
    getAnalyserNodeL: () => analyserNodeL,
    getAnalyserNodeR: () => analyserNodeR,
    getMasterAnalyserNode: () => masterAnalyserNode,
    getMasterAnalyserNodeL: () => masterAnalyserNodeL,
    getMasterAnalyserNodeR: () => masterAnalyserNodeR,
  };
}

export interface PannerHook extends PannerGraph {
  isEnabled: boolean;
  pan: number;
  trackVolume: number;
  masterVolume: number;
}

export function usePanner(): PannerHook {
  const pannerRef = useRef<PannerGraph | null>(null);

  if (!pannerRef.current) {
    pannerRef.current = createPanner();
  }

  const [isEnabled, setIsEnabledState] = useState(() => pannerRef.current!.isEnabled);
  const [pan, setPanState] = useState(() => pannerRef.current!.pan);
  const [trackVolume, setTrackVolumeState] = useState(() => pannerRef.current!.trackVolume);
  const [masterVolume, setMasterVolumeState] = useState(() => pannerRef.current!.masterVolume);

  const setPan = useCallback((value: number) => {
    const panner = pannerRef.current!;
    panner.setPan(value);
    setPanState(panner.pan);
  }, []);

  const setTrackVolume = useCallback((db: number) => {
    const panner = pannerRef.current!;
    panner.setTrackVolume(db);
    setTrackVolumeState(panner.trackVolume);
  }, []);

  const setMasterVolume = useCallback((db: number) => {
    const panner = pannerRef.current!;
    panner.setMasterVolume(db);
    setMasterVolumeState(panner.masterVolume);
  }, []);

  const setTrackMuted = useCallback((muted: boolean) => {
    pannerRef.current!.setTrackMuted(muted);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    const panner = pannerRef.current!;
    panner.setEnabled(enabled);
    setIsEnabledState(panner.isEnabled);
  }, []);

  const connectSource = useCallback((source: AudioNode | Tone.ToneAudioNode) => {
    pannerRef.current!.connectSource(source);
  }, []);

  const getPannerNode = useCallback(() => pannerRef.current!.getPannerNode(), []);
  const getGainNode = useCallback(() => pannerRef.current!.getGainNode(), []);
  const getTrackGainNode = useCallback(() => pannerRef.current!.getTrackGainNode(), []);
  const getMixerNode = useCallback(() => pannerRef.current!.getMixerNode(), []);
  const getMasterGainNode = useCallback(() => pannerRef.current!.getMasterGainNode(), []);
  const getAnalyserNode = useCallback(() => pannerRef.current!.getAnalyserNode(), []);
  const getAnalyserNodeL = useCallback(() => pannerRef.current!.getAnalyserNodeL(), []);
  const getAnalyserNodeR = useCallback(() => pannerRef.current!.getAnalyserNodeR(), []);
  const getMasterAnalyserNode = useCallback(() => pannerRef.current!.getMasterAnalyserNode(), []);
  const getMasterAnalyserNodeL = useCallback(() => pannerRef.current!.getMasterAnalyserNodeL(), []);
  const getMasterAnalyserNodeR = useCallback(() => pannerRef.current!.getMasterAnalyserNodeR(), []);

  return {
    isEnabled,
    pan,
    trackVolume,
    masterVolume,
    setPan,
    setTrackVolume,
    setMasterVolume,
    setTrackMuted,
    setEnabled,
    connectSource,
    getPannerNode,
    getGainNode,
    getTrackGainNode,
    getMixerNode,
    getMasterGainNode,
    getAnalyserNode,
    getAnalyserNodeL,
    getAnalyserNodeR,
    getMasterAnalyserNode,
    getMasterAnalyserNodeL,
    getMasterAnalyserNodeR,
  };
}
