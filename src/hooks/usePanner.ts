import { useRef, useCallback, useState } from 'react';
import * as Tone from 'tone';
import {
  PANNER_ENABLED_DEFAULT,
  PANNER_PAN_DEFAULT,
} from '../audio/parameterDefaults';

export interface PannerGraph {
  pan: number;
  setPan: (value: number) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
  getInputNode: () => GainNode;
  getOutputNode: () => GainNode;
  connectSource: (source: AudioNode | Tone.ToneAudioNode) => void;
  getPannerNode: () => StereoPannerNode;
}

export function createPanner(audioContext?: AudioContext): PannerGraph {
  const context = audioContext ?? (Tone.getContext().rawContext as AudioContext);

  const inputGain = context.createGain();
  const pannerNode = context.createStereoPanner();
  const outputGain = context.createGain();

  inputGain.connect(pannerNode);
  pannerNode.connect(outputGain);

  let enabled = PANNER_ENABLED_DEFAULT;
  let pan = PANNER_PAN_DEFAULT;

  function setPan(value: number) {
    pan = Math.max(-1, Math.min(1, value));
    pannerNode.pan.value = pan;
  }

  function setEnabled(isEnabled: boolean) {
    if (isEnabled === enabled) return;
    enabled = isEnabled;

    if (!isEnabled) {
      // Bypass panner stage: input -> output
      inputGain.disconnect(pannerNode);
      inputGain.connect(outputGain);
    } else {
      // Restore panner stage
      inputGain.disconnect(outputGain);
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

  return {
    get pan() {
      return pan;
    },
    get isEnabled() {
      return enabled;
    },
    setPan,
    setEnabled,
    getInputNode: () => inputGain,
    getOutputNode: () => outputGain,
    connectSource,
    getPannerNode: () => pannerNode,
  };
}

export interface PannerHook extends PannerGraph {
  isEnabled: boolean;
  pan: number;
}

export function usePanner(existingPanner: PannerGraph): PannerHook {
  const pannerRef = useRef<PannerGraph>(existingPanner);
  pannerRef.current = existingPanner;

  const [isEnabled, setIsEnabledState] = useState(() => pannerRef.current!.isEnabled);
  const [pan, setPanState] = useState(() => pannerRef.current!.pan);

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

  const getInputNode = useCallback(() => pannerRef.current!.getInputNode(), []);
  const getOutputNode = useCallback(() => pannerRef.current!.getOutputNode(), []);
  const connectSource = useCallback((source: AudioNode | Tone.ToneAudioNode) => {
    pannerRef.current!.connectSource(source);
  }, []);
  const getPannerNode = useCallback(() => pannerRef.current!.getPannerNode(), []);

  return {
    isEnabled,
    pan,
    setPan,
    setEnabled,
    getInputNode,
    getOutputNode,
    connectSource,
    getPannerNode,
  };
}
