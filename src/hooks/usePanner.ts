import { useRef, useCallback, useState } from 'react';
import * as Tone from 'tone';
import {
  AUDIO_DB_MAX,
  AUDIO_DB_MIN,
  MASTER_VOLUME_DEFAULT_DB,
  PANNER_ENABLED_DEFAULT,
  PANNER_PAN_DEFAULT,
} from '../audio/parameterDefaults';

export interface PannerGraph {
  pan: number;
  masterVolume: number;
  setPan: (value: number) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
  connectSource: (source: AudioNode | Tone.ToneAudioNode) => void;
  getPannerNode: () => StereoPannerNode;
  getGainNode: () => GainNode;
  getMasterGainNode: () => GainNode;
  getAnalyserNode: () => AnalyserNode;
  getAnalyserNodeL: () => AnalyserNode;
  getAnalyserNodeR: () => AnalyserNode;
  getMasterAnalyserNode: () => AnalyserNode;
  getMasterAnalyserNodeL: () => AnalyserNode;
  getMasterAnalyserNodeR: () => AnalyserNode;
  setMasterVolume: (db: number) => void;
}

export function createPanner(limiterNode?: { input: AudioNode; connect: (dest: unknown) => void }): PannerGraph {
  const audioContext = Tone.getContext().rawContext as AudioContext;

  // Internal graph nodes
  const inputGain = audioContext.createGain();
  const pannerNode = audioContext.createStereoPanner();
  const gainNode = audioContext.createGain(); // track mute
  const analyserNode = audioContext.createAnalyser();
  const channelSplitter = audioContext.createChannelSplitter(2);
  const analyserNodeL = audioContext.createAnalyser();
  const analyserNodeR = audioContext.createAnalyser();
  const masterGainNode = audioContext.createGain(); // master volume
  const masterAnalyserNode = audioContext.createAnalyser();
  const masterChannelSplitter = audioContext.createChannelSplitter(2);
  const masterAnalyserNodeL = audioContext.createAnalyser();
  const masterAnalyserNodeR = audioContext.createAnalyser();

  // Default chain (enabled): inputGain -> panner -> gain -> analyser -> masterGain -> [limiter ->] masterAnalyser -> destination
  inputGain.connect(pannerNode);
  pannerNode.connect(gainNode);
  gainNode.connect(analyserNode);
  analyserNode.connect(masterGainNode);
  if (limiterNode) {
    masterGainNode.connect(limiterNode.input);
    limiterNode.connect(masterAnalyserNode);
  } else {
    masterGainNode.connect(masterAnalyserNode);
  }
  masterAnalyserNode.connect(audioContext.destination);

  // Stereo per-channel analysis branches (silent — no downstream connection needed)
  analyserNode.connect(channelSplitter);
  channelSplitter.connect(analyserNodeL, 0);
  channelSplitter.connect(analyserNodeR, 1);

  masterAnalyserNode.connect(masterChannelSplitter);
  masterChannelSplitter.connect(masterAnalyserNodeL, 0);
  masterChannelSplitter.connect(masterAnalyserNodeR, 1);

  let enabled = PANNER_ENABLED_DEFAULT;
  let pan = PANNER_PAN_DEFAULT;
  let masterVolume = MASTER_VOLUME_DEFAULT_DB;

  function setPan(value: number) {
    pan = Math.max(-1, Math.min(1, value));
    pannerNode.pan.value = pan;
  }

  function setEnabled(isEnabled: boolean) {
    if (isEnabled === enabled) return;
    enabled = isEnabled;

    if (!isEnabled) {
      // Bypass panner: inputGain -> gainNode directly
      inputGain.disconnect(pannerNode);
      inputGain.connect(gainNode);
    } else {
      // Restore panner in chain
      inputGain.disconnect(gainNode);
      inputGain.connect(pannerNode);
    }
  }

  function connectSource(source: AudioNode | Tone.ToneAudioNode) {
    if (source instanceof AudioNode) {
      source.connect(inputGain);
    } else {
      // Tone.ToneAudioNode — use its connect method
      source.connect(inputGain as unknown as Tone.ToneAudioNode);
    }
  }

  function setMasterVolume(db: number) {
    masterVolume = isFinite(db)
      ? Math.max(AUDIO_DB_MIN, Math.min(AUDIO_DB_MAX, db))
      : -Infinity;
    const linear = isFinite(masterVolume) ? Math.pow(10, masterVolume / 20) : 0;
    masterGainNode.gain.value = linear;
    try {
      Tone.getDestination().volume.value = masterVolume;
    } catch {
      // Tone.Destination may not be in signal chain
    }
  }

  return {
    get pan() {
      return pan;
    },
    get masterVolume() {
      return masterVolume;
    },
    get isEnabled() {
      return enabled;
    },
    setPan,
    setEnabled,
    connectSource,
    setMasterVolume,
    getPannerNode: () => pannerNode,
    getGainNode: () => gainNode,
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
  masterVolume: number;
}

export function usePanner(): PannerHook {
  const pannerRef = useRef<PannerGraph | null>(null);

  if (!pannerRef.current) {
    pannerRef.current = createPanner();
  }

  const [isEnabled, setIsEnabledState] = useState(() => pannerRef.current!.isEnabled);
  const [pan, setPanState] = useState(() => pannerRef.current!.pan);
  const [masterVolume, setMasterVolumeState] = useState(() => pannerRef.current!.masterVolume);

  const setPan = useCallback((value: number) => {
    const panner = pannerRef.current!;
    panner.setPan(value);
    setPanState(panner.pan);
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
  const getMasterGainNode = useCallback(() => pannerRef.current!.getMasterGainNode(), []);
  const getAnalyserNode = useCallback(() => pannerRef.current!.getAnalyserNode(), []);
  const getAnalyserNodeL = useCallback(() => pannerRef.current!.getAnalyserNodeL(), []);
  const getAnalyserNodeR = useCallback(() => pannerRef.current!.getAnalyserNodeR(), []);
  const getMasterAnalyserNode = useCallback(() => pannerRef.current!.getMasterAnalyserNode(), []);
  const getMasterAnalyserNodeL = useCallback(() => pannerRef.current!.getMasterAnalyserNodeL(), []);
  const getMasterAnalyserNodeR = useCallback(() => pannerRef.current!.getMasterAnalyserNodeR(), []);
  const setMasterVolume = useCallback((db: number) => {
    const panner = pannerRef.current!;
    panner.setMasterVolume(db);
    setMasterVolumeState(panner.masterVolume);
  }, []);

  return {
    isEnabled,
    pan,
    masterVolume,
    setPan,
    setEnabled,
    connectSource,
    setMasterVolume,
    getPannerNode,
    getGainNode,
    getMasterGainNode,
    getAnalyserNode,
    getAnalyserNodeL,
    getAnalyserNodeR,
    getMasterAnalyserNode,
    getMasterAnalyserNodeL,
    getMasterAnalyserNodeR,
  };
}
