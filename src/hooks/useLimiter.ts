import { useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';
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
  getInputNode: () => AudioNode;
  getOutputNode: () => AudioNode;
}

export function createLimiter(audioContext?: AudioContext): LimiterGraph {
  const REDUCTION_EPSILON_DB = 0.05;
  const context = audioContext ?? (Tone.getContext().rawContext as AudioContext);
  const inputNode = context.createGain();
  const outputNode = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = LIMITER_THRESHOLD_DEFAULT_DB;
  compressor.knee.value = 0;      // Hard knee
  compressor.ratio.value = 20;    // High ratio ≈ limiter
  compressor.attack.value = 0.001;
  compressor.release.value = 0.1;
  const inputChannelSplitter = context.createChannelSplitter(2);
  const inputAnalyserNodeL = context.createAnalyser();
  const inputAnalyserNodeR = context.createAnalyser();

  let enabled = LIMITER_ENABLED_DEFAULT;
  let currentThreshold = LIMITER_THRESHOLD_DEFAULT_DB;

  inputNode.connect(compressor);
  compressor.connect(outputNode);
  inputNode.connect(inputChannelSplitter);
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
      // Bypass limiter internally while preserving external wiring.
      inputNode.disconnect(compressor);
      compressor.disconnect(outputNode);
      inputNode.connect(outputNode);
    } else {
      inputNode.disconnect(outputNode);
      inputNode.connect(compressor);
      compressor.connect(outputNode);
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
    getInputNode: () => inputNode,
    getOutputNode: () => outputNode,
  };
}

export interface LimiterHook extends LimiterGraph {}

export function useLimiter(existingLimiter: LimiterGraph): LimiterHook {
  const limiterRef = useRef<LimiterGraph>(existingLimiter);
  limiterRef.current = existingLimiter;

  const [isEnabled, setIsEnabledState] = useState(() => limiterRef.current!.isEnabled);
  const [threshold, setThresholdState] = useState(() => limiterRef.current!.threshold);

  const setThreshold = useCallback((db: number) => {
    limiterRef.current!.setThreshold(db);
    setThresholdState(limiterRef.current!.threshold);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    limiterRef.current!.setEnabled(enabled);
    setIsEnabledState(limiterRef.current!.isEnabled);
  }, []);

  const getReductionDb = useCallback(() => limiterRef.current!.getReductionDb(), []);
  const getInputAnalyserNodeL = useCallback(() => limiterRef.current!.getInputAnalyserNodeL(), []);
  const getInputAnalyserNodeR = useCallback(() => limiterRef.current!.getInputAnalyserNodeR(), []);
  const getLimiterNode = useCallback(() => limiterRef.current!.getLimiterNode(), []);
  const getInputNode = useCallback(() => limiterRef.current!.getInputNode(), []);
  const getOutputNode = useCallback(() => limiterRef.current!.getOutputNode(), []);

  return {
    isEnabled,
    threshold,
    setThreshold,
    setEnabled,
    getReductionDb,
    getInputAnalyserNodeL,
    getInputAnalyserNodeR,
    getLimiterNode,
    getInputNode,
    getOutputNode,
  };
}
