import { useRef, useCallback, useState } from 'react';
import * as Tone from 'tone';

export interface PannerGraph {
  setPan: (value: number) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
  connectSource: (source: AudioNode | Tone.ToneAudioNode) => void;
  getPannerNode: () => StereoPannerNode;
  getGainNode: () => GainNode;
  getAnalyserNode: () => AnalyserNode;
  getAnalyserNodeL: () => AnalyserNode;
  getAnalyserNodeR: () => AnalyserNode;
  getMasterAnalyserNode: () => AnalyserNode;
  getMasterAnalyserNodeL: () => AnalyserNode;
  getMasterAnalyserNodeR: () => AnalyserNode;
  setMasterVolume: (db: number) => void;
}

export function createPanner(): PannerGraph {
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

  // Default chain (enabled): inputGain -> panner -> gain -> analyser -> masterGain -> masterAnalyser -> destination
  inputGain.connect(pannerNode);
  pannerNode.connect(gainNode);
  gainNode.connect(analyserNode);
  analyserNode.connect(masterGainNode);
  masterGainNode.connect(masterAnalyserNode);
  masterAnalyserNode.connect(audioContext.destination);

  // Stereo per-channel analysis branches (silent — no downstream connection needed)
  analyserNode.connect(channelSplitter);
  channelSplitter.connect(analyserNodeL, 0);
  channelSplitter.connect(analyserNodeR, 1);

  masterAnalyserNode.connect(masterChannelSplitter);
  masterChannelSplitter.connect(masterAnalyserNodeL, 0);
  masterChannelSplitter.connect(masterAnalyserNodeR, 1);

  let enabled = true;

  function setPan(value: number) {
    pannerNode.pan.value = Math.max(-1, Math.min(1, value));
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
    const linear = isFinite(db) ? Math.pow(10, db / 20) : 0;
    masterGainNode.gain.value = linear;
    try {
      Tone.getDestination().volume.value = isFinite(db) ? db : -Infinity;
    } catch {
      // Tone.Destination may not be in signal chain
    }
  }

  return {
    get isEnabled() {
      return enabled;
    },
    setPan,
    setEnabled,
    connectSource,
    setMasterVolume,
    getPannerNode: () => pannerNode,
    getGainNode: () => gainNode,
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
}

export function usePanner(): PannerHook {
  const pannerRef = useRef<PannerGraph | null>(null);
  const [isEnabled, setIsEnabledState] = useState(true);

  if (!pannerRef.current) {
    pannerRef.current = createPanner();
  }

  const setPan = useCallback((value: number) => {
    pannerRef.current!.setPan(value);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    pannerRef.current!.setEnabled(enabled);
    setIsEnabledState(enabled);
  }, []);

  const connectSource = useCallback((source: AudioNode | Tone.ToneAudioNode) => {
    pannerRef.current!.connectSource(source);
  }, []);

  const getPannerNode = useCallback(() => pannerRef.current!.getPannerNode(), []);
  const getGainNode = useCallback(() => pannerRef.current!.getGainNode(), []);
  const getAnalyserNode = useCallback(() => pannerRef.current!.getAnalyserNode(), []);
  const getAnalyserNodeL = useCallback(() => pannerRef.current!.getAnalyserNodeL(), []);
  const getAnalyserNodeR = useCallback(() => pannerRef.current!.getAnalyserNodeR(), []);
  const getMasterAnalyserNode = useCallback(() => pannerRef.current!.getMasterAnalyserNode(), []);
  const getMasterAnalyserNodeL = useCallback(() => pannerRef.current!.getMasterAnalyserNodeL(), []);
  const getMasterAnalyserNodeR = useCallback(() => pannerRef.current!.getMasterAnalyserNodeR(), []);
  const setMasterVolume = useCallback((db: number) => pannerRef.current!.setMasterVolume(db), []);

  return {
    isEnabled,
    setPan,
    setEnabled,
    connectSource,
    setMasterVolume,
    getPannerNode,
    getGainNode,
    getAnalyserNode,
    getAnalyserNodeL,
    getAnalyserNodeR,
    getMasterAnalyserNode,
    getMasterAnalyserNodeL,
    getMasterAnalyserNodeR,
  };
}
