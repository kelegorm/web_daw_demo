import { describe, expect, it } from 'vitest';
import {
  AudioModuleKind,
  DEFAULT_AUDIO_GRAPH_PLAN,
  validateAudioGraphPlan,
  type AudioGraphPlan,
} from './audioGraphPlan';

describe('DEFAULT_AUDIO_GRAPH_PLAN', () => {
  it('has six nodes in chain order', () => {
    const { nodes } = DEFAULT_AUDIO_GRAPH_PLAN;
    expect(nodes).toHaveLength(6);
    expect(nodes[0]).toEqual({ id: 'synth', kind: AudioModuleKind.SYNTH });
    expect(nodes[1]).toEqual({ id: 'panner', kind: AudioModuleKind.PANNER });
    expect(nodes[2]).toEqual({ id: 'track-strip', kind: AudioModuleKind.TRACK_STRIP });
    expect(nodes[3]).toEqual({ id: 'limiter', kind: AudioModuleKind.LIMITER });
    expect(nodes[4]).toEqual({ id: 'master-strip', kind: AudioModuleKind.MASTER_STRIP });
    expect(nodes[5]).toEqual({ id: 'destination', kind: AudioModuleKind.DESTINATION });
  });

  it('has five edges matching the current runtime chain', () => {
    const { edges } = DEFAULT_AUDIO_GRAPH_PLAN;
    expect(edges).toHaveLength(5);
    expect(edges[0]).toEqual({ from: 'synth', to: 'panner' });
    expect(edges[1]).toEqual({ from: 'panner', to: 'track-strip' });
    expect(edges[2]).toEqual({ from: 'track-strip', to: 'limiter' });
    expect(edges[3]).toEqual({ from: 'limiter', to: 'master-strip' });
    expect(edges[4]).toEqual({ from: 'master-strip', to: 'destination' });
  });

  it('passes validation', () => {
    expect(() => validateAudioGraphPlan(DEFAULT_AUDIO_GRAPH_PLAN)).not.toThrow();
  });
});

describe('validateAudioGraphPlan', () => {
  function makePlan(overrides: Partial<AudioGraphPlan>): AudioGraphPlan {
    return { ...DEFAULT_AUDIO_GRAPH_PLAN, ...overrides };
  }

  it('throws for duplicate node id', () => {
    const plan = makePlan({
      nodes: [
        { id: 'synth', kind: AudioModuleKind.SYNTH },
        { id: 'synth', kind: AudioModuleKind.PANNER },
      ],
    });
    expect(() => validateAudioGraphPlan(plan)).toThrow('duplicate module id: synth');
  });

  it('throws for missing module referenced by edge.from', () => {
    const plan = makePlan({
      edges: [{ from: 'missing', to: 'panner' }],
    });
    expect(() => validateAudioGraphPlan(plan)).toThrow(
      'missing module id referenced by edge.from: missing',
    );
  });

  it('throws for missing module referenced by edge.to', () => {
    const plan = makePlan({
      edges: [{ from: 'synth', to: 'missing' }],
    });
    expect(() => validateAudioGraphPlan(plan)).toThrow(
      'missing module id referenced by edge.to: missing',
    );
  });

  it('throws for self-loop edge', () => {
    const plan = makePlan({
      edges: [{ from: 'synth', to: 'synth' }],
    });
    expect(() => validateAudioGraphPlan(plan)).toThrow('self-loop edge is not allowed: synth');
  });

  it('throws for backward edge', () => {
    // track-strip appears after panner in nodes, so panner->track-strip is forward;
    // reversing it (track-strip->panner) is a backward edge.
    const plan = makePlan({
      edges: [{ from: 'track-strip', to: 'panner' }],
    });
    expect(() => validateAudioGraphPlan(plan)).toThrow('backward edge is not allowed: track-strip -> panner');
  });

  it('throws when from-node kind has no output (DESTINATION as source)', () => {
    const plan: AudioGraphPlan = {
      nodes: [
        { id: 'destination', kind: AudioModuleKind.DESTINATION },
        { id: 'master-strip', kind: AudioModuleKind.MASTER_STRIP },
      ],
      edges: [{ from: 'destination', to: 'master-strip' }],
    };
    expect(() => validateAudioGraphPlan(plan)).toThrow('missing from.output for module: destination');
  });

  it('throws when to-node kind has no input (SYNTH as target)', () => {
    const plan: AudioGraphPlan = {
      nodes: [
        { id: 'panner', kind: AudioModuleKind.PANNER },
        { id: 'synth', kind: AudioModuleKind.SYNTH },
      ],
      edges: [{ from: 'panner', to: 'synth' }],
    };
    expect(() => validateAudioGraphPlan(plan)).toThrow('missing to.input for module: synth');
  });

  it('accepts a minimal valid two-node plan', () => {
    const plan: AudioGraphPlan = {
      nodes: [
        { id: 'synth', kind: AudioModuleKind.SYNTH },
        { id: 'destination', kind: AudioModuleKind.DESTINATION },
      ],
      edges: [{ from: 'synth', to: 'destination' }],
    };
    expect(() => validateAudioGraphPlan(plan)).not.toThrow();
  });

  it('accepts a plan with no edges', () => {
    const plan: AudioGraphPlan = {
      nodes: [{ id: 'synth', kind: AudioModuleKind.SYNTH }],
      edges: [],
    };
    expect(() => validateAudioGraphPlan(plan)).not.toThrow();
  });
});
