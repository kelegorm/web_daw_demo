export enum AudioModuleKind {
  SYNTH = 'SYNTH',
  PANNER = 'PANNER',
  TRACK_STRIP = 'TRACK_STRIP',
  LIMITER = 'LIMITER',
  MASTER_STRIP = 'MASTER_STRIP',
  DESTINATION = 'DESTINATION',
}

// Kinds that can serve as an edge source (have an output port)
const KINDS_WITH_OUTPUT = new Set<AudioModuleKind>([
  AudioModuleKind.SYNTH,
  AudioModuleKind.PANNER,
  AudioModuleKind.TRACK_STRIP,
  AudioModuleKind.LIMITER,
  AudioModuleKind.MASTER_STRIP,
]);

// Kinds that can serve as an edge target (have an input port)
const KINDS_WITH_INPUT = new Set<AudioModuleKind>([
  AudioModuleKind.PANNER,
  AudioModuleKind.TRACK_STRIP,
  AudioModuleKind.LIMITER,
  AudioModuleKind.MASTER_STRIP,
  AudioModuleKind.DESTINATION,
]);

export interface AudioGraphPlanNode {
  id: string;
  kind: AudioModuleKind;
}

export interface AudioGraphPlanEdge {
  from: string;
  to: string;
}

export interface AudioGraphPlan {
  nodes: AudioGraphPlanNode[];
  edges: AudioGraphPlanEdge[];
}

export function validateAudioGraphPlan(plan: AudioGraphPlan): void {
  const nodeIndex = new Map<string, number>();
  const nodeKindMap = new Map<string, AudioModuleKind>();

  plan.nodes.forEach((node, index) => {
    if (nodeIndex.has(node.id)) {
      throw new Error(`[audio-graph-plan] duplicate module id: ${node.id}`);
    }
    nodeIndex.set(node.id, index);
    nodeKindMap.set(node.id, node.kind);
  });

  for (const edge of plan.edges) {
    if (edge.from === edge.to) {
      throw new Error(`[audio-graph-plan] self-loop edge is not allowed: ${edge.from}`);
    }

    if (!nodeIndex.has(edge.from)) {
      throw new Error(`[audio-graph-plan] missing module id referenced by edge.from: ${edge.from}`);
    }

    if (!nodeIndex.has(edge.to)) {
      throw new Error(`[audio-graph-plan] missing module id referenced by edge.to: ${edge.to}`);
    }

    const fromKind = nodeKindMap.get(edge.from)!;
    if (!KINDS_WITH_OUTPUT.has(fromKind)) {
      throw new Error(`[audio-graph-plan] missing from.output for module: ${edge.from}`);
    }

    const toKind = nodeKindMap.get(edge.to)!;
    if (!KINDS_WITH_INPUT.has(toKind)) {
      throw new Error(`[audio-graph-plan] missing to.input for module: ${edge.to}`);
    }

    const fromIndex = nodeIndex.get(edge.from)!;
    const toIndex = nodeIndex.get(edge.to)!;
    if (fromIndex > toIndex) {
      throw new Error(`[audio-graph-plan] backward edge is not allowed: ${edge.from} -> ${edge.to}`);
    }
  }
}

/**
 * Default plan id for the synth module.
 * Tied to DEFAULT_AUDIO_GRAPH_PLAN only — not a generic contract for custom plans.
 */
export const DEFAULT_PLAN_SYNTH_ID = 'synth';

/**
 * Default plan id for the panner module.
 * Tied to DEFAULT_AUDIO_GRAPH_PLAN only — not a generic contract for custom plans.
 */
export const DEFAULT_PLAN_PANNER_ID = 'panner';

/**
 * Default plan id for the track-strip module.
 * Tied to DEFAULT_AUDIO_GRAPH_PLAN only — not a generic contract for custom plans.
 */
export const DEFAULT_PLAN_TRACK_STRIP_ID = 'track-strip';

/**
 * Default plan id for the limiter module.
 * Tied to DEFAULT_AUDIO_GRAPH_PLAN only — not a generic contract for custom plans.
 */
export const DEFAULT_PLAN_LIMITER_ID = 'limiter';

/**
 * Default plan id for the master-strip module.
 * Tied to DEFAULT_AUDIO_GRAPH_PLAN only — not a generic contract for custom plans.
 */
export const DEFAULT_PLAN_MASTER_STRIP_ID = 'master-strip';

/**
 * Default plan id for the destination module.
 * Tied to DEFAULT_AUDIO_GRAPH_PLAN only — not a generic contract for custom plans.
 */
export const DEFAULT_PLAN_DESTINATION_ID = 'destination';

export const DEFAULT_AUDIO_GRAPH_PLAN: AudioGraphPlan = {
  nodes: [
    { id: DEFAULT_PLAN_SYNTH_ID, kind: AudioModuleKind.SYNTH },
    { id: DEFAULT_PLAN_PANNER_ID, kind: AudioModuleKind.PANNER },
    { id: DEFAULT_PLAN_TRACK_STRIP_ID, kind: AudioModuleKind.TRACK_STRIP },
    { id: DEFAULT_PLAN_LIMITER_ID, kind: AudioModuleKind.LIMITER },
    { id: DEFAULT_PLAN_MASTER_STRIP_ID, kind: AudioModuleKind.MASTER_STRIP },
    { id: DEFAULT_PLAN_DESTINATION_ID, kind: AudioModuleKind.DESTINATION },
  ],
  edges: [
    { from: DEFAULT_PLAN_SYNTH_ID, to: DEFAULT_PLAN_PANNER_ID },
    { from: DEFAULT_PLAN_PANNER_ID, to: DEFAULT_PLAN_TRACK_STRIP_ID },
    { from: DEFAULT_PLAN_TRACK_STRIP_ID, to: DEFAULT_PLAN_LIMITER_ID },
    { from: DEFAULT_PLAN_LIMITER_ID, to: DEFAULT_PLAN_MASTER_STRIP_ID },
    { from: DEFAULT_PLAN_MASTER_STRIP_ID, to: DEFAULT_PLAN_DESTINATION_ID },
  ],
};
