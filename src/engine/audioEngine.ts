import { createLimiter, type LimiterGraph } from '../hooks/useLimiter';
import { createPanner, type PannerGraph } from '../hooks/usePanner';
import { createToneSynth, type ToneSynthHook } from '../hooks/useToneSynth';
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
  limiter: LimiterGraph;
  master: GainNode;
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
  createLimiterModule: (audioContext: AudioContext) => LimiterGraph;
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
  const limiter = factories.createLimiterModule(audioContext);

  const master = panner.getMasterGainNode();
  const destination = audioContext.destination;
  const masterAnalyser = panner.getMasterAnalyserNode();

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

  const masterOutputPort: AudioPort = {
    connect: (destinationPort) => {
      master.connect(masterAnalyser);
      masterAnalyser.connect(destinationPort as AudioNode);
    },
    disconnect: (destinationPort) => {
      try {
        master.disconnect(masterAnalyser);
      } catch {
        // Ignore disconnect errors during teardown.
      }

      try {
        masterAnalyser.disconnect(destinationPort as AudioNode);
      } catch {
        // Ignore disconnect errors during teardown.
      }
    },
  };

  const modules: GraphModuleSpec[] = [
    { id: 'synth', output: synthOutputPort, dispose: () => {} },
    { id: 'panner', input: panner.getInputNode(), output: panner.getMixerNode(), dispose: () => {} },
    { id: 'limiter', input: limiter.getInputNode(), output: limiter.getOutputNode(), dispose: () => {} },
    { id: 'master', input: master, output: masterOutputPort, dispose: () => {} },
    { id: 'destination', input: destination, dispose: () => {} },
  ];

  const edges: GraphEdge[] = [
    { from: 'synth', to: 'panner' },
    { from: 'panner', to: 'limiter' },
    { from: 'limiter', to: 'master' },
    { from: 'master', to: 'destination' },
  ];

  assembleAudioGraph(modules, edges);

  return {
    synth,
    panner,
    limiter,
    master,
    destination,
    meterTaps: {
      trackLeft: panner.getAnalyserNodeL(),
      trackRight: panner.getAnalyserNodeR(),
      masterLeft: panner.getMasterAnalyserNodeL(),
      masterRight: panner.getMasterAnalyserNodeR(),
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
    createLimiterModule: createLimiter,
  });
}
