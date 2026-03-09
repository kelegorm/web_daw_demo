// Exposes global test helpers for E2E Playwright tests.
// Imported as a side-effect from main.tsx.
import synthProcessorUrl from './worklets/synth-processor.js?url';

declare global {
  interface Window {
    audioWorkletTest: () => Promise<{ success: boolean }>;
    __synthNode?: AudioWorkletNode;
    __synthCtx?: AudioContext;
  }
}

window.audioWorkletTest = async () => {
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule(synthProcessorUrl);
  const node = new AudioWorkletNode(ctx, 'synth-processor');

  // Fetch WASM in main thread (fetch is not reliable in AudioWorkletGlobalScope)
  // then transfer the ArrayBuffer to the worklet via port message.
  const wasmResponse = await fetch('/synth.wasm');
  const wasmBuffer   = await wasmResponse.arrayBuffer();

  const readyPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WASM load timeout')), 5000);
    node.port.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'ready') {
        clearTimeout(timeout);
        resolve();
      } else if (e.data.type === 'error') {
        clearTimeout(timeout);
        reject(new Error(String(e.data.message)));
      }
    };
  });

  // Transfer buffer (zero-copy) to the worklet
  node.port.postMessage({ type: 'load-wasm', buffer: wasmBuffer }, [wasmBuffer]);
  await readyPromise;

  node.connect(ctx.destination);
  window.__synthNode = node;
  window.__synthCtx  = ctx;
  return { success: true };
};
