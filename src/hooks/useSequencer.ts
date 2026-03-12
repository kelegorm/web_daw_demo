import { useRef, useState, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { getE2EHooks } from '../testing/e2eHooks';
import {
  DEFAULT_MIDI_CLIP_ID,
  DEFAULT_MIDI_CLIP_STORE,
  getMidiClipOrThrow,
} from '../project-runtime/midiClipStore';
import {
  createTransportService,
  type SequencerTransport,
  type TransportService,
} from '../engine/transportService';

const DEFAULT_SEQUENCER_CLIP = getMidiClipOrThrow(DEFAULT_MIDI_CLIP_STORE, DEFAULT_MIDI_CLIP_ID);

export const SEQUENCER_NOTES = DEFAULT_SEQUENCER_CLIP.steps.map((step) => step.note);

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
  noteOn: (midi: number, velocity: number, time?: number) => void,
  noteOff: (midi: number, time?: number) => void,
  panic: () => void,
  transport: SequencerTransport,
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

  const part = new Tone.Part<StepEvent>((time, { note, step }) => {
    if (!_active) return;
    const e2eHooks = getE2EHooks();
    if (e2eHooks) {
      e2eHooks.sequencerTicks += 1;
      e2eHooks.sequencerNoteOnSent += 1;
    }
    noteOn(note, 100, time);
    _currentStep = step;
    onStepChange?.(step);
    const noteDuration = Tone.Time('8n').toSeconds() * 0.8;
    if (e2eHooks) {
      e2eHooks.sequencerNoteOffSent += 1;
    }
    noteOff(note, time + noteDuration);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, events as any);

  function setLoop(loop: boolean) {
    part.loop = loop;
    part.loopEnd = loopEnd;
    transport.setLoopConfig(loop, loopEnd);
  }

  setLoop(true);

  function start() {
    _active = true;
    _isPlaying = true;
    if (!_partStarted) {
      part.start(0);
      _partStarted = true;
    }
    transport.start();
  }

  function pause() {
    _isPlaying = false;
    transport.pause();
  }

  function stop() {
    _active = false;
    _isPlaying = false;
    _currentStep = -1;
    _partStarted = false;
    // Clear scheduled start/stop state so the next play starts cleanly.
    part.stop(0);
    part.cancel(0);
    transport.stop();
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
  noteOn: (midi: number, velocity?: number, time?: number) => void,
  noteOff: (midi: number, time?: number) => void,
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
  const serviceRef = useRef<TransportService | null>(null);

  if (!serviceRef.current) {
    serviceRef.current = createTransportService(120);
  }

  const sequencerRef = useRef<Sequencer | null>(null);

  if (!sequencerRef.current) {
    sequencerRef.current = createSequencer(
      (midi, velocity, time) => noteOnRef.current(midi, velocity, time),
      (midi, time) => noteOffRef.current(midi, time),
      () => panicRef.current(),
      serviceRef.current,
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
      serviceRef.current?.dispose();
    };
  }, []);

  return { isPlaying, currentStep, start, pause, stop, toggle, setLoop };
}
