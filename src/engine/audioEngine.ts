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

  const synthOutputPort: AudioPort = {
    connect: () => {
      panner.connectSource(synth.getOutput());
    },
    disconnect: () => {
      try {
        synth.getOutput().disconnect();
      } catch {
        // Ignore disconnect errors during teardown.
      }
    },
  };

  const modules: GraphModuleSpec[] = [
    { id: 'synth', output: synthOutputPort, dispose: () => {} },
    { id: 'panner', input: panner.getInputNode(), output: panner.getOutputNode(), dispose: () => {} },
    { id: 'track-strip', input: trackStrip.getInputNode(), output: trackStrip.getOutputNode(), dispose: () => {} },
    { id: 'limiter', input: limiter.getInputNode(), output: limiter.getOutputNode(), dispose: () => {} },
    { id: 'master-strip', input: masterStrip.getInputNode(), output: masterStrip.getOutputNode(), dispose: () => {} },
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

  return {
    synth,
    panner,
    trackStrip,
    limiter,
    masterStrip,
    destination,
    meterTaps: {
      trackLeft: trackStrip.getAnalyserNodeL(),
      trackRight: trackStrip.getAnalyserNodeR(),
      masterLeft: masterStrip.getAnalyserNodeL(),
      masterRight: masterStrip.getAnalyserNodeR(),
      limiterInputLeft: limiter.getInputAnalyserNodeL(),
      limiterInputRight: limiter.getInputAnalyserNodeR(),
    },
    dispose: () => {
      for (const edge of edges) {
        const fromModule = getModuleById(modules, edge.from)!;
        const toModule = getModuleById(modules, edge.to)!;

        try {
          fromModule.output?.disconnect?.(toModule.input);
        } catch {
          // Ignore disconnect errors during teardown.
        }
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
