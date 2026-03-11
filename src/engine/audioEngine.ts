import { createLimiter, type LimiterGraph } from '../hooks/useLimiter';
import { createMasterStrip, type MasterStripGraph } from '../hooks/useMasterStrip';
import { createPanner, type PannerGraph } from '../hooks/usePanner';
import { createToneSynth, type ToneSynthHook } from '../hooks/useToneSynth';
import { createTrackStrip, type TrackStripGraph } from '../hooks/useTrackStrip';
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

export interface AudioEngine {
  synth: ToneSynthHook;
  panner: PannerGraph;
  trackStrip: TrackStripGraph;
  limiter: LimiterGraph;
  masterStrip: MasterStripGraph;
  destination: AudioDestinationNode;
  meterTaps: {
    trackLeft: AnalyserNode;
    trackRight: AnalyserNode;
    masterLeft: AnalyserNode;
    masterRight: AnalyserNode;
    limiterInputLeft: AnalyserNode;
    limiterInputRight: AnalyserNode;
  };
  dispose: () => void;
}

export interface AudioEngineFactories {
  createSynth: () => ToneSynthHook;
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
  const audioContext = panner.getInputNode().context as AudioContext;
  const trackStrip = factories.createTrackStripModule(audioContext);
  const limiter = factories.createLimiterModule(audioContext);
  const masterStrip = factories.createMasterStripModule(audioContext);
  const destination = audioContext.destination;
  const synthOutputNode = synth.getOutput();
  const synthNode = synth.getSynth();
  const pannerInputNode = panner.getInputNode();
  const pannerOutputNode = panner.getOutputNode();
  const pannerNode = panner.getPannerNode();
  const trackStripInputNode = trackStrip.getInputNode();
  const trackStripOutputNode = trackStrip.getOutputNode();
  const trackGainNode = trackStrip.getTrackGainNode();
  const trackAnalyserNode = trackStrip.getAnalyserNode();
  const trackLeftAnalyserNode = trackStrip.getAnalyserNodeL();
  const trackRightAnalyserNode = trackStrip.getAnalyserNodeR();
  const limiterInputNode = limiter.getInputNode();
  const limiterOutputNode = limiter.getOutputNode();
  const limiterNode = limiter.getLimiterNode();
  const limiterLeftInputAnalyser = limiter.getInputAnalyserNodeL();
  const limiterRightInputAnalyser = limiter.getInputAnalyserNodeR();
  const masterStripInputNode = masterStrip.getInputNode();
  const masterStripOutputNode = masterStrip.getOutputNode();
  const masterGainNode = masterStrip.getMasterGainNode();
  const masterAnalyserNode = masterStrip.getAnalyserNode();
  const masterLeftAnalyserNode = masterStrip.getAnalyserNodeL();
  const masterRightAnalyserNode = masterStrip.getAnalyserNodeR();

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
        safeDisconnect(synthNode as unknown as Disconnectable);
        safeDispose(synthOutputNode as unknown as Disposable);
        safeDispose(synthNode as unknown as Disposable);
      },
    },
    {
      id: 'panner',
      input: pannerInputNode,
      output: pannerOutputNode,
      dispose: () => {
        safeDisconnect(pannerInputNode);
        safeDisconnect(pannerNode);
        safeDisconnect(pannerOutputNode);
      },
    },
    {
      id: 'track-strip',
      input: trackStripInputNode,
      output: trackStripOutputNode,
      dispose: () => {
        safeDisconnect(trackStripInputNode);
        safeDisconnect(trackGainNode);
        safeDisconnect(trackAnalyserNode);
        safeDisconnect(trackLeftAnalyserNode);
        safeDisconnect(trackRightAnalyserNode);
        safeDisconnect(trackStripOutputNode);
      },
    },
    {
      id: 'limiter',
      input: limiterInputNode,
      output: limiterOutputNode,
      dispose: () => {
        safeDisconnect(limiterInputNode);
        safeDisconnect(limiterNode);
        safeDisconnect(limiterLeftInputAnalyser);
        safeDisconnect(limiterRightInputAnalyser);
        safeDisconnect(limiterOutputNode);
      },
    },
    {
      id: 'master-strip',
      input: masterStripInputNode,
      output: masterStripOutputNode,
      dispose: () => {
        safeDisconnect(masterStripInputNode);
        safeDisconnect(masterGainNode);
        safeDisconnect(masterAnalyserNode);
        safeDisconnect(masterLeftAnalyserNode);
        safeDisconnect(masterRightAnalyserNode);
        safeDisconnect(masterStripOutputNode);
      },
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

  const meterTaps = {
    trackLeft: trackLeftAnalyserNode,
    trackRight: trackRightAnalyserNode,
    masterLeft: masterLeftAnalyserNode,
    masterRight: masterRightAnalyserNode,
    limiterInputLeft: limiterLeftInputAnalyser,
    limiterInputRight: limiterRightInputAnalyser,
  };

  const makePublicMethodsNoop = () => {
    synth.noteOn = () => {};
    synth.noteOff = () => {};
    synth.panic = () => {};
    synth.setFilterCutoff = () => {};
    synth.setVoiceSpread = () => {};
    synth.setVolume = () => {};
    synth.setEnabled = () => {};
    synth.getSynth = () => null;
    synth.getOutput = () => synthOutputNode;

    panner.setPan = () => {};
    panner.setEnabled = () => {};
    panner.connectSource = () => {};

    trackStrip.setTrackVolume = () => {};
    trackStrip.setTrackMuted = () => {};

    limiter.setThreshold = () => {};
    limiter.setEnabled = () => {};
    limiter.getReductionDb = () => 0;

    masterStrip.setMasterVolume = () => {};
  };

  return {
    synth,
    panner,
    trackStrip,
    limiter,
    masterStrip,
    destination,
    meterTaps,
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

      makePublicMethodsNoop();
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
