import { useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';
import {
  AUDIO_DB_MAX,
  AUDIO_DB_MIN,
  MASTER_VOLUME_DEFAULT_DB,
} from '../audio/parameterDefaults';

export interface MasterStripGraph {
  masterVolume: number;
  setMasterVolume: (db: number) => void;
  getInputNode: () => GainNode;
  getOutputNode: () => GainNode;
  getMasterGainNode: () => GainNode;
  getAnalyserNode: () => AnalyserNode;
  getAnalyserNodeL: () => AnalyserNode;
  getAnalyserNodeR: () => AnalyserNode;
}

function dbToLinear(db: number): number {
  if (!isFinite(db)) return 0;
  return Math.pow(10, db / 20);
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

  return {
    get masterVolume() {
      return masterVolume;
    },
    setMasterVolume,
    getInputNode: () => inputGain,
    getOutputNode: () => outputGain,
    getMasterGainNode: () => masterGainNode,
    getAnalyserNode: () => analyserNode,
    getAnalyserNodeL: () => analyserNodeL,
    getAnalyserNodeR: () => analyserNodeR,
  };
}

export interface MasterStripHook extends MasterStripGraph {}

export function useMasterStrip(existingMasterStrip: MasterStripGraph): MasterStripHook {
  const masterStripRef = useRef<MasterStripGraph>(existingMasterStrip);
  masterStripRef.current = existingMasterStrip;

  const [masterVolume, setMasterVolumeState] = useState(() => masterStripRef.current!.masterVolume);

  const setMasterVolume = useCallback((db: number) => {
    const strip = masterStripRef.current!;
    strip.setMasterVolume(db);
    setMasterVolumeState(strip.masterVolume);
  }, []);

  const getInputNode = useCallback(() => masterStripRef.current!.getInputNode(), []);
  const getOutputNode = useCallback(() => masterStripRef.current!.getOutputNode(), []);
  const getMasterGainNode = useCallback(() => masterStripRef.current!.getMasterGainNode(), []);
  const getAnalyserNode = useCallback(() => masterStripRef.current!.getAnalyserNode(), []);
  const getAnalyserNodeL = useCallback(() => masterStripRef.current!.getAnalyserNodeL(), []);
  const getAnalyserNodeR = useCallback(() => masterStripRef.current!.getAnalyserNodeR(), []);

  return {
    masterVolume,
    setMasterVolume,
    getInputNode,
    getOutputNode,
    getMasterGainNode,
    getAnalyserNode,
    getAnalyserNodeL,
    getAnalyserNodeR,
  };
}
