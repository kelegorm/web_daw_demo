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
}

export function createPanner(): PannerGraph {
  const audioContext = Tone.getContext().rawContext as AudioContext;

  // Internal graph nodes
  const inputGain = audioContext.createGain();
  const pannerNode = audioContext.createStereoPanner();
  const gainNode = audioContext.createGain(); // track mute
  const analyserNode = audioContext.createAnalyser();

  // Default chain (enabled): inputGain -> panner -> gain -> analyser -> destination
  inputGain.connect(pannerNode);
  pannerNode.connect(gainNode);
  gainNode.connect(analyserNode);
  analyserNode.connect(audioContext.destination);

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

  return {
    get isEnabled() {
      return enabled;
    },
    setPan,
    setEnabled,
    connectSource,
    getPannerNode: () => pannerNode,
    getGainNode: () => gainNode,
    getAnalyserNode: () => analyserNode,
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

  return {
    isEnabled,
    setPan,
    setEnabled,
    connectSource,
    getPannerNode,
    getGainNode,
    getAnalyserNode,
  };
}
