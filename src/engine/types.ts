export interface AudioModule {
  input?: AudioNode;
  output?: AudioNode;
  init?(): void | Promise<void>;
  dispose(): void;
}

export interface MeterFrame {
  leftRms: number;
  rightRms: number;
  leftPeak: number;
  rightPeak: number;
}

export interface MeterSource {
  subscribe(cb: (frame: MeterFrame) => void): () => void;
}
