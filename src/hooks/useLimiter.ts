import { useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';

export interface LimiterGraph {
  setThreshold: (db: number) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
  threshold: number;
  getLimiterNode: () => Tone.Limiter;
}

export function createLimiter(masterGainNode: AudioNode, masterAnalyserNode: AudioNode): LimiterGraph {
  const limiterNode = new Tone.Limiter(-3);
  let enabled = true;
  let currentThreshold = -3;

  // Insert limiter: masterGain → limiter → masterAnalyser
  // Disconnect existing masterGain → masterAnalyser connection
  try {
    masterGainNode.disconnect(masterAnalyserNode);
  } catch {
    // No direct connection existed
  }
  masterGainNode.connect(limiterNode.input as unknown as AudioNode);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (limiterNode as any).output.connect(masterAnalyserNode);

  function setThreshold(db: number) {
    currentThreshold = db;
    limiterNode.threshold.value = db;
  }

  function setEnabled(isEnabled: boolean) {
    if (isEnabled === enabled) return;
    enabled = isEnabled;

    if (!isEnabled) {
      // Bypass: disconnect masterGain from limiter, connect directly to masterAnalyser
      masterGainNode.disconnect(limiterNode.input as unknown as AudioNode);
      masterGainNode.connect(masterAnalyserNode);
    } else {
      // Restore limiter in chain
      masterGainNode.disconnect(masterAnalyserNode);
      masterGainNode.connect(limiterNode.input as unknown as AudioNode);
    }
  }

  return {
    get isEnabled() { return enabled; },
    get threshold() { return currentThreshold; },
    setThreshold,
    setEnabled,
    getLimiterNode: () => limiterNode,
  };
}

export interface LimiterHook extends LimiterGraph {}

export function useLimiter(masterGainNode: AudioNode, masterAnalyserNode: AudioNode): LimiterHook {
  const limiterRef = useRef<LimiterGraph | null>(null);
  const [isEnabled, setIsEnabledState] = useState(true);
  const [threshold, setThresholdState] = useState(-3);

  if (!limiterRef.current) {
    limiterRef.current = createLimiter(masterGainNode, masterAnalyserNode);
  }

  const setThreshold = useCallback((db: number) => {
    limiterRef.current!.setThreshold(db);
    setThresholdState(db);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    limiterRef.current!.setEnabled(enabled);
    setIsEnabledState(enabled);
  }, []);

  const getLimiterNode = useCallback(() => limiterRef.current!.getLimiterNode(), []);

  return {
    isEnabled,
    threshold,
    setThreshold,
    setEnabled,
    getLimiterNode,
  };
}
