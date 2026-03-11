import { useEffect, useState } from 'react';
import { createAudioEngine, type AudioEngine } from '../engine/audioEngine';

export function useAudioEngine(): AudioEngine | null {
  const [engine, setEngine] = useState<AudioEngine | null>(null);

  useEffect(() => {
    const createdEngine = createAudioEngine();
    setEngine(createdEngine);

    return () => {
      createdEngine.dispose();
    };
  }, []);

  return engine;
}
