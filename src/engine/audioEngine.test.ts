import { describe, expect, it, vi } from 'vitest';
import {
  assembleAudioGraph,
  createAudioEngineWithFactories,
  type GraphModuleSpec,
  validateLinearGraph,
} from './audioEngine';
import type { LimiterGraph } from '../hooks/useLimiter';
import type { MasterStripGraph } from '../hooks/useMasterStrip';
import type { PannerGraph } from '../hooks/usePanner';
import type { ToneSynthHook } from '../hooks/useToneSynth';
import type { TrackStripGraph } from '../hooks/useTrackStrip';

type MockPort = {
  id: string;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  context?: AudioContext;
};

type MockBuild = {
  context: AudioContext;
  synthOutput: MockPort;
  pannerInput: MockPort;
  pannerOutput: MockPort;
  trackStripInput: MockPort;
  trackStripOutput: MockPort;
  limiterInput: MockPort;
  limiterOutput: MockPort;
  masterStripInput: MockPort;
  masterStripOutput: MockPort;
  destinationInput: MockPort;
  trackLeft: AnalyserNode;
  trackRight: AnalyserNode;
  masterLeft: AnalyserNode;
  masterRight: AnalyserNode;
  limiterLeft: AnalyserNode;
  limiterRight: AnalyserNode;
  synth: ToneSynthHook;
  panner: PannerGraph;
  trackStrip: TrackStripGraph;
  limiter: LimiterGraph;
  masterStrip: MasterStripGraph;
};

function createPort(id: string, context?: AudioContext): MockPort {
  return {
    id,
    context,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createBuild(index: number): MockBuild {
  const context = {
    destination: createPort(`destination-input-${index}`),
  } as unknown as AudioContext;

  const synthOutput = createPort(`synth-output-${index}`, context);
  const pannerInput = createPort(`panner-input-${index}`, context);
  const pannerOutput = createPort(`panner-output-${index}`, context);
  const trackStripInput = createPort(`track-strip-input-${index}`, context);
  const trackStripOutput = createPort(`track-strip-output-${index}`, context);
  const limiterInput = createPort(`limiter-input-${index}`, context);
  const limiterOutput = createPort(`limiter-output-${index}`, context);
  const masterStripInput = createPort(`master-strip-input-${index}`, context);
  const masterStripOutput = createPort(`master-strip-output-${index}`, context);
  const destinationInput = context.destination as unknown as MockPort;
  const trackLeft = createPort(`track-left-${index}`) as unknown as AnalyserNode;
  const trackRight = createPort(`track-right-${index}`) as unknown as AnalyserNode;
  const masterLeft = createPort(`master-left-${index}`) as unknown as AnalyserNode;
  const masterRight = createPort(`master-right-${index}`) as unknown as AnalyserNode;
  const limiterLeft = createPort(`limiter-left-${index}`) as unknown as AnalyserNode;
  const limiterRight = createPort(`limiter-right-${index}`) as unknown as AnalyserNode;

  const synth: ToneSynthHook = {
    isEnabled: true,
    filterCutoff: 2000,
    voiceSpread: 0,
    volume: 0,
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    panic: vi.fn(),
    setFilterCutoff: vi.fn(),
    setVoiceSpread: vi.fn(),
    setVolume: vi.fn(),
    setEnabled: vi.fn(),
    getSynth: vi.fn(() => null),
    getOutput: vi.fn(() => synthOutput),
  };

  const panner: PannerGraph = {
    pan: 0,
    isEnabled: true,
    setPan: vi.fn(),
    setEnabled: vi.fn(),
    getInputNode: vi.fn(() => pannerInput),
    getOutputNode: vi.fn(() => pannerOutput),
    connectSource: vi.fn(),
    getPannerNode: vi.fn(),
  };

  const trackStrip: TrackStripGraph = {
    trackVolume: 0,
    isTrackMuted: false,
    setTrackVolume: vi.fn(),
    setTrackMuted: vi.fn(),
    getInputNode: vi.fn(() => trackStripInput),
    getOutputNode: vi.fn(() => trackStripOutput),
    getTrackGainNode: vi.fn(),
    getAnalyserNode: vi.fn(),
    getAnalyserNodeL: vi.fn(() => trackLeft),
    getAnalyserNodeR: vi.fn(() => trackRight),
  };

  const limiter: LimiterGraph = {
    isEnabled: true,
    threshold: -3,
    setThreshold: vi.fn(),
    setEnabled: vi.fn(),
    getReductionDb: vi.fn(() => 0),
    getInputAnalyserNodeL: vi.fn(() => limiterLeft),
    getInputAnalyserNodeR: vi.fn(() => limiterRight),
    getLimiterNode: vi.fn(),
    getInputNode: vi.fn(() => limiterInput),
    getOutputNode: vi.fn(() => limiterOutput),
  };

  const masterStrip: MasterStripGraph = {
    masterVolume: 0,
    setMasterVolume: vi.fn(),
    getInputNode: vi.fn(() => masterStripInput),
    getOutputNode: vi.fn(() => masterStripOutput),
    getMasterGainNode: vi.fn(),
    getAnalyserNode: vi.fn(),
    getAnalyserNodeL: vi.fn(() => masterLeft),
    getAnalyserNodeR: vi.fn(() => masterRight),
  };

  return {
    context,
    synthOutput,
    pannerInput,
    pannerOutput,
    trackStripInput,
    trackStripOutput,
    limiterInput,
    limiterOutput,
    masterStripInput,
    masterStripOutput,
    destinationInput,
    trackLeft,
    trackRight,
    masterLeft,
    masterRight,
    limiterLeft,
    limiterRight,
    synth,
    panner,
    trackStrip,
    limiter,
    masterStrip,
  };
}

describe('createAudioEngineWithFactories', () => {
  it('builds expected linear graph links', () => {
    const build = createBuild(0);
    const createSynth = vi.fn(() => build.synth);
    const createPannerModule = vi.fn(() => build.panner);
    const createTrackStripModule = vi.fn((context: AudioContext) => {
      expect(context).toBe(build.context);
      return build.trackStrip;
    });
    const createLimiterModule = vi.fn((context: AudioContext) => {
      expect(context).toBe(build.context);
      return build.limiter;
    });
    const createMasterStripModule = vi.fn((context: AudioContext) => {
      expect(context).toBe(build.context);
      return build.masterStrip;
    });

    const engine = createAudioEngineWithFactories({
      createSynth,
      createPannerModule,
      createTrackStripModule,
      createLimiterModule,
      createMasterStripModule,
    });

    expect(build.panner.connectSource).toHaveBeenCalledWith(build.synthOutput);
    expect(build.pannerOutput.connect).toHaveBeenCalledWith(build.trackStripInput);
    expect(build.trackStripOutput.connect).toHaveBeenCalledWith(build.limiterInput);
    expect(build.limiterOutput.connect).toHaveBeenCalledWith(build.masterStripInput);
    expect(build.masterStripOutput.connect).toHaveBeenCalledWith(build.destinationInput);

    expect(engine.synth).toBe(build.synth);
    expect(engine.panner).toBe(build.panner);
    expect(engine.trackStrip).toBe(build.trackStrip);
    expect(engine.limiter).toBe(build.limiter);
    expect(engine.masterStrip).toBe(build.masterStrip);
    expect(engine.destination).toBe(build.destinationInput);
    expect(engine.meterTaps.trackLeft).toBe(build.trackLeft);
    expect(engine.meterTaps.trackRight).toBe(build.trackRight);
    expect(engine.meterTaps.masterLeft).toBe(build.masterLeft);
    expect(engine.meterTaps.masterRight).toBe(build.masterRight);
    expect(engine.meterTaps.limiterInputLeft).toBe(build.limiterLeft);
    expect(engine.meterTaps.limiterInputRight).toBe(build.limiterRight);
  });

  it('is deterministic across repeated createAudioEngine calls', () => {
    const first = createBuild(0);
    const second = createBuild(1);
    const builds = [first, second];
    let buildIndex = 0;

    const createSynth = vi.fn(() => builds[buildIndex].synth);
    const createPannerModule = vi.fn(() => builds[buildIndex].panner);
    const createTrackStripModule = vi.fn(() => builds[buildIndex].trackStrip);
    const createLimiterModule = vi.fn(() => builds[buildIndex].limiter);
    const createMasterStripModule = vi.fn(() => {
      const masterStrip = builds[buildIndex].masterStrip;
      buildIndex += 1;
      return masterStrip;
    });

    createAudioEngineWithFactories({
      createSynth,
      createPannerModule,
      createTrackStripModule,
      createLimiterModule,
      createMasterStripModule,
    });
    createAudioEngineWithFactories({
      createSynth,
      createPannerModule,
      createTrackStripModule,
      createLimiterModule,
      createMasterStripModule,
    });

    expect(first.panner.connectSource).toHaveBeenCalledTimes(1);
    expect(first.pannerOutput.connect).toHaveBeenCalledTimes(1);
    expect(first.trackStripOutput.connect).toHaveBeenCalledTimes(1);
    expect(first.limiterOutput.connect).toHaveBeenCalledTimes(1);
    expect(first.masterStripOutput.connect).toHaveBeenCalledTimes(1);

    expect(second.panner.connectSource).toHaveBeenCalledTimes(1);
    expect(second.pannerOutput.connect).toHaveBeenCalledTimes(1);
    expect(second.trackStripOutput.connect).toHaveBeenCalledTimes(1);
    expect(second.limiterOutput.connect).toHaveBeenCalledTimes(1);
    expect(second.masterStripOutput.connect).toHaveBeenCalledTimes(1);

    expect(first.panner.connectSource).toHaveBeenCalledWith(first.synthOutput);
    expect(second.panner.connectSource).toHaveBeenCalledWith(second.synthOutput);
    expect(first.pannerOutput.connect).toHaveBeenCalledWith(first.trackStripInput);
    expect(second.pannerOutput.connect).toHaveBeenCalledWith(second.trackStripInput);
    expect(first.trackStripOutput.connect).toHaveBeenCalledWith(first.limiterInput);
    expect(second.trackStripOutput.connect).toHaveBeenCalledWith(second.limiterInput);
    expect(first.limiterOutput.connect).toHaveBeenCalledWith(first.masterStripInput);
    expect(second.limiterOutput.connect).toHaveBeenCalledWith(second.masterStripInput);
    expect(first.masterStripOutput.connect).toHaveBeenCalledWith(first.destinationInput);
    expect(second.masterStripOutput.connect).toHaveBeenCalledWith(second.destinationInput);
  });
});

describe('graph validation', () => {
  function makeModule(id: string, ports?: { input?: MockPort; output?: MockPort }): GraphModuleSpec {
    return {
      id,
      input: ports?.input,
      output: ports?.output,
      dispose: () => {},
    };
  }

  it('throws for missing module id in edges', () => {
    const output = createPort('a-output');
    const input = createPort('b-input');

    expect(() =>
      validateLinearGraph(
        [makeModule('a', { output }), makeModule('b', { input })],
        [{ from: 'a', to: 'missing' }],
      ),
    ).toThrow('missing module id referenced by edge.to: missing');
  });

  it('throws for missing from.output', () => {
    const input = createPort('b-input');

    expect(() =>
      validateLinearGraph(
        [makeModule('a'), makeModule('b', { input })],
        [{ from: 'a', to: 'b' }],
      ),
    ).toThrow('missing from.output for module: a');
  });

  it('throws for missing to.input', () => {
    const output = createPort('a-output');

    expect(() =>
      validateLinearGraph(
        [makeModule('a', { output }), makeModule('b')],
        [{ from: 'a', to: 'b' }],
      ),
    ).toThrow('missing to.input for module: b');
  });

  it('throws for duplicate module id', () => {
    const output = createPort('a-output');
    const input = createPort('b-input');

    expect(() =>
      validateLinearGraph(
        [makeModule('dup', { output }), makeModule('dup', { input })],
        [{ from: 'dup', to: 'dup' }],
      ),
    ).toThrow('duplicate module id: dup');
  });

  it('throws for self-loop edge', () => {
    const output = createPort('a-output');
    const input = createPort('a-input');

    expect(() =>
      validateLinearGraph(
        [makeModule('a', { input, output })],
        [{ from: 'a', to: 'a' }],
      ),
    ).toThrow('self-loop edge is not allowed: a');
  });

  it('throws for backward edge in linear graph order', () => {
    const aIn = createPort('a-in');
    const aOut = createPort('a-out');
    const bIn = createPort('b-in');
    const bOut = createPort('b-out');

    expect(() =>
      assembleAudioGraph(
        [
          makeModule('a', { input: aIn, output: aOut }),
          makeModule('b', { input: bIn, output: bOut }),
        ],
        [{ from: 'b', to: 'a' }],
      ),
    ).toThrow('backward edge is not allowed: b -> a');
  });
});
