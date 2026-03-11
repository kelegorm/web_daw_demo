import { useEffect, useState } from 'react';
import {
  createAudioEngine,
  DEFAULT_AUDIO_MODULE_FACTORY_MAP,
  type AudioEngine,
} from '../engine/audioEngine';
import { DEFAULT_AUDIO_GRAPH_PLAN } from '../engine/audioGraphPlan';

export function useAudioEngine(): AudioEngine | null {
  const [engine, setEngine] = useState<AudioEngine | null>(null);

  useEffect(() => {
    const createdEngine = createAudioEngine(DEFAULT_AUDIO_GRAPH_PLAN, DEFAULT_AUDIO_MODULE_FACTORY_MAP);
    setEngine(createdEngine);

    return () => {
      createdEngine.dispose();
    };
  }, []);

  return engine;
}
