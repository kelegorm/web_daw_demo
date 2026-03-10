import { describe, it, expect } from 'vitest';
import { createTrackSelection } from './useTrackSelection';

describe('createTrackSelection', () => {
  it('defaults selectedTrack to synth1', () => {
    const { selectedTrack } = createTrackSelection();
    expect(selectedTrack).toBe('synth1');
  });

  it('selectTrack("master") updates selectedTrack to "master"', () => {
    const ts = createTrackSelection();
    ts.selectTrack('master');
    expect(ts.selectedTrack).toBe('master');
  });

  it('selectTrack("synth1") updates selectedTrack to "synth1"', () => {
    const ts = createTrackSelection();
    ts.selectTrack('master');
    ts.selectTrack('synth1');
    expect(ts.selectedTrack).toBe('synth1');
  });
});
