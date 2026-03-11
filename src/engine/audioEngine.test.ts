import { describe, expect, it, vi } from 'vitest';
import {
  assembleAudioGraph,
  createAudioEngineWithFactories,
  type GraphModuleSpec,
  validateLinearGraph,
} from './audioEngine';
import type { LimiterGraph } from '../hooks/useLimiter';
import type { PannerGraph } from '../hooks/usePanner';
import type { ToneSynthHook } from '../hooks/useToneSynth';

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
  limiterInput: MockPort;
  limiterOutput: MockPort;
  masterInput: MockPort;
  masterOutput: MockPort;
  destinationInput: MockPort;
  trackLeft: AnalyserNode;
  trackRight: AnalyserNode;
  masterLeft: AnalyserNode;
  masterRight: AnalyserNode;
  limiterLeft: AnalyserNode;
  limiterRight: AnalyserNode;
  synth: ToneSynthHook;
  panner: PannerGraph;
  limiter: LimiterGraph;
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
  const limiterInput = createPort(`limiter-input-${index}`, context);
  const limiterOutput = createPort(`limiter-output-${index}`, context);
  const masterInput = createPort(`master-input-${index}`, context);
  const masterOutput = createPort(`master-output-${index}`, context);
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
    trackVolume: 0,
    masterVolume: 0,
    isEnabled: true,
    setPan: vi.fn(),
    setTrackVolume: vi.fn(),
    setMasterVolume: vi.fn(),
    setTrackMuted: vi.fn(),
    setEnabled: vi.fn(),
    getInputNode: vi.fn(() => pannerInput),
    connectSource: vi.fn(),
    getPannerNode: vi.fn(),
    getGainNode: vi.fn(),
    getTrackGainNode: vi.fn(),
    getMixerNode: vi.fn(() => pannerOutput),
    getMasterGainNode: vi.fn(() => masterInput),
    getAnalyserNode: vi.fn(),
    getAnalyserNodeL: vi.fn(() => trackLeft),
    getAnalyserNodeR: vi.fn(() => trackRight),
    getMasterAnalyserNode: vi.fn(() => masterOutput),
    getMasterAnalyserNodeL: vi.fn(() => masterLeft),
    getMasterAnalyserNodeR: vi.fn(() => masterRight),
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

  return {
    context,
    synthOutput,
    pannerInput,
    pannerOutput,
    limiterInput,
    limiterOutput,
    masterInput,
    masterOutput,
    destinationInput,
    trackLeft,
    trackRight,
    masterLeft,
    masterRight,
    limiterLeft,
    limiterRight,
    synth,
    panner,
    limiter,
  };
}

describe('createAudioEngineWithFactories', () => {
  it('builds expected linear graph links', () => {
    const build = createBuild(0);
    const createSynth = vi.fn(() => build.synth);
    const createPannerModule = vi.fn(() => build.panner);
    const createLimiterModule = vi.fn((context: AudioContext) => {
      expect(context).toBe(build.context);
      return build.limiter;
    });

    const engine = createAudioEngineWithFactories({
      createSynth,
      createPannerModule,
      createLimiterModule,
    });

    expect((build.panner as { connectSource: ReturnType<typeof vi.fn> }).connectSource)
      .toHaveBeenCalledWith(build.synthOutput);
    expect(build.synthOutput.connect).not.toHaveBeenCalled();
    expect(build.pannerOutput.connect).toHaveBeenCalledWith(build.limiterInput);
    expect(build.limiterOutput.connect).toHaveBeenCalledWith(build.masterInput);
    expect(build.masterInput.connect).toHaveBeenCalledWith(build.masterOutput);
    expect(build.masterOutput.connect).toHaveBeenCalledWith(build.destinationInput);

    expect(engine.synth).toBe(build.synth);
    expect(engine.panner).toBe(build.panner);
    expect(engine.limiter).toBe(build.limiter);
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
    const createLimiterModule = vi.fn(() => {
      const limiter = builds[buildIndex].limiter;
      buildIndex += 1;
      return limiter;
    });

    createAudioEngineWithFactories({
      createSynth,
      createPannerModule,
      createLimiterModule,
    });
    createAudioEngineWithFactories({
      createSynth,
      createPannerModule,
      createLimiterModule,
    });

    expect((first.panner as { connectSource: ReturnType<typeof vi.fn> }).connectSource)
      .toHaveBeenCalledTimes(1);
    expect(first.pannerOutput.connect).toHaveBeenCalledTimes(1);
    expect(first.limiterOutput.connect).toHaveBeenCalledTimes(1);
    expect(first.masterInput.connect).toHaveBeenCalledTimes(1);
    expect(first.masterOutput.connect).toHaveBeenCalledTimes(1);

    expect((second.panner as { connectSource: ReturnType<typeof vi.fn> }).connectSource)
      .toHaveBeenCalledTimes(1);
    expect(second.pannerOutput.connect).toHaveBeenCalledTimes(1);
    expect(second.limiterOutput.connect).toHaveBeenCalledTimes(1);
    expect(second.masterInput.connect).toHaveBeenCalledTimes(1);
    expect(second.masterOutput.connect).toHaveBeenCalledTimes(1);

    expect((first.panner as { connectSource: ReturnType<typeof vi.fn> }).connectSource)
      .toHaveBeenCalledWith(first.synthOutput);
    expect((second.panner as { connectSource: ReturnType<typeof vi.fn> }).connectSource)
      .toHaveBeenCalledWith(second.synthOutput);
    expect(first.pannerOutput.connect).toHaveBeenCalledWith(first.limiterInput);
    expect(second.pannerOutput.connect).toHaveBeenCalledWith(second.limiterInput);
    expect(first.limiterOutput.connect).toHaveBeenCalledWith(first.masterInput);
    expect(second.limiterOutput.connect).toHaveBeenCalledWith(second.masterInput);
    expect(first.masterInput.connect).toHaveBeenCalledWith(first.masterOutput);
    expect(second.masterInput.connect).toHaveBeenCalledWith(second.masterOutput);
    expect(first.masterOutput.connect).toHaveBeenCalledWith(first.destinationInput);
    expect(second.masterOutput.connect).toHaveBeenCalledWith(second.destinationInput);
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
