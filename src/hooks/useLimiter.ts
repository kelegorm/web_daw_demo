import { useRef, useState, useCallback } from 'react';
import {
  LIMITER_ENABLED_DEFAULT,
  LIMITER_THRESHOLD_DEFAULT_DB,
} from '../audio/parameterDefaults';

export interface LimiterGraph {
  setThreshold: (db: number) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
  threshold: number;
  /**
   * Returns gain reduction in dB (>= 0).
   */
  getReductionDb: () => number;
  getInputAnalyserNodeL: () => AnalyserNode;
  getInputAnalyserNodeR: () => AnalyserNode;
  getLimiterNode: () => DynamicsCompressorNode;
}

export function createLimiter(masterGainNode: AudioNode, masterAnalyserNode: AudioNode): LimiterGraph {
  const REDUCTION_EPSILON_DB = 0.05;
  const audioContext = masterGainNode.context as AudioContext;
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = LIMITER_THRESHOLD_DEFAULT_DB;
  compressor.knee.value = 0;      // Hard knee
  compressor.ratio.value = 20;    // High ratio ≈ limiter
  compressor.attack.value = 0.001;
  compressor.release.value = 0.1;
  const inputChannelSplitter = audioContext.createChannelSplitter(2);
  const inputAnalyserNodeL = audioContext.createAnalyser();
  const inputAnalyserNodeR = audioContext.createAnalyser();

  let enabled = LIMITER_ENABLED_DEFAULT;
  let currentThreshold = LIMITER_THRESHOLD_DEFAULT_DB;

  // Insert limiter inline:
  // masterGain → compressor → masterAnalyser
  try {
    masterGainNode.disconnect(masterAnalyserNode);
  } catch {
    // No direct connection existed
  }
  masterGainNode.connect(compressor);
  compressor.connect(masterAnalyserNode);
  masterGainNode.connect(inputChannelSplitter);
  inputChannelSplitter.connect(inputAnalyserNodeL, 0);
  inputChannelSplitter.connect(inputAnalyserNodeR, 1);

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
      compressor.disconnect(masterAnalyserNode);
      masterGainNode.connect(masterAnalyserNode);
    } else {
      // Restore compressor in chain
      masterGainNode.disconnect(masterAnalyserNode);
      masterGainNode.connect(compressor);
      compressor.connect(masterAnalyserNode);
    }
  }

  function getReductionDb(): number {
    if (!enabled) return 0;
    const reduction = compressor.reduction;
    if (!Number.isFinite(reduction)) return 0;
    const reductionDb = Math.max(0, -reduction);
    if (reductionDb < REDUCTION_EPSILON_DB) return 0;
    return reductionDb;
  }

  return {
    get isEnabled() { return enabled; },
    get threshold() { return currentThreshold; },
    setThreshold,
    setEnabled,
    getReductionDb,
    getInputAnalyserNodeL: () => inputAnalyserNodeL,
    getInputAnalyserNodeR: () => inputAnalyserNodeR,
    getLimiterNode: () => compressor,
  };
}

export interface LimiterHook extends LimiterGraph {}

export function useLimiter(masterGainNode: AudioNode, masterAnalyserNode: AudioNode): LimiterHook {
  const limiterRef = useRef<LimiterGraph | null>(null);
  const [isEnabled, setIsEnabledState] = useState(LIMITER_ENABLED_DEFAULT);
  const [threshold, setThresholdState] = useState(LIMITER_THRESHOLD_DEFAULT_DB);

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

  const getReductionDb = useCallback(() => limiterRef.current!.getReductionDb(), []);
  const getInputAnalyserNodeL = useCallback(() => limiterRef.current!.getInputAnalyserNodeL(), []);
  const getInputAnalyserNodeR = useCallback(() => limiterRef.current!.getInputAnalyserNodeR(), []);
  const getLimiterNode = useCallback(() => limiterRef.current!.getLimiterNode(), []);

  return {
    isEnabled,
    threshold,
    setThreshold,
    setEnabled,
    getReductionDb,
    getInputAnalyserNodeL,
    getInputAnalyserNodeR,
    getLimiterNode,
  };
}
