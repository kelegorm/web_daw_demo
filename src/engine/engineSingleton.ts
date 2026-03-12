import * as Tone from 'tone';
import { createLimiter, type LimiterGraph } from '../hooks/useLimiter';
import { createMasterStrip, type MasterStripGraph } from '../hooks/useMasterStrip';
import type { MasterFacade, MeterSource, TrackFacade } from './types';

interface EngineApi {
  getTrackFacade(trackId: string): TrackFacade;
  getMasterFacade(): MasterFacade;
  createTrackSubgraph(trackId: string): TrackFacade;
  removeTrackSubgraph(trackId: string): void;
  /** Limiter input meter (pre-limiter signal level) */
  getLimiterInputMeter(): MeterSource;
  /** Limiter gain reduction in dB (0 = no reduction) */
  getLimiterReductionDb(): number;
  // Legacy accessors for backward compat during migration (Plans 01-03 and Phase 2-3)
  _legacy: {
    readonly audioContext: AudioContext;
    readonly limiterGraph: LimiterGraph;
  };
}

let _engine: EngineApi | null = null;

export function getAudioEngine(): EngineApi {
  if (!_engine) {
    _engine = createEngineInternal();
  }
  return _engine;
}

export function _resetEngineForTesting(): void {
  _engine = null;
}

function createEngineInternal(): EngineApi {
  // AudioContext ownership: must use Tone.js's AudioContext, not create a new one.
  // Web Audio API prohibits connect() calls across different AudioContext instances.
  // All engine nodes must share the same context as Tone.js synth/transport.
  const audioContext = Tone.getContext().rawContext as AudioContext;

  // preLimiterBus: unity-gain summing node — all track outputs connect here
  const preLimiterBus = audioContext.createGain();
  preLimiterBus.gain.value = 1.0;

  // Master chain: preLimiterBus -> limiter -> masterStrip -> destination
  const limiterGraph: LimiterGraph = createLimiter(audioContext);
  const masterStripGraph: MasterStripGraph = createMasterStrip(audioContext);

  preLimiterBus.connect(limiterGraph.input);
  limiterGraph.output.connect(masterStripGraph.input);
  masterStripGraph.output.connect(audioContext.destination);

  // MasterFacade — wraps masterStripGraph with domain-appropriate method names
  const masterFacade: MasterFacade = {
    get meterSource() { return masterStripGraph.meterSource; },
    setGain(db: number) { masterStripGraph.setMasterVolume(db); },
    getGain() { return masterStripGraph.masterVolume; },
  };

  // Track registry — populated by createTrackSubgraph (Plan 01-02)
  // const tracks = new Map<string, { facade: TrackFacade; strip: TrackStripGraph }>();

  return {
    getTrackFacade(_trackId: string): TrackFacade {
      throw new Error('[engine] track API not yet implemented — see Plan 01-02');
    },

    getMasterFacade(): MasterFacade {
      return masterFacade;
    },

    createTrackSubgraph(_trackId: string): TrackFacade {
      throw new Error('[engine] track API not yet implemented — see Plan 01-02');
    },

    removeTrackSubgraph(_trackId: string): void {
      throw new Error('[engine] track API not yet implemented — see Plan 01-02');
    },

    getLimiterInputMeter(): MeterSource {
      return limiterGraph.meterSource;
    },

    getLimiterReductionDb(): number {
      return limiterGraph.getReductionDb();
    },

    _legacy: {
      get audioContext() { return audioContext; },
      get limiterGraph() { return limiterGraph; },
    },
  };
}
