// @vitest-environment jsdom
import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from '../engine/audioEngine';
import { useAudioEngine } from './useAudioEngine';

vi.mock('../engine/audioEngine', () => ({
  createAudioEngine: vi.fn(),
  DEFAULT_AUDIO_MODULE_FACTORY_MAP: {},
}));

function Probe() {
  useAudioEngine();
  return null;
}

async function waitFor(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for condition');
}

describe('useAudioEngine', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it('disposes strict-mode mount instance before creating the next one and disposes final instance on unmount', async () => {
    const createAudioEngineMock = vi.mocked(createAudioEngine);
    const disposers: Array<ReturnType<typeof vi.fn>> = [];
    let activeEngines = 0;
    let maxActiveEngines = 0;

    createAudioEngineMock.mockImplementation(() => {
      activeEngines += 1;
      maxActiveEngines = Math.max(maxActiveEngines, activeEngines);

      const dispose = vi.fn(() => {
        activeEngines -= 1;
      });
      disposers.push(dispose);

      return {
        dispose,
      } as unknown as ReturnType<typeof createAudioEngine>;
    });

    flushSync(() => {
      root.render(
        <React.StrictMode>
          <Probe />
        </React.StrictMode>,
      );
    });

    await waitFor(() => createAudioEngineMock.mock.calls.length === 2 && disposers[0]?.mock.calls.length === 1);

    expect(maxActiveEngines).toBe(1);
    expect(activeEngines).toBe(1);
    expect(disposers).toHaveLength(2);
    expect(disposers[0]).toHaveBeenCalledTimes(1);
    expect(disposers[1]).not.toHaveBeenCalled();

    flushSync(() => {
      root.unmount();
    });

    await waitFor(() => disposers[1]?.mock.calls.length === 1);

    expect(disposers[1]).toHaveBeenCalledTimes(1);
    expect(activeEngines).toBe(0);
  });
});
