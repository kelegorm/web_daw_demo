import { useRef, useCallback, useState } from 'react';
import * as Tone from 'tone';
import {
  AUDIO_DB_MAX,
  AUDIO_DB_MIN,
  SYNTH_ENABLED_DEFAULT,
  SYNTH_FILTER_CUTOFF_DEFAULT_HZ,
  SYNTH_VOICE_SPREAD_DEFAULT,
  SYNTH_VOLUME_DEFAULT_DB,
} from '../audio/parameterDefaults';

export interface ToneSynthHook {
  isEnabled: boolean;
  filterCutoff: number;
  voiceSpread: number;
  volume: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createToneSynth(): ToneSynthHook {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.3 },
  });

  const filter = new Tone.Filter(SYNTH_FILTER_CUTOFF_DEFAULT_HZ, 'lowpass');
  synth.connect(filter);
  synth.volume.value = SYNTH_VOLUME_DEFAULT_DB;

  let enabled = SYNTH_ENABLED_DEFAULT;
  let filterCutoff = SYNTH_FILTER_CUTOFF_DEFAULT_HZ;
  let voiceSpread = SYNTH_VOICE_SPREAD_DEFAULT;
  let volume = SYNTH_VOLUME_DEFAULT_DB;

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
    filterCutoff = clamp(hz, 20, 20000);
    filter.frequency.value = filterCutoff;
  }

  function setVoiceSpread(value: number) {
    voiceSpread = clamp(value, 0, 1);
    synth.set({ detune: voiceSpread * 50 });
  }

  function setVolume(db: number) {
    volume = isFinite(db)
      ? clamp(db, AUDIO_DB_MIN, AUDIO_DB_MAX)
      : -Infinity;
    synth.volume.value = enabled ? volume : -Infinity;
  }

  function setEnabled(isEnabled: boolean) {
    if (isEnabled === enabled) return;
    enabled = isEnabled;
    synth.volume.value = enabled ? volume : -Infinity;
  }

  function getSynth() {
    return synth;
  }

  function getOutput(): Tone.ToneAudioNode {
    return filter;
  }

  return {
    get isEnabled() {
      return enabled;
    },
    get filterCutoff() {
      return filterCutoff;
    },
    get voiceSpread() {
      return voiceSpread;
    },
    get volume() {
      return volume;
    },
    noteOn,
    noteOff,
    panic,
    setFilterCutoff,
    setVoiceSpread,
    setVolume,
    setEnabled,
    getSynth,
    getOutput,
  };
}

export function useToneSynth(existingSynth: ToneSynthHook): ToneSynthHook {
  const synthRef = useRef<ToneSynthHook>(existingSynth);
  synthRef.current = existingSynth;

  const [isEnabled, setIsEnabledState] = useState(synthRef.current.isEnabled);
  const [filterCutoff, setFilterCutoffState] = useState(synthRef.current.filterCutoff);
  const [voiceSpread, setVoiceSpreadState] = useState(synthRef.current.voiceSpread);
  const [volume, setVolumeState] = useState(synthRef.current.volume);

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
    const synth = synthRef.current!;
    synth.setFilterCutoff(hz);
    setFilterCutoffState(synth.filterCutoff);
  }, []);

  const setVoiceSpread = useCallback((value: number) => {
    const synth = synthRef.current!;
    synth.setVoiceSpread(value);
    setVoiceSpreadState(synth.voiceSpread);
  }, []);

  const setVolume = useCallback((db: number) => {
    const synth = synthRef.current!;
    synth.setVolume(db);
    setVolumeState(synth.volume);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    const synth = synthRef.current!;
    synth.setEnabled(enabled);
    setIsEnabledState(synth.isEnabled);
  }, []);

  const getSynth = useCallback(() => {
    return synthRef.current!.getSynth();
  }, []);

  const getOutput = useCallback(() => {
    return synthRef.current!.getOutput();
  }, []);

  return {
    isEnabled,
    filterCutoff,
    voiceSpread,
    volume,
    noteOn,
    noteOff,
    panic,
    setFilterCutoff,
    setVoiceSpread,
    setVolume,
    setEnabled,
    getSynth,
    getOutput,
  };
}
