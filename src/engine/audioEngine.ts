import { createLimiter, type LimiterGraph, type LimiterHook } from '../hooks/useLimiter';
import { createMasterStrip, type MasterStripGraph, type MasterStripHook } from '../hooks/useMasterStrip';
import { createPanner, type PannerGraph, type PannerHook } from '../hooks/usePanner';
import { createToneSynth, type ToneSynthGraph, type ToneSynthHook } from '../hooks/useToneSynth';
import { createTrackStrip, type TrackStripGraph, type TrackStripHook } from '../hooks/useTrackStrip';
import {
  AudioModuleKind,
  DEFAULT_AUDIO_GRAPH_PLAN,
  validateAudioGraphPlan,
  type AudioGraphPlan,
} from './audioGraphPlan';
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
  getSynth: (id: string) => ToneSynthHook;
  getPanner: (id: string) => PannerHook;
  getTrackStrip: (id: string) => TrackStripHook;
  getLimiter: (id: string) => LimiterHook;
  getMasterStrip: (id: string) => MasterStripHook;
  dispose: () => void;
}

// The result returned by each factory: the raw runtime graph object, plus optional AudioContext
// provided by this factory (for propagation to subsequent factories in the chain).
export interface AudioModuleFactoryResult {
  runtime: unknown;
  audioContext?: AudioContext;
}

export type AudioModuleFactory = (audioContext: AudioContext | null) => AudioModuleFactoryResult;

export type AudioModuleFactoryMap = Record<AudioModuleKind, AudioModuleFactory>;

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

function getRequiredRuntime<T>(runtimeByKind: Map<AudioModuleKind, unknown>, kind: AudioModuleKind): T {
  const runtime = runtimeByKind.get(kind);
  if (runtime === undefined) {
    throw new Error(`[audio-engine] plan is missing required module kind: ${kind}`);
  }
  return runtime as T;
}

function buildModuleSpec(
  nodeId: string,
  kind: AudioModuleKind,
  runtimeByKind: Map<AudioModuleKind, unknown>,
  audioContext: AudioContext,
): GraphModuleSpec {
  switch (kind) {
    case AudioModuleKind.SYNTH: {
      const synth = getRequiredRuntime<ToneSynthGraph>(runtimeByKind, AudioModuleKind.SYNTH);
      const panner = getRequiredRuntime<PannerGraph>(runtimeByKind, AudioModuleKind.PANNER);
      const synthOutputNode = synth.getOutput();
      return {
        id: nodeId,
        output: {
          connect: () => {
            panner.connectSource(synthOutputNode);
          },
          disconnect: () => {
            safeDisconnect(synthOutputNode as unknown as Disconnectable);
          },
        },
        dispose: () => {
          safeCall(() => synth.panic());
          safeDisconnect(synthOutputNode as unknown as Disconnectable);
          safeDispose(synthOutputNode as unknown as Disposable);
          safeDispose(synth.getSynth() as unknown as Disposable);
        },
      };
    }
    case AudioModuleKind.PANNER: {
      const panner = getRequiredRuntime<PannerGraph>(runtimeByKind, AudioModuleKind.PANNER);
      return {
        id: nodeId,
        input: panner.input,
        output: panner.output,
        dispose: () => safeCall(() => panner.dispose()),
      };
    }
    case AudioModuleKind.TRACK_STRIP: {
      const trackStrip = getRequiredRuntime<TrackStripGraph>(runtimeByKind, AudioModuleKind.TRACK_STRIP);
      return {
        id: nodeId,
        input: trackStrip.input,
        output: trackStrip.output,
        dispose: () => safeCall(() => trackStrip.dispose()),
      };
    }
    case AudioModuleKind.LIMITER: {
      const limiter = getRequiredRuntime<LimiterGraph>(runtimeByKind, AudioModuleKind.LIMITER);
      return {
        id: nodeId,
        input: limiter.input,
        output: limiter.output,
        dispose: () => safeCall(() => limiter.dispose()),
      };
    }
    case AudioModuleKind.MASTER_STRIP: {
      const masterStrip = getRequiredRuntime<MasterStripGraph>(runtimeByKind, AudioModuleKind.MASTER_STRIP);
      return {
        id: nodeId,
        input: masterStrip.input,
        output: masterStrip.output,
        dispose: () => safeCall(() => masterStrip.dispose()),
      };
    }
    case AudioModuleKind.DESTINATION: {
      return {
        id: nodeId,
        input: audioContext.destination,
        dispose: () => {},
      };
    }
  }
}

export const DEFAULT_AUDIO_MODULE_FACTORY_MAP: AudioModuleFactoryMap = {
  [AudioModuleKind.SYNTH]: () => ({ runtime: createToneSynth() }),
  [AudioModuleKind.PANNER]: () => {
    const pannerGraph = createPanner();
    return { runtime: pannerGraph, audioContext: pannerGraph.input.context as AudioContext };
  },
  [AudioModuleKind.TRACK_STRIP]: (ctx) => ({ runtime: createTrackStrip(ctx!) }),
  [AudioModuleKind.LIMITER]: (ctx) => ({ runtime: createLimiter(ctx!) }),
  [AudioModuleKind.MASTER_STRIP]: (ctx) => ({ runtime: createMasterStrip(ctx!) }),
  [AudioModuleKind.DESTINATION]: (ctx) => ({ runtime: ctx!.destination }),
};

export function createAudioEngine(plan: AudioGraphPlan, factoryMap: AudioModuleFactoryMap): AudioEngine {
  validateAudioGraphPlan(plan);

  // Fail-fast: verify all plan node kinds have factories before materializing anything.
  for (const node of plan.nodes) {
    if (!(node.kind in factoryMap)) {
      throw new Error(`[audio-engine] missing factory for module kind: ${node.kind}`);
    }
  }

  // Materialize runtime objects from plan nodes in declaration order.
  let audioContext: AudioContext | null = null;
  const runtimeByKind = new Map<AudioModuleKind, unknown>();

  for (const node of plan.nodes) {
    const result = factoryMap[node.kind](audioContext);
    runtimeByKind.set(node.kind, result.runtime);
    if (result.audioContext && !audioContext) {
      audioContext = result.audioContext;
    }
  }

  if (!audioContext) {
    throw new Error('[audio-engine] no AudioContext was provided by any factory in the plan');
  }

  // Build GraphModuleSpec array from plan nodes (all runtimes are now available).
  const resolvedContext = audioContext;
  const modules: GraphModuleSpec[] = plan.nodes.map((node) =>
    buildModuleSpec(node.id, node.kind, runtimeByKind, resolvedContext),
  );

  // Connect modules by plan edges.
  assembleAudioGraph(modules, plan.edges);

  let isDisposed = false;
  const isEngineDisposed = () => isDisposed;

  const synth = getRequiredRuntime<ToneSynthGraph>(runtimeByKind, AudioModuleKind.SYNTH);
  const panner = getRequiredRuntime<PannerGraph>(runtimeByKind, AudioModuleKind.PANNER);
  const trackStrip = getRequiredRuntime<TrackStripGraph>(runtimeByKind, AudioModuleKind.TRACK_STRIP);
  const limiter = getRequiredRuntime<LimiterGraph>(runtimeByKind, AudioModuleKind.LIMITER);
  const masterStrip = getRequiredRuntime<MasterStripGraph>(runtimeByKind, AudioModuleKind.MASTER_STRIP);

  const synthFacade: ToneSynthHook = {
    get isEnabled() { return synth.isEnabled; },
    get filterCutoff() { return synth.filterCutoff; },
    get voiceSpread() { return synth.voiceSpread; },
    get volume() { return synth.volume; },
    noteOn: (midi, velocity, time) => {
      if (isEngineDisposed()) return;
      synth.noteOn(midi, velocity, time);
    },
    noteOff: (midi, time) => {
      if (isEngineDisposed()) return;
      synth.noteOff(midi, time);
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

  // Build id -> { kind, facade } index for id-based accessors.
  type ModuleEntry =
    | { kind: AudioModuleKind.SYNTH; facade: ToneSynthHook }
    | { kind: AudioModuleKind.PANNER; facade: PannerHook }
    | { kind: AudioModuleKind.TRACK_STRIP; facade: TrackStripHook }
    | { kind: AudioModuleKind.LIMITER; facade: LimiterHook }
    | { kind: AudioModuleKind.MASTER_STRIP; facade: MasterStripHook };

  const moduleIndex = new Map<string, ModuleEntry>();
  for (const node of plan.nodes) {
    switch (node.kind) {
      case AudioModuleKind.SYNTH:
        moduleIndex.set(node.id, { kind: AudioModuleKind.SYNTH, facade: synthFacade });
        break;
      case AudioModuleKind.PANNER:
        moduleIndex.set(node.id, { kind: AudioModuleKind.PANNER, facade: pannerFacade });
        break;
      case AudioModuleKind.TRACK_STRIP:
        moduleIndex.set(node.id, { kind: AudioModuleKind.TRACK_STRIP, facade: trackStripFacade });
        break;
      case AudioModuleKind.LIMITER:
        moduleIndex.set(node.id, { kind: AudioModuleKind.LIMITER, facade: limiterFacade });
        break;
      case AudioModuleKind.MASTER_STRIP:
        moduleIndex.set(node.id, { kind: AudioModuleKind.MASTER_STRIP, facade: masterStripFacade });
        break;
      // DESTINATION has no facade — intentionally excluded from the module index.
    }
  }

  function requireModule(id: string, expectedKind: AudioModuleKind): ModuleEntry {
    const entry = moduleIndex.get(id);
    if (!entry) {
      throw new Error(`[audio-engine] unknown module id: ${id}`);
    }
    if (entry.kind !== expectedKind) {
      throw new Error(`[audio-engine] module id "${id}" has kind ${entry.kind}, expected ${expectedKind}`);
    }
    return entry;
  }

  return {
    getSynth: (id) => (requireModule(id, AudioModuleKind.SYNTH) as { kind: AudioModuleKind.SYNTH; facade: ToneSynthHook }).facade,
    getPanner: (id) => (requireModule(id, AudioModuleKind.PANNER) as { kind: AudioModuleKind.PANNER; facade: PannerHook }).facade,
    getTrackStrip: (id) => (requireModule(id, AudioModuleKind.TRACK_STRIP) as { kind: AudioModuleKind.TRACK_STRIP; facade: TrackStripHook }).facade,
    getLimiter: (id) => (requireModule(id, AudioModuleKind.LIMITER) as { kind: AudioModuleKind.LIMITER; facade: LimiterHook }).facade,
    getMasterStrip: (id) => (requireModule(id, AudioModuleKind.MASTER_STRIP) as { kind: AudioModuleKind.MASTER_STRIP; facade: MasterStripHook }).facade,
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;

      for (const edge of plan.edges) {
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

export function createDefaultAudioEngine(): AudioEngine {
  return createAudioEngine(DEFAULT_AUDIO_GRAPH_PLAN, DEFAULT_AUDIO_MODULE_FACTORY_MAP);
}
