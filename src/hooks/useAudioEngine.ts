import { useRef, useCallback } from 'react';

export interface AudioEngine {
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
  panic: () => void;
  setParam: (name: string, value: number) => void;
  getAnalyserNode: () => AnalyserNode | null;
  getAudioContext: () => AudioContext | null;
  initAudio: () => Promise<void>;
}

export function createAudioEngine(): AudioEngine {
  let context: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let analyserNode: AnalyserNode | null = null;

  async function initAudio() {
    if (context) return;

    context = new AudioContext();
    await context.audioWorklet.addModule('/src/worklets/synth-processor.js');

    workletNode = new AudioWorkletNode(context, 'synth-processor');

    const response = await fetch('/synth.wasm');
    const buffer = await response.arrayBuffer();
    workletNode.port.postMessage({ type: 'load-wasm', buffer });

    analyserNode = context.createAnalyser();
    workletNode.connect(analyserNode);
    analyserNode.connect(context.destination);
  }

  function noteOn(midi: number) {
    workletNode?.port.postMessage({ type: 'noteOn', note: midi });
  }

  function noteOff(_midi: number) {
    workletNode?.port.postMessage({ type: 'noteOff' });
  }

  function panic() {
    workletNode?.port.postMessage({ type: 'panic' });
  }

  function setParam(name: string, value: number) {
    if (!workletNode) return;
    const param = workletNode.parameters.get(name);
    if (param) param.setValueAtTime(value, 0);
  }

  function getAnalyserNode() {
    return analyserNode;
  }

  function getAudioContext() {
    return context;
  }

  return { initAudio, noteOn, noteOff, panic, setParam, getAnalyserNode, getAudioContext };
}

export interface AudioEngineHook {
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
  panic: () => void;
  setParam: (name: string, value: number) => void;
  analyserNode: AnalyserNode | null;
  getAudioContext: () => AudioContext | null;
  initAudio: () => Promise<void>;
}

export function useAudioEngine(): AudioEngineHook {
  const engineRef = useRef<AudioEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = createAudioEngine();
  }

  const engine = engineRef.current;

  const initAudio = useCallback(() => engine.initAudio(), [engine]);
  const noteOn = useCallback((midi: number) => engine.noteOn(midi), [engine]);
  const noteOff = useCallback((midi: number) => engine.noteOff(midi), [engine]);
  const panic = useCallback(() => engine.panic(), [engine]);
  const setParam = useCallback((name: string, value: number) => engine.setParam(name, value), [engine]);
  const getAudioContext = useCallback(() => engine.getAudioContext(), [engine]);

  return {
    noteOn,
    noteOff,
    panic,
    setParam,
    analyserNode: engine.getAnalyserNode(),
    getAudioContext,
    initAudio,
  };
}
