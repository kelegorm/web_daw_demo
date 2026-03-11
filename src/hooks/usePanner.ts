import { useRef, useCallback, useState } from 'react';
import * as Tone from 'tone';
import {
  PANNER_ENABLED_DEFAULT,
  PANNER_PAN_DEFAULT,
} from '../audio/parameterDefaults';

export interface PannerGraph {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly pan: number;
  readonly isEnabled: boolean;
  setPan(value: number): void;
  setEnabled(enabled: boolean): void;
  connectSource(source: AudioNode | Tone.ToneAudioNode): void;
  dispose(): void;
}

export interface PannerHook {
  readonly pan: number;
  readonly isEnabled: boolean;
  setPan(value: number): void;
  setEnabled(enabled: boolean): void;
}

function safeDisconnect(node: { disconnect?: () => void } | null | undefined): void {
  if (!node?.disconnect) return;
  try { node.disconnect(); } catch { /* ignore */ }
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
    get input() { return inputGain; },
    get output() { return outputGain; },
    get pan() { return pan; },
    get isEnabled() { return enabled; },
    setPan,
    setEnabled,
    connectSource,
    dispose() {
      safeDisconnect(inputGain);
      safeDisconnect(pannerNode);
      safeDisconnect(outputGain);
    },
  };
}

export function usePanner(existingPanner: PannerHook): PannerHook {
  const pannerRef = useRef<PannerHook>(existingPanner);
  pannerRef.current = existingPanner;

  const [isEnabled, setIsEnabledState] = useState(() => pannerRef.current.isEnabled);
  const [pan, setPanState] = useState(() => pannerRef.current.pan);

  const setPan = useCallback((value: number) => {
    const panner = pannerRef.current;
    panner.setPan(value);
    setPanState(panner.pan);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    const panner = pannerRef.current;
    panner.setEnabled(enabled);
    setIsEnabledState(panner.isEnabled);
  }, []);

  return {
    isEnabled,
    pan,
    setPan,
    setEnabled,
  };
}
