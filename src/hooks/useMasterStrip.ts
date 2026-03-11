import { useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';
import {
  AUDIO_DB_MAX,
  AUDIO_DB_MIN,
  MASTER_VOLUME_DEFAULT_DB,
} from '../audio/parameterDefaults';
import { createMeterSource } from '../engine/meterSource';
import type { MeterSource } from '../engine/types';

export interface MasterStripGraph {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly masterVolume: number;
  setMasterVolume(db: number): void;
  readonly meterSource: MeterSource;
  dispose(): void;
}

export interface MasterStripHook {
  readonly masterVolume: number;
  setMasterVolume(db: number): void;
  readonly meterSource: MeterSource;
}

function dbToLinear(db: number): number {
  if (!isFinite(db)) return 0;
  return Math.pow(10, db / 20);
}

function safeDisconnect(node: { disconnect?: () => void } | null | undefined): void {
  if (!node?.disconnect) return;
  try { node.disconnect(); } catch { /* ignore */ }
}

export function createMasterStrip(audioContext?: AudioContext): MasterStripGraph {
  const context = audioContext ?? (Tone.getContext().rawContext as AudioContext);

  const inputGain = context.createGain();
  const masterGainNode = context.createGain();
  const analyserNode = context.createAnalyser();
  const channelSplitter = context.createChannelSplitter(2);
  const analyserNodeL = context.createAnalyser();
  const analyserNodeR = context.createAnalyser();
  const outputGain = context.createGain();

  inputGain.connect(masterGainNode);
  masterGainNode.connect(analyserNode);
  analyserNode.connect(outputGain);

  analyserNode.connect(channelSplitter);
  channelSplitter.connect(analyserNodeL, 0);
  channelSplitter.connect(analyserNodeR, 1);

  let masterVolume = MASTER_VOLUME_DEFAULT_DB;

  function setMasterVolume(db: number) {
    masterVolume = isFinite(db)
      ? Math.max(AUDIO_DB_MIN, Math.min(AUDIO_DB_MAX, db))
      : -Infinity;
    masterGainNode.gain.value = dbToLinear(masterVolume);
  }

  setMasterVolume(masterVolume);

  const meterSource = createMeterSource(analyserNodeL, analyserNodeR);

  return {
    get input() { return inputGain; },
    get output() { return outputGain; },
    get masterVolume() { return masterVolume; },
    setMasterVolume,
    meterSource,
    dispose() {
      safeDisconnect(inputGain);
      safeDisconnect(masterGainNode);
      safeDisconnect(analyserNode);
      safeDisconnect(channelSplitter);
      safeDisconnect(analyserNodeL);
      safeDisconnect(analyserNodeR);
      safeDisconnect(outputGain);
    },
  };
}

export function useMasterStrip(existingMasterStrip: MasterStripHook): MasterStripHook {
  const masterStripRef = useRef<MasterStripHook>(existingMasterStrip);
  masterStripRef.current = existingMasterStrip;

  const [masterVolume, setMasterVolumeState] = useState(() => masterStripRef.current.masterVolume);

  const setMasterVolume = useCallback((db: number) => {
    const strip = masterStripRef.current;
    strip.setMasterVolume(db);
    setMasterVolumeState(strip.masterVolume);
  }, []);

  return {
    masterVolume,
    setMasterVolume,
    get meterSource() { return masterStripRef.current.meterSource; },
  };
}
