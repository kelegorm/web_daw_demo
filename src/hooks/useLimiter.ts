import { useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';
import {
  LIMITER_ENABLED_DEFAULT,
  LIMITER_THRESHOLD_DEFAULT_DB,
} from '../audio/parameterDefaults';
import { createMeterSource } from '../engine/meterSource';
import type { MeterSource } from '../engine/types';

export interface LimiterGraph {
  readonly input: AudioNode;
  readonly output: AudioNode;
  readonly isEnabled: boolean;
  readonly threshold: number;
  setThreshold(db: number): void;
  setEnabled(enabled: boolean): void;
  getReductionDb(): number;
  readonly meterSource: MeterSource;
  dispose(): void;
}

export interface LimiterHook {
  readonly isEnabled: boolean;
  readonly threshold: number;
  setThreshold(db: number): void;
  setEnabled(enabled: boolean): void;
  getReductionDb(): number;
  readonly meterSource: MeterSource;
}

function safeDisconnect(node: { disconnect?: () => void } | null | undefined): void {
  if (!node?.disconnect) return;
  try { node.disconnect(); } catch { /* ignore */ }
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

  const meterSource = createMeterSource(inputAnalyserNodeL, inputAnalyserNodeR);

  return {
    get input() { return inputNode; },
    get output() { return outputNode; },
    get isEnabled() { return enabled; },
    get threshold() { return currentThreshold; },
    setThreshold,
    setEnabled,
    getReductionDb,
    meterSource,
    dispose() {
      safeDisconnect(inputNode);
      safeDisconnect(compressor);
      safeDisconnect(inputChannelSplitter);
      safeDisconnect(inputAnalyserNodeL);
      safeDisconnect(inputAnalyserNodeR);
      safeDisconnect(outputNode);
    },
  };
}

export function useLimiter(existingLimiter: LimiterHook): LimiterHook {
  const limiterRef = useRef<LimiterHook>(existingLimiter);
  limiterRef.current = existingLimiter;

  const [isEnabled, setIsEnabledState] = useState(() => limiterRef.current.isEnabled);
  const [threshold, setThresholdState] = useState(() => limiterRef.current.threshold);

  const setThreshold = useCallback((db: number) => {
    limiterRef.current.setThreshold(db);
    setThresholdState(limiterRef.current.threshold);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    limiterRef.current.setEnabled(enabled);
    setIsEnabledState(limiterRef.current.isEnabled);
  }, []);

  const getReductionDb = useCallback(() => limiterRef.current.getReductionDb(), []);

  return {
    isEnabled,
    threshold,
    setThreshold,
    setEnabled,
    getReductionDb,
    get meterSource() { return limiterRef.current.meterSource; },
  };
}
