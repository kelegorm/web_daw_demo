import { useRef, useState, useCallback } from 'react';
import {
  LIMITER_ENABLED_DEFAULT,
  LIMITER_THRESHOLD_DEFAULT_DB,
} from '../audio/parameterDefaults';
import { computeGainReduction } from '../audio/gainReductionMath';

export interface LimiterGraph {
  setThreshold: (db: number) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: boolean;
  threshold: number;
  /**
   * Returns normalized gain reduction in range [0..1].
   * 0 means no reduction, 1 means full-scale reduction for the configured meter window.
   */
  getReductionNorm: () => number;
  getLimiterNode: () => DynamicsCompressorNode;
}

export function createLimiter(masterGainNode: AudioNode, masterAnalyserNode: AudioNode): LimiterGraph {
  const audioContext = masterGainNode.context as AudioContext;
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = LIMITER_THRESHOLD_DEFAULT_DB;
  compressor.knee.value = 0;      // Hard knee
  compressor.ratio.value = 20;    // High ratio ≈ limiter
  compressor.attack.value = 0.001;
  compressor.release.value = 0.1;
  const preLimiterAnalyser = audioContext.createAnalyser();
  const postLimiterAnalyser = audioContext.createAnalyser();
  preLimiterAnalyser.fftSize = 1024;
  postLimiterAnalyser.fftSize = 1024;
  preLimiterAnalyser.smoothingTimeConstant = 0;
  postLimiterAnalyser.smoothingTimeConstant = 0;
  const preData = new Float32Array(preLimiterAnalyser.fftSize);
  const postData = new Float32Array(postLimiterAnalyser.fftSize);

  let enabled = LIMITER_ENABLED_DEFAULT;
  let currentThreshold = LIMITER_THRESHOLD_DEFAULT_DB;

  // Insert limiter inline so analysers are always in active graph:
  // masterGain → preAnalyser → compressor → postAnalyser → masterAnalyser
  try {
    masterGainNode.disconnect(masterAnalyserNode);
  } catch {
    // No direct connection existed
  }
  masterGainNode.connect(preLimiterAnalyser);
  preLimiterAnalyser.connect(compressor);
  compressor.connect(postLimiterAnalyser);
  postLimiterAnalyser.connect(masterAnalyserNode);

  function setThreshold(db: number) {
    currentThreshold = db;
    compressor.threshold.value = db;
  }

  function setEnabled(isEnabled: boolean) {
    if (isEnabled === enabled) return;
    enabled = isEnabled;

    if (!isEnabled) {
      // Bypass: masterGain connects directly to masterAnalyser
      masterGainNode.disconnect(preLimiterAnalyser);
      postLimiterAnalyser.disconnect(masterAnalyserNode);
      masterGainNode.connect(masterAnalyserNode);
    } else {
      // Restore compressor in chain
      masterGainNode.disconnect(masterAnalyserNode);
      masterGainNode.connect(preLimiterAnalyser);
      postLimiterAnalyser.connect(masterAnalyserNode);
    }
  }

  function peakDb(analyser: AnalyserNode, buffer: Float32Array): number {
    analyser.getFloatTimeDomainData(buffer);
    let peak = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const x = Math.abs(buffer[i]);
      if (x > peak) peak = x;
    }
    const safe = Math.max(peak, 1e-6);
    return 20 * Math.log10(safe);
  }

  function getReductionNorm(): number {
    if (!enabled) return 0;

    const inDb = peakDb(preLimiterAnalyser, preData);
    if (!Number.isFinite(inDb) || inDb < -70) {
      return 0;
    }

    const outDb = peakDb(postLimiterAnalyser, postData);
    if (!Number.isFinite(outDb)) {
      return 0;
    }

    return computeGainReduction(inDb, outDb);
  }

  return {
    get isEnabled() { return enabled; },
    get threshold() { return currentThreshold; },
    setThreshold,
    setEnabled,
    getReductionNorm,
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

  const getReductionNorm = useCallback(() => limiterRef.current!.getReductionNorm(), []);
  const getLimiterNode = useCallback(() => limiterRef.current!.getLimiterNode(), []);

  return {
    isEnabled,
    threshold,
    setThreshold,
    setEnabled,
    getReductionNorm,
    getLimiterNode,
  };
}
