import * as Tone from 'tone';
import { createLimiter, type LimiterGraph } from '../hooks/useLimiter';
import { createMasterStrip, type MasterStripGraph } from '../hooks/useMasterStrip';
import { createTrackStrip, type TrackStripGraph } from '../hooks/useTrackStrip';
import type { MasterFacade, MeterSource, TrackFacade } from './types';

export const DEFAULT_TRACK_ID = 'track-1';

export interface EngineApi {
  getTrackFacade(trackId: string): TrackFacade;
  getMasterFacade(): MasterFacade;
  createTrackSubgraph(trackId: string): TrackFacade;
  removeTrackSubgraph(trackId: string): void;
  /** Limiter input meter (pre-limiter signal level) */
  getLimiterInputMeter(): MeterSource;
  /** Limiter gain reduction in dB (0 = no reduction) */
  getLimiterReductionDb(): number;
  /** Connect an AudioNode to the track strip input (for device chains wired before the strip). */
  connectToTrackInput(trackId: string, sourceNode: AudioNode): void;
  // Legacy accessors for backward compat during migration (Plans 01-03 and Phase 2-3)
  _legacy: {
    readonly audioContext: AudioContext;
    readonly limiterGraph: LimiterGraph;
    getTrackStripGraph(trackId: string): TrackStripGraph;
  };
}

// ---------------------------------------------------------------------------
// TrackFacadeImpl — internal class, not exported.
// Only the TrackFacade interface is public.
// ---------------------------------------------------------------------------

class TrackFacadeImpl implements TrackFacade {
  #disposed = false;
  #strip: TrackStripGraph;

  constructor(strip: TrackStripGraph) {
    this.#strip = strip;
  }

  get meterSource(): MeterSource {
    this.#assertNotDisposed();
    return this.#strip.meterSource;
  }

  setGain(db: number): void {
    this.#assertNotDisposed();
    this.#strip.setTrackVolume(db);
  }

  getGain(): number {
    this.#assertNotDisposed();
    return this.#strip.trackVolume;
  }

  setMute(muted: boolean): void {
    this.#assertNotDisposed();
    this.#strip.setTrackMuted(muted);
  }

  isMuted(): boolean {
    this.#assertNotDisposed();
    return this.#strip.isTrackMuted;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#strip.dispose();
  }

  get isDisposed(): boolean {
    return this.#disposed;
  }

  /** Internal: the raw strip output for bus wiring. NOT on TrackFacade interface. */
  get _stripOutput(): AudioNode {
    return this.#strip.output;
  }

  /** Internal: the raw strip input for device chain wiring. NOT on TrackFacade interface. */
  get _stripInput(): AudioNode {
    return this.#strip.input;
  }

  /** Internal: the raw strip for legacy hook consumption. NOT on TrackFacade interface. */
  get _strip(): TrackStripGraph {
    return this.#strip;
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error('[TrackFacade] method called on disposed facade');
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

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

  // Track registry — keyed by trackId, stores facade + strip for legacy access
  const tracks = new Map<string, { facade: TrackFacadeImpl; strip: TrackStripGraph }>();

  function createTrackSubgraphInternal(trackId: string): TrackFacade {
    if (tracks.has(trackId)) {
      throw new Error(`[engine] track already exists: ${trackId}`);
    }
    const strip = createTrackStrip(audioContext);
    const facade = new TrackFacadeImpl(strip);
    // Connect to bus — disconnect-before-dispose ordering is critical (RESEARCH.md Pitfall 3)
    strip.output.connect(preLimiterBus);
    tracks.set(trackId, { facade, strip });
    return facade;
  }

  // Bootstrap default track on engine init
  createTrackSubgraphInternal(DEFAULT_TRACK_ID);

  return {
    getTrackFacade(trackId: string): TrackFacade {
      const entry = tracks.get(trackId);
      if (!entry) {
        throw new Error(`[engine] unknown track: ${trackId}`);
      }
      return entry.facade;
    },

    getMasterFacade(): MasterFacade {
      return masterFacade;
    },

    createTrackSubgraph(trackId: string): TrackFacade {
      return createTrackSubgraphInternal(trackId);
    },

    connectToTrackInput(trackId: string, sourceNode: AudioNode): void {
      const entry = tracks.get(trackId);
      if (!entry) {
        throw new Error(`[engine] unknown track: ${trackId}`);
      }
      sourceNode.connect(entry.strip.input);
    },

    removeTrackSubgraph(trackId: string): void {
      const entry = tracks.get(trackId);
      if (!entry) {
        throw new Error(`[engine] unknown track: ${trackId}`);
      }
      // Disconnect from bus BEFORE disposing nodes (RESEARCH.md Pitfall 3)
      entry.facade._stripOutput.disconnect(preLimiterBus);
      entry.facade.dispose();
      tracks.delete(trackId);
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
      getTrackStripGraph(trackId: string): TrackStripGraph {
        const entry = tracks.get(trackId);
        if (!entry) throw new Error(`[engine] unknown track: ${trackId}`);
        return entry.strip;
      },
    },
  };
}
