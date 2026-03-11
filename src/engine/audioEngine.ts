import { createLimiter, type LimiterGraph, type LimiterHook } from '../hooks/useLimiter';
import { createMasterStrip, type MasterStripGraph, type MasterStripHook } from '../hooks/useMasterStrip';
import { createPanner, type PannerGraph, type PannerHook } from '../hooks/usePanner';
import { createToneSynth, type ToneSynthGraph, type ToneSynthHook } from '../hooks/useToneSynth';
import { createTrackStrip, type TrackStripGraph, type TrackStripHook } from '../hooks/useTrackStrip';
import type { AudioModule } from './types';

type AudioPort = {
  connect: (...args: any[]) => any;
  disconnect?: (...args: any[]) => any;
};

type Disconnectable = {
  disconnect?: (...args: any[]) => any;
};

type Disposable = {
  dispose?: () => void;
};

export interface GraphModuleSpec extends Omit<AudioModule, 'input' | 'output'> {
  id: string;
  input?: AudioPort;
  output?: AudioPort;
}

export interface GraphEdge {
  from: string;
  to: string;
}

// AudioEngine exposes public (intent-level) hook types — no AudioNode / Tone.* leakage.
export interface AudioEngine {
  synth: ToneSynthHook;
  panner: PannerHook;
  trackStrip: TrackStripHook;
  limiter: LimiterHook;
  masterStrip: MasterStripHook;
  destination: AudioDestinationNode;
  dispose: () => void;
}

export interface AudioEngineFactories {
  createSynth: () => ToneSynthGraph;
  createPannerModule: () => PannerGraph;
  createTrackStripModule: (audioContext: AudioContext) => TrackStripGraph;
  createLimiterModule: (audioContext: AudioContext) => LimiterGraph;
  createMasterStripModule: (audioContext: AudioContext) => MasterStripGraph;
}

function safeDisconnect(node: Disconnectable | null | undefined, ...args: any[]): void {
  if (!node?.disconnect) return;
  try {
    node.disconnect(...args);
  } catch {
    // Ignore disconnect errors during teardown.
  }
}

function safeDispose(resource: Disposable | null | undefined): void {
  if (!resource?.dispose) return;
  try {
    resource.dispose();
  } catch {
    // Ignore disposal errors during teardown.
  }
}

function safeCall(callback: () => void): void {
  try {
    callback();
  } catch {
    // Ignore teardown callbacks that may throw after partial disposal.
  }
}

function getModuleById(modules: GraphModuleSpec[], id: string): GraphModuleSpec | undefined {
  return modules.find((module) => module.id === id);
}

export function validateLinearGraph(modules: GraphModuleSpec[], edges: GraphEdge[]): void {
  const moduleIndex = new Map<string, number>();

  modules.forEach((module, index) => {
    if (moduleIndex.has(module.id)) {
      throw new Error(`[audio-engine] duplicate module id: ${module.id}`);
    }
    moduleIndex.set(module.id, index);
  });

  for (const edge of edges) {
    if (edge.from === edge.to) {
      throw new Error(`[audio-engine] self-loop edge is not allowed: ${edge.from}`);
    }

    const fromModule = getModuleById(modules, edge.from);
    if (!fromModule) {
      throw new Error(`[audio-engine] missing module id referenced by edge.from: ${edge.from}`);
    }

    const toModule = getModuleById(modules, edge.to);
    if (!toModule) {
      throw new Error(`[audio-engine] missing module id referenced by edge.to: ${edge.to}`);
    }

    if (!fromModule.output) {
      throw new Error(`[audio-engine] missing from.output for module: ${edge.from}`);
    }

    if (!toModule.input) {
      throw new Error(`[audio-engine] missing to.input for module: ${edge.to}`);
    }

    const fromIndex = moduleIndex.get(edge.from)!;
    const toIndex = moduleIndex.get(edge.to)!;

    if (fromIndex > toIndex) {
      throw new Error(`[audio-engine] backward edge is not allowed: ${edge.from} -> ${edge.to}`);
    }
  }

  // Generic DFS cycle detection is intentionally out of Task 1 scope.
}

export function assembleAudioGraph(modules: GraphModuleSpec[], edges: GraphEdge[]): void {
  validateLinearGraph(modules, edges);

  for (const edge of edges) {
    const fromModule = getModuleById(modules, edge.from)!;
    const toModule = getModuleById(modules, edge.to)!;
    fromModule.output!.connect(toModule.input!);
  }
}

export function createAudioEngineWithFactories(factories: AudioEngineFactories): AudioEngine {
  const synth = factories.createSynth();
  const panner = factories.createPannerModule();
  const audioContext = panner.input.context as AudioContext;
  const trackStrip = factories.createTrackStripModule(audioContext);
  const limiter = factories.createLimiterModule(audioContext);
  const masterStrip = factories.createMasterStripModule(audioContext);
  const destination = audioContext.destination;
  const synthOutputNode = synth.getOutput();

  const synthOutputPort: AudioPort = {
    connect: () => {
      panner.connectSource(synthOutputNode);
    },
    disconnect: () => {
      safeDisconnect(synthOutputNode as unknown as Disconnectable);
    },
  };

  const modules: GraphModuleSpec[] = [
    {
      id: 'synth',
      output: synthOutputPort,
      dispose: () => {
        safeCall(() => synth.panic());
        safeDisconnect(synthOutputNode as unknown as Disconnectable);
        safeDispose(synthOutputNode as unknown as Disposable);
        safeDispose(synth.getSynth() as unknown as Disposable);
      },
    },
    {
      id: 'panner',
      input: panner.input,
      output: panner.output,
      dispose: () => safeCall(() => panner.dispose()),
    },
    {
      id: 'track-strip',
      input: trackStrip.input,
      output: trackStrip.output,
      dispose: () => safeCall(() => trackStrip.dispose()),
    },
    {
      id: 'limiter',
      input: limiter.input,
      output: limiter.output,
      dispose: () => safeCall(() => limiter.dispose()),
    },
    {
      id: 'master-strip',
      input: masterStrip.input,
      output: masterStrip.output,
      dispose: () => safeCall(() => masterStrip.dispose()),
    },
    { id: 'destination', input: destination, dispose: () => {} },
  ];

  const edges: GraphEdge[] = [
    { from: 'synth', to: 'panner' },
    { from: 'panner', to: 'track-strip' },
    { from: 'track-strip', to: 'limiter' },
    { from: 'limiter', to: 'master-strip' },
    { from: 'master-strip', to: 'destination' },
  ];

  assembleAudioGraph(modules, edges);

  let isDisposed = false;
  const isEngineDisposed = () => isDisposed;

  const synthFacade: ToneSynthHook = {
    get isEnabled() { return synth.isEnabled; },
    get filterCutoff() { return synth.filterCutoff; },
    get voiceSpread() { return synth.voiceSpread; },
    get volume() { return synth.volume; },
    noteOn: (midi, velocity) => {
      if (isEngineDisposed()) return;
      synth.noteOn(midi, velocity);
    },
    noteOff: (midi) => {
      if (isEngineDisposed()) return;
      synth.noteOff(midi);
    },
    panic: () => {
      if (isEngineDisposed()) return;
      synth.panic();
    },
    setFilterCutoff: (hz) => {
      if (isEngineDisposed()) return;
      synth.setFilterCutoff(hz);
    },
    setVoiceSpread: (value) => {
      if (isEngineDisposed()) return;
      synth.setVoiceSpread(value);
    },
    setVolume: (db) => {
      if (isEngineDisposed()) return;
      synth.setVolume(db);
    },
    setEnabled: (enabled) => {
      if (isEngineDisposed()) return;
      synth.setEnabled(enabled);
    },
  };

  const pannerFacade: PannerHook = {
    get pan() { return panner.pan; },
    get isEnabled() { return panner.isEnabled; },
    setPan: (value) => {
      if (isEngineDisposed()) return;
      panner.setPan(value);
    },
    setEnabled: (enabled) => {
      if (isEngineDisposed()) return;
      panner.setEnabled(enabled);
    },
  };

  const trackStripFacade: TrackStripHook = {
    get trackVolume() { return trackStrip.trackVolume; },
    get isTrackMuted() { return trackStrip.isTrackMuted; },
    setTrackVolume: (db) => {
      if (isEngineDisposed()) return;
      trackStrip.setTrackVolume(db);
    },
    setTrackMuted: (muted) => {
      if (isEngineDisposed()) return;
      trackStrip.setTrackMuted(muted);
    },
    get meterSource() { return trackStrip.meterSource; },
  };

  const limiterFacade: LimiterHook = {
    get isEnabled() { return limiter.isEnabled; },
    get threshold() { return limiter.threshold; },
    setThreshold: (db) => {
      if (isEngineDisposed()) return;
      limiter.setThreshold(db);
    },
    setEnabled: (enabled) => {
      if (isEngineDisposed()) return;
      limiter.setEnabled(enabled);
    },
    getReductionDb: () => (isEngineDisposed() ? 0 : limiter.getReductionDb()),
    get meterSource() { return limiter.meterSource; },
  };

  const masterStripFacade: MasterStripHook = {
    get masterVolume() { return masterStrip.masterVolume; },
    setMasterVolume: (db) => {
      if (isEngineDisposed()) return;
      masterStrip.setMasterVolume(db);
    },
    get meterSource() { return masterStrip.meterSource; },
  };

  return {
    synth: synthFacade,
    panner: pannerFacade,
    trackStrip: trackStripFacade,
    limiter: limiterFacade,
    masterStrip: masterStripFacade,
    destination,
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;

      for (const edge of edges) {
        const fromModule = getModuleById(modules, edge.from)!;
        const toModule = getModuleById(modules, edge.to)!;

        safeDisconnect(fromModule.output, toModule.input);
      }

      for (const module of modules) {
        module.dispose();
      }
    },
  };
}

export function createAudioEngine(): AudioEngine {
  return createAudioEngineWithFactories({
    createSynth: createToneSynth,
    createPannerModule: createPanner,
    createTrackStripModule: createTrackStrip,
    createLimiterModule: createLimiter,
    createMasterStripModule: createMasterStrip,
  });
}
