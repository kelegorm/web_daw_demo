import { useRef, useCallback } from 'react';
import * as Tone from 'tone';

export interface ToneSynthHook {
  noteOn: (midi: number, velocity?: number) => void;
  noteOff: (midi: number) => void;
  panic: () => void;
  setFilterCutoff: (hz: number) => void;
  setVoiceSpread: (value: number) => void;
  setVolume: (db: number) => void;
  setEnabled: (enabled: boolean) => void;
  getSynth: () => Tone.PolySynth | null;
  getOutput: () => Tone.ToneAudioNode;
}

export function createToneSynth(): ToneSynthHook {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.3 },
  });

  const filter = new Tone.Filter(2000, 'lowpass');
  synth.connect(filter);
  filter.connect(Tone.getDestination());

  function midiToNote(midi: number): string {
    return Tone.Frequency(midi, 'midi').toNote();
  }

  function noteOn(midi: number, velocity = 100) {
    const note = midiToNote(midi);
    const normVelocity = velocity / 127;
    synth.triggerAttack(note, Tone.now(), normVelocity);
  }

  function noteOff(midi: number) {
    const note = midiToNote(midi);
    synth.triggerRelease(note, Tone.now());
  }

  function panic() {
    synth.releaseAll();
  }

  function setFilterCutoff(hz: number) {
    filter.frequency.value = hz;
  }

  function setVoiceSpread(value: number) {
    synth.set({ detune: value * 50 });
  }

  function setVolume(db: number) {
    synth.volume.value = db;
  }

  function setEnabled(isEnabled: boolean) {
    if (isEnabled) {
      filter.connect(Tone.getDestination());
    } else {
      filter.disconnect(Tone.getDestination());
    }
  }

  function getSynth() {
    return synth;
  }

  function getOutput(): Tone.ToneAudioNode {
    return filter;
  }

  return { noteOn, noteOff, panic, setFilterCutoff, setVoiceSpread, setVolume, setEnabled, getSynth, getOutput };
}

export function useToneSynth(): ToneSynthHook {
  const synthRef = useRef<ToneSynthHook | null>(null);

  if (!synthRef.current) {
    synthRef.current = createToneSynth();
  }

  const noteOn = useCallback((midi: number, velocity = 100) => {
    synthRef.current!.noteOn(midi, velocity);
  }, []);

  const noteOff = useCallback((midi: number) => {
    synthRef.current!.noteOff(midi);
  }, []);

  const panic = useCallback(() => {
    synthRef.current!.panic();
  }, []);

  const setFilterCutoff = useCallback((hz: number) => {
    synthRef.current!.setFilterCutoff(hz);
  }, []);

  const setVoiceSpread = useCallback((value: number) => {
    synthRef.current!.setVoiceSpread(value);
  }, []);

  const setVolume = useCallback((db: number) => {
    synthRef.current!.setVolume(db);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    synthRef.current!.setEnabled(enabled);
  }, []);

  const getSynth = useCallback(() => {
    return synthRef.current!.getSynth();
  }, []);

  const getOutput = useCallback(() => {
    return synthRef.current!.getOutput();
  }, []);

  return { noteOn, noteOff, panic, setFilterCutoff, setVoiceSpread, setVolume, setEnabled, getSynth, getOutput };
}
