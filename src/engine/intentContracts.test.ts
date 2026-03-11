/**
 * Type-level tests: public UI-hook types must not include AudioNode / Tone.* members.
 * These tests are compile-time checks encoded as runtime assertions on the interface shape.
 */
import { describe, it } from 'vitest';
import { expectTypeOf } from 'vitest';
import type { ToneSynthHook } from '../hooks/useToneSynth';
import type { PannerHook } from '../hooks/usePanner';
import type { TrackStripHook } from '../hooks/useTrackStrip';
import type { MasterStripHook } from '../hooks/useMasterStrip';
import type { LimiterHook } from '../hooks/useLimiter';
import type { MeterSource } from './types';

describe('public hook types have no AudioNode / Tone.* exposure', () => {
  it('ToneSynthHook does not have getSynth or getOutput', () => {
    expectTypeOf<ToneSynthHook>().not.toHaveProperty('getSynth');
    expectTypeOf<ToneSynthHook>().not.toHaveProperty('getOutput');
  });

  it('PannerHook does not have AudioNode properties', () => {
    expectTypeOf<PannerHook>().not.toHaveProperty('input');
    expectTypeOf<PannerHook>().not.toHaveProperty('output');
    expectTypeOf<PannerHook>().not.toHaveProperty('connectSource');
    expectTypeOf<PannerHook>().not.toHaveProperty('dispose');
  });

  it('TrackStripHook does not expose AudioNode', () => {
    expectTypeOf<TrackStripHook>().not.toHaveProperty('input');
    expectTypeOf<TrackStripHook>().not.toHaveProperty('output');
    expectTypeOf<TrackStripHook>().not.toHaveProperty('dispose');
  });

  it('TrackStripHook exposes meterSource', () => {
    expectTypeOf<TrackStripHook>().toHaveProperty('meterSource').toEqualTypeOf<MeterSource>();
  });

  it('MasterStripHook does not expose AudioNode', () => {
    expectTypeOf<MasterStripHook>().not.toHaveProperty('input');
    expectTypeOf<MasterStripHook>().not.toHaveProperty('output');
    expectTypeOf<MasterStripHook>().not.toHaveProperty('dispose');
  });

  it('MasterStripHook exposes meterSource', () => {
    expectTypeOf<MasterStripHook>().toHaveProperty('meterSource').toEqualTypeOf<MeterSource>();
  });

  it('LimiterHook does not expose AudioNode or Tone nodes', () => {
    expectTypeOf<LimiterHook>().not.toHaveProperty('input');
    expectTypeOf<LimiterHook>().not.toHaveProperty('output');
    expectTypeOf<LimiterHook>().not.toHaveProperty('dispose');
  });

  it('LimiterHook exposes meterSource', () => {
    expectTypeOf<LimiterHook>().toHaveProperty('meterSource').toEqualTypeOf<MeterSource>();
  });

  it('LimiterHook still exposes getReductionDb as intent-level method', () => {
    expectTypeOf<LimiterHook>().toHaveProperty('getReductionDb');
  });
});
