import { useRef, useState, useCallback, useEffect } from 'react';
import * as Tone from 'tone';

export const SEQUENCER_NOTES = [60, 62, 64, 65, 67, 69, 71, 72];

interface StepEvent {
  note: number;
  step: number;
}

export interface Sequencer {
  isPlaying: () => boolean;
  currentStep: () => number;
  start: () => void;
  pause: () => void;
  stop: () => void;
  setLoop: (loop: boolean) => void;
}

export function createSequencer(
  noteOn: (midi: number, velocity: number) => void,
  noteOff: (midi: number) => void,
  panic: () => void,
  onStepChange?: (step: number) => void,
): Sequencer {
  let _currentStep = -1;
  let _isPlaying = false;
  let _active = false;
  let _partStarted = false;
  const loopEnd = '1m';

  const events: [string, StepEvent][] = SEQUENCER_NOTES.map((note, i) => {
    const beat = Math.floor(i / 2);
    const sixteenth = (i % 2) * 2;
    return [`0:${beat}:${sixteenth}`, { note, step: i }];
  });

  const part = new Tone.Part<StepEvent>((_time, { note, step }) => {
    if (!_active) return;
    if (typeof window !== 'undefined') {
      window.__sequencerTicks = (window.__sequencerTicks ?? 0) + 1;
    }
    noteOn(note, 100);
    _currentStep = step;
    onStepChange?.(step);
    const delayMs = Tone.Time('8n').toSeconds() * 0.8 * 1000;
    setTimeout(() => {
      if (_active) noteOff(note);
    }, delayMs);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, events as any);

  function setLoop(loop: boolean) {
    part.loop = loop;
    part.loopEnd = loopEnd;

    const transport = Tone.getTransport();
    transport.loop = loop;
    transport.loopStart = 0;
    transport.loopEnd = loopEnd;
  }

  setLoop(true);

  function start() {
    _active = true;
    _isPlaying = true;
    if (!_partStarted) {
      part.start(0);
      _partStarted = true;
    }
    Tone.getTransport().start();
  }

  function pause() {
    _isPlaying = false;
    Tone.getTransport().pause();
  }

  function stop() {
    _active = false;
    _isPlaying = false;
    _currentStep = -1;
    _partStarted = false;
    // Clear scheduled start/stop state so the next play starts cleanly.
    part.stop(0);
    part.cancel(0);
    Tone.getTransport().stop();
    panic();
    onStepChange?.(-1);
  }

  return {
    isPlaying: () => _isPlaying,
    currentStep: () => _currentStep,
    start,
    pause,
    stop,
    setLoop,
  };
}

export interface SequencerHook {
  isPlaying: boolean;
  currentStep: number;
  start: () => void;
  pause: () => void;
  stop: () => void;
  toggle: () => void;
  setLoop: (loop: boolean) => void;
}

export function useSequencer(
  noteOn: (midi: number, velocity?: number) => void,
  noteOff: (midi: number) => void,
  panic: () => void,
): SequencerHook {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const noteOnRef = useRef(noteOn);
  const noteOffRef = useRef(noteOff);
  const panicRef = useRef(panic);
  noteOnRef.current = noteOn;
  noteOffRef.current = noteOff;
  panicRef.current = panic;

  const sequencerRef = useRef<Sequencer | null>(null);

  if (!sequencerRef.current) {
    sequencerRef.current = createSequencer(
      (midi, velocity) => noteOnRef.current(midi, velocity),
      (midi) => noteOffRef.current(midi),
      () => panicRef.current(),
      (step) => setCurrentStep(step),
    );
  }

  const start = useCallback(async () => {
    await Tone.start();
    sequencerRef.current!.start();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    sequencerRef.current!.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    sequencerRef.current!.stop();
    setIsPlaying(false);
    setCurrentStep(-1);
  }, []);

  const toggle = useCallback(async () => {
    if (sequencerRef.current!.isPlaying()) {
      pause();
    } else {
      await start();
    }
  }, [start, pause]);

  const setLoop = useCallback((loop: boolean) => {
    sequencerRef.current!.setLoop(loop);
  }, []);

  useEffect(() => {
    return () => {
      sequencerRef.current?.stop();
    };
  }, []);

  return { isPlaying, currentStep, start, pause, stop, toggle, setLoop };
}
