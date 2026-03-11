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

export const DEFAULT_AUDIO_GRAPH_PLAN: AudioGraphPlan = {
  nodes: [
    { id: 'synth', kind: AudioModuleKind.SYNTH },
    { id: 'panner', kind: AudioModuleKind.PANNER },
    { id: 'track-strip', kind: AudioModuleKind.TRACK_STRIP },
    { id: 'limiter', kind: AudioModuleKind.LIMITER },
    { id: 'master-strip', kind: AudioModuleKind.MASTER_STRIP },
    { id: 'destination', kind: AudioModuleKind.DESTINATION },
  ],
  edges: [
    { from: 'synth', to: 'panner' },
    { from: 'panner', to: 'track-strip' },
    { from: 'track-strip', to: 'limiter' },
    { from: 'limiter', to: 'master-strip' },
    { from: 'master-strip', to: 'destination' },
  ],
};
