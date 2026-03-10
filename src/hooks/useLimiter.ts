import { useRef, useState, useCallback } from 'react';

export interface LimiterGraph {
  setThreshold: (db: number) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
  threshold: number;
  getLimiterNode: () => DynamicsCompressorNode;
}

export function createLimiter(masterGainNode: AudioNode, masterAnalyserNode: AudioNode): LimiterGraph {
  const audioContext = masterGainNode.context as AudioContext;
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -3;
  compressor.knee.value = 0;      // Hard knee
  compressor.ratio.value = 20;    // High ratio ≈ limiter
  compressor.attack.value = 0.001;
  compressor.release.value = 0.1;

  let enabled = true;
  let currentThreshold = -3;

  // Insert limiter: masterGain → compressor → masterAnalyser
  try {
    masterGainNode.disconnect(masterAnalyserNode);
  } catch {
    // No direct connection existed
  }
  masterGainNode.connect(compressor);
  compressor.connect(masterAnalyserNode);

  function setThreshold(db: number) {
    currentThreshold = db;
    compressor.threshold.value = db;
  }

  function setEnabled(isEnabled: boolean) {
    if (isEnabled === enabled) return;
    enabled = isEnabled;

    if (!isEnabled) {
      // Bypass: masterGain connects directly to masterAnalyser
      masterGainNode.disconnect(compressor);
      masterGainNode.connect(masterAnalyserNode);
    } else {
      // Restore compressor in chain
      masterGainNode.disconnect(masterAnalyserNode);
      masterGainNode.connect(compressor);
    }
  }

  return {
    get isEnabled() { return enabled; },
    get threshold() { return currentThreshold; },
    setThreshold,
    setEnabled,
    getLimiterNode: () => compressor,
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
