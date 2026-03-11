import * as Tone from 'tone';

export interface TransportSnapshot {
  isPlaying: boolean;
  positionSeconds: number;
  currentStep: number;
  bpm: number;
}

/**
 * Subset of TransportService that createSequencer needs.
 * Kept narrow so the sequencer doesn't depend on the full service.
 */
export interface SequencerTransport {
  start(): void;
  pause(): void;
  stop(): void;
  setLoopConfig(loop: boolean, loopEnd: string): void;
}

export interface TransportService extends SequencerTransport {
  getSnapshot(): TransportSnapshot;
  subscribe(listener: () => void): () => void;
  /** Public alias for start() — matches the plan's intent-level contract. */
  play(): void;
  setBpm(bpm: number): void;
  updateCurrentStep(step: number): void;
  dispose(): void;
}

export function createTransportService(initialBpm = 120): TransportService {
  let _isPlaying = false;
  let _currentStep = -1;
  let _bpm = initialBpm;
  const listeners = new Set<() => void>();

  try {
    Tone.getTransport().bpm.value = initialBpm;
  } catch {
    // transport not ready yet
  }

  function notify() {
    for (const l of listeners) {
      try {
        l();
      } catch {
        // ignore listener errors
      }
    }
  }

  return {
    getSnapshot(): TransportSnapshot {
      let positionSeconds = 0;
      try {
        positionSeconds = Tone.getTransport().seconds;
      } catch {
        // ignore
      }
      return { isPlaying: _isPlaying, positionSeconds, currentStep: _currentStep, bpm: _bpm };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    start() {
      _isPlaying = true;
      try {
        Tone.getTransport().start();
      } catch {
        // ignore
      }
      notify();
    },

    play() {
      this.start();
    },

    pause() {
      _isPlaying = false;
      try {
        Tone.getTransport().pause();
      } catch {
        // ignore
      }
      notify();
    },

    stop() {
      _isPlaying = false;
      _currentStep = -1;
      try {
        Tone.getTransport().stop();
      } catch {
        // ignore
      }
      notify();
    },

    setBpm(bpm) {
      _bpm = bpm;
      try {
        Tone.getTransport().bpm.value = bpm;
      } catch {
        // ignore
      }
      notify();
    },

    setLoopConfig(loop, loopEnd) {
      try {
        const t = Tone.getTransport();
        t.loop = loop;
        t.loopStart = 0;
        t.loopEnd = loopEnd;
      } catch {
        // ignore
      }
    },

    updateCurrentStep(step) {
      _currentStep = step;
    },

    dispose() {
      listeners.clear();
    },
  };
}
