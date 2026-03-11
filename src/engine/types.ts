export interface AudioModule {
  input?: AudioNode;
  output?: AudioNode;
  init?(): void | Promise<void>;
  dispose(): void;
}
