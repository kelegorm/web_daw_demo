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

export interface TrackFacade {
  readonly meterSource: MeterSource;
  setGain(db: number): void;
  getGain(): number;
  setMute(muted: boolean): void;
  isMuted(): boolean;
  dispose(): void;
}

export interface MasterFacade {
  readonly meterSource: MeterSource;
  setGain(db: number): void;
  getGain(): number;
}

export interface DeviceFacade {
  readonly kind: string;
  readonly trackId: string;
  getParam(name: string): number | boolean;
  setParam(name: string, value: number | boolean): void;
}
