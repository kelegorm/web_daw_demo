import { createElement, type ReactElement } from 'react'
import type { AudioEngine } from '../engine/audioEngine'
import type { ModuleKind } from '../engine/types'
import type { LimiterHook } from '../hooks/useLimiter'
import type { PannerHook } from '../hooks/usePanner'
import type { ToneSynthHook } from '../hooks/useToneSynth'
import LimiterDevice from '../components/LimiterDevice'
import PannerDevice from '../components/PannerDevice'
import SynthDevice from '../components/SynthDevice'

export type DeviceModuleByKind = {
  SYNTH: ToneSynthHook
  PANNER: PannerHook
  LIMITER: LimiterHook
}

export type DeviceModuleKind = keyof DeviceModuleByKind
export type AnyDeviceModule = DeviceModuleByKind[DeviceModuleKind]

export interface DeviceRenderRequest {
  uiDeviceId: string
  displayName: string
  moduleKind: DeviceModuleKind
  module: AnyDeviceModule
}

export interface DeviceRegistryEntry {
  moduleKind: DeviceModuleKind
  resolveModule: (audioEngine: AudioEngine, moduleId: string) => AnyDeviceModule
  render: (request: DeviceRenderRequest) => ReactElement
}

export const DEVICE_REGISTRY: Record<DeviceModuleKind, DeviceRegistryEntry> = {
  SYNTH: {
    moduleKind: 'SYNTH',
    resolveModule: (audioEngine, moduleId) => audioEngine.getSynth(moduleId),
    render: ({ module }) => createElement(SynthDevice, { synth: module as ToneSynthHook }),
  },
  PANNER: {
    moduleKind: 'PANNER',
    resolveModule: (audioEngine, moduleId) => audioEngine.getPanner(moduleId),
    render: ({ module }) => createElement(PannerDevice, { panner: module as PannerHook }),
  },
  LIMITER: {
    moduleKind: 'LIMITER',
    resolveModule: (audioEngine, moduleId) => audioEngine.getLimiter(moduleId),
    render: ({ module }) => createElement(LimiterDevice, { limiter: module as LimiterHook }),
  },
}

export function isDeviceModuleKind(moduleKind: ModuleKind): moduleKind is DeviceModuleKind {
  return moduleKind in DEVICE_REGISTRY
}

export function getDeviceRegistryEntry(moduleKind: ModuleKind): DeviceRegistryEntry {
  if (!isDeviceModuleKind(moduleKind)) {
    throw new Error(`[ui-plan] unsupported ui device module kind: ${moduleKind}`)
  }

  return DEVICE_REGISTRY[moduleKind]
}

export function renderDeviceFromRegistry(request: DeviceRenderRequest): ReactElement {
  return getDeviceRegistryEntry(request.moduleKind).render(request)
}
