export interface AudioModule {
  input?: AudioNode;
  output?: AudioNode;
  init?(): void | Promise<void>;
  dispose(): void;
}

export const MODULE_KINDS = [
  'SYNTH',
  'PANNER',
  'TRACK_STRIP',
  'LIMITER',
  'MASTER_STRIP',
  'DESTINATION',
] as const

export type ModuleKind = (typeof MODULE_KINDS)[number]

export interface MeterFrame {
  leftRms: number;
  rightRms: number;
  leftPeak: number;
  rightPeak: number;
}

export interface MeterSource {
  subscribe(cb: (frame: MeterFrame) => void): () => void;
}
