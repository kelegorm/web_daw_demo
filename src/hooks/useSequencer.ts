import { useRef, useState, useCallback, useEffect } from 'react';

export const SEQUENCER_NOTES = [60, 62, 64, 65, 67, 69, 71, 72];

const BPM = 120;
const BEAT_DURATION = 60 / BPM; // 0.5s per beat
const LOOKAHEAD = 0.1; // 100ms ahead
const SCHEDULE_INTERVAL = 25; // ms

export interface Sequencer {
  isPlaying: () => boolean;
  currentStep: () => number;
  start: () => void;
  stop: () => void;
}

export function createSequencer(
  noteOn: (midi: number) => void,
  noteOff: (midi: number) => void,
  getClock: () => number,
  onStepChange?: (step: number) => void,
): Sequencer {
  let playing = false;
  let nextNoteTime = 0;
  let stepIndex = 0;
  let schedulerTimer: ReturnType<typeof setInterval> | null = null;
  const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];
  let _currentStep = -1;

  function schedule() {
    if (!playing) return;
    const now = getClock();
    while (nextNoteTime < now + LOOKAHEAD) {
      const step = stepIndex;
      const midi = SEQUENCER_NOTES[step];
      const delay = Math.max(0, (nextNoteTime - now) * 1000);

      const t1 = setTimeout(() => {
        if (!playing) return;
        noteOn(midi);
        _currentStep = step;
        onStepChange?.(step);
      }, delay);

      const t2 = setTimeout(() => {
        if (!playing) return;
        noteOff(midi);
      }, delay + BEAT_DURATION * 1000 * 0.9);

      pendingTimeouts.push(t1, t2);
      nextNoteTime += BEAT_DURATION;
      stepIndex = (step + 1) % SEQUENCER_NOTES.length;
    }
  }

  function start() {
    if (playing) return;
    playing = true;
    stepIndex = 0;
    nextNoteTime = getClock() + 0.05;
    schedule();
    schedulerTimer = setInterval(schedule, SCHEDULE_INTERVAL);
  }

  function stop() {
    playing = false;
    _currentStep = -1;
    if (schedulerTimer !== null) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    for (const t of pendingTimeouts) clearTimeout(t);
    pendingTimeouts.length = 0;
  }

  return {
    isPlaying: () => playing,
    currentStep: () => _currentStep,
    start,
    stop,
  };
}

export interface SequencerHook {
  isPlaying: boolean;
  currentStep: number;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useSequencer(
  noteOn: (midi: number) => void,
  noteOff: (midi: number) => void,
  getAudioContext: () => { currentTime: number } | null,
): SequencerHook {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const noteOnRef = useRef(noteOn);
  const noteOffRef = useRef(noteOff);
  const getAudioContextRef = useRef(getAudioContext);
  noteOnRef.current = noteOn;
  noteOffRef.current = noteOff;
  getAudioContextRef.current = getAudioContext;

  const sequencerRef = useRef<Sequencer | null>(null);

  if (!sequencerRef.current) {
    sequencerRef.current = createSequencer(
      (midi) => noteOnRef.current(midi),
      (midi) => noteOffRef.current(midi),
      () => getAudioContextRef.current()?.currentTime ?? performance.now() / 1000,
      (step) => setCurrentStep(step),
    );
  }

  const start = useCallback(() => {
    sequencerRef.current!.start();
    setIsPlaying(true);
    setCurrentStep(-1);
  }, []);

  const stop = useCallback(() => {
    sequencerRef.current!.stop();
    setIsPlaying(false);
    setCurrentStep(-1);
  }, []);

  const toggle = useCallback(() => {
    if (sequencerRef.current!.isPlaying()) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  useEffect(() => {
    return () => {
      sequencerRef.current?.stop();
    };
  }, []);

  return { isPlaying, currentStep, start, stop, toggle };
}
