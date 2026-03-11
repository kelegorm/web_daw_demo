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
import type { ToneSynthGraph } from '../hooks/useToneSynth';
import type { TrackStripGraph } from '../hooks/useTrackStrip';
import type { MeterSource } from './types';

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
  synth: ToneSynthGraph;
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

function createMockMeterSource(): MeterSource {
  return { subscribe: vi.fn(() => vi.fn()) };
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

  const synth: ToneSynthGraph = {
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
    getOutput: vi.fn(() => synthOutput as unknown as import('tone').ToneAudioNode),
  };

  const panner: PannerGraph = {
    pan: 0,
    isEnabled: true,
    setPan: vi.fn(),
    setEnabled: vi.fn(),
    get input() { return pannerInput as unknown as GainNode; },
    get output() { return pannerOutput as unknown as GainNode; },
    connectSource: vi.fn(),
    dispose: vi.fn(),
  };

  const trackStrip: TrackStripGraph = {
    trackVolume: 0,
    isTrackMuted: false,
    setTrackVolume: vi.fn(),
    setTrackMuted: vi.fn(),
    get input() { return trackStripInput as unknown as GainNode; },
    get output() { return trackStripOutput as unknown as GainNode; },
    meterSource: createMockMeterSource(),
    dispose: vi.fn(),
  };

  const limiter: LimiterGraph = {
    isEnabled: true,
    threshold: -3,
    setThreshold: vi.fn(),
    setEnabled: vi.fn(),
    getReductionDb: vi.fn(() => 0),
    get input() { return limiterInput as unknown as AudioNode; },
    get output() { return limiterOutput as unknown as AudioNode; },
    meterSource: createMockMeterSource(),
    dispose: vi.fn(),
  };

  const masterStrip: MasterStripGraph = {
    masterVolume: 0,
    setMasterVolume: vi.fn(),
    get input() { return masterStripInput as unknown as GainNode; },
    get output() { return masterStripOutput as unknown as GainNode; },
    meterSource: createMockMeterSource(),
    dispose: vi.fn(),
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

    expect(engine.destination).toBe(build.destinationInput);
    // Verify public interface has no AudioNode / Tone.* exposure
    expect('getSynth' in engine.synth).toBe(false);
    expect('getOutput' in engine.synth).toBe(false);
    expect('connectSource' in engine.panner).toBe(false);
    expect('input' in engine.trackStrip).toBe(false);
    expect('output' in engine.trackStrip).toBe(false);
    expect('input' in engine.limiter).toBe(false);
    expect('output' in engine.limiter).toBe(false);
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

  it('dispose is idempotent', () => {
    const build = createBuild(2);

    const engine = createAudioEngineWithFactories({
      createSynth: () => build.synth,
      createPannerModule: () => build.panner,
      createTrackStripModule: () => build.trackStrip,
      createLimiterModule: () => build.limiter,
      createMasterStripModule: () => build.masterStrip,
    });

    engine.dispose();

    const disconnectCountsAfterFirstDispose = {
      synthOutput: build.synthOutput.disconnect.mock.calls.length,
      pannerOutput: build.pannerOutput.disconnect.mock.calls.length,
      trackStripOutput: build.trackStripOutput.disconnect.mock.calls.length,
      limiterOutput: build.limiterOutput.disconnect.mock.calls.length,
      masterStripOutput: build.masterStripOutput.disconnect.mock.calls.length,
      destination: build.destinationInput.disconnect.mock.calls.length,
    };

    engine.dispose();

    expect(build.synthOutput.disconnect.mock.calls.length).toBe(disconnectCountsAfterFirstDispose.synthOutput);
    expect(build.pannerOutput.disconnect.mock.calls.length).toBe(disconnectCountsAfterFirstDispose.pannerOutput);
    expect(build.trackStripOutput.disconnect.mock.calls.length).toBe(disconnectCountsAfterFirstDispose.trackStripOutput);
    expect(build.limiterOutput.disconnect.mock.calls.length).toBe(disconnectCountsAfterFirstDispose.limiterOutput);
    expect(build.masterStripOutput.disconnect.mock.calls.length).toBe(disconnectCountsAfterFirstDispose.masterStripOutput);
    expect(build.destinationInput.disconnect.mock.calls.length).toBe(disconnectCountsAfterFirstDispose.destination);
  });

  it('public engine methods become safe no-ops after dispose', () => {
    const build = createBuild(3);
    const synthNoteOn = build.synth.noteOn;
    const synthNoteOff = build.synth.noteOff;
    const synthPanic = build.synth.panic;
    const synthSetFilterCutoff = build.synth.setFilterCutoff;
    const synthSetVoiceSpread = build.synth.setVoiceSpread;
    const synthSetVolume = build.synth.setVolume;
    const synthSetEnabled = build.synth.setEnabled;
    const pannerSetPan = build.panner.setPan;
    const pannerSetEnabled = build.panner.setEnabled;
    const trackStripSetTrackVolume = build.trackStrip.setTrackVolume;
    const trackStripSetTrackMuted = build.trackStrip.setTrackMuted;
    const limiterSetThreshold = build.limiter.setThreshold;
    const limiterSetEnabled = build.limiter.setEnabled;
    const masterStripSetMasterVolume = build.masterStrip.setMasterVolume;

    const engine = createAudioEngineWithFactories({
      createSynth: () => build.synth,
      createPannerModule: () => build.panner,
      createTrackStripModule: () => build.trackStrip,
      createLimiterModule: () => build.limiter,
      createMasterStripModule: () => build.masterStrip,
    });

    engine.dispose();

    expect(() => engine.synth.noteOn(60, 100)).not.toThrow();
    expect(() => engine.synth.noteOff(60)).not.toThrow();
    expect(() => engine.synth.panic()).not.toThrow();
    expect(() => engine.synth.setFilterCutoff(1000)).not.toThrow();
    expect(() => engine.synth.setVoiceSpread(0.5)).not.toThrow();
    expect(() => engine.synth.setVolume(-6)).not.toThrow();
    expect(() => engine.synth.setEnabled(false)).not.toThrow();
    expect(() => engine.panner.setPan(0.25)).not.toThrow();
    expect(() => engine.panner.setEnabled(false)).not.toThrow();
    expect(() => engine.trackStrip.setTrackVolume(-6)).not.toThrow();
    expect(() => engine.trackStrip.setTrackMuted(true)).not.toThrow();
    expect(() => engine.limiter.setThreshold(-10)).not.toThrow();
    expect(() => engine.limiter.setEnabled(false)).not.toThrow();
    expect(() => engine.masterStrip.setMasterVolume(-3)).not.toThrow();

    expect(synthNoteOn).not.toHaveBeenCalled();
    expect(synthNoteOff).not.toHaveBeenCalled();
    expect(synthPanic).toHaveBeenCalledTimes(1);
    expect(synthSetFilterCutoff).not.toHaveBeenCalled();
    expect(synthSetVoiceSpread).not.toHaveBeenCalled();
    expect(synthSetVolume).not.toHaveBeenCalled();
    expect(synthSetEnabled).not.toHaveBeenCalled();
    expect(pannerSetPan).not.toHaveBeenCalled();
    expect(pannerSetEnabled).not.toHaveBeenCalled();
    expect(trackStripSetTrackVolume).not.toHaveBeenCalled();
    expect(trackStripSetTrackMuted).not.toHaveBeenCalled();
    expect(limiterSetThreshold).not.toHaveBeenCalled();
    expect(limiterSetEnabled).not.toHaveBeenCalled();
    expect(masterStripSetMasterVolume).not.toHaveBeenCalled();
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
