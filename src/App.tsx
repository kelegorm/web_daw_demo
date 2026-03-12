import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import TrackZone from './components/TrackZone'
import type { TrackZoneActions, TrackZoneModel } from './components/TrackZone'
import DevicePanel from './components/DevicePanel'
import MidiKeyboard from './components/MidiKeyboard'
import { useToneSynth } from './hooks/useToneSynth'
import { usePanner } from './hooks/usePanner'
import { useTrackStrip } from './hooks/useTrackStrip'
import { useMasterStrip } from './hooks/useMasterStrip'
import { useLimiter } from './hooks/useLimiter'
import { useTransportController } from './hooks/useTransportController'
import {
  useTrackSelection,
} from './hooks/useTrackSelection'
import type { AudioEngine } from './engine/audioEngine'
import { useAudioEngine } from './hooks/useAudioEngine'
import {
  DEFAULT_MIDI_CLIP_SOURCE,
  DEFAULT_MIDI_CLIP_STORE,
} from './project-runtime/midiClipStore'
import {
  DEFAULT_PLAN_SYNTH_ID,
  DEFAULT_PLAN_PANNER_ID,
  DEFAULT_PLAN_TRACK_STRIP_ID,
  DEFAULT_PLAN_LIMITER_ID,
  DEFAULT_PLAN_MASTER_STRIP_ID,
} from './engine/audioGraphPlan'
import { buildUiRuntime } from './ui-plan/buildUiRuntime'
import { DEFAULT_UI_PLAN } from './ui-plan/defaultUiPlan'
import { resolveInitialTrackId } from './ui-plan/uiPlan'
import './App.css'

declare global {
  interface Window {
    __panicCount?: number
    __activeSteps?: number[]
    __vuMeterLevel?: number
  }
}

const INITIAL_TRACK_ID = resolveInitialTrackId(DEFAULT_UI_PLAN)
const TRANSPORT_TRACK_STRIP_ID = DEFAULT_UI_PLAN.tracks[0]?.trackStripId

function App() {
  const audioEngine = useAudioEngine()

  if (!audioEngine) {
    return <div id="app" />
  }

  return <AppWithEngine audioEngine={audioEngine} />
}

function AppWithEngine({ audioEngine }: { audioEngine: AudioEngine }) {
  const toneSynth = useToneSynth(audioEngine.getSynth(DEFAULT_PLAN_SYNTH_ID))
  const panner = usePanner(audioEngine.getPanner(DEFAULT_PLAN_PANNER_ID))
  const trackStrip = useTrackStrip(audioEngine.getTrackStrip(DEFAULT_PLAN_TRACK_STRIP_ID))
  const masterStrip = useMasterStrip(audioEngine.getMasterStrip(DEFAULT_PLAN_MASTER_STRIP_ID))
  const limiter = useLimiter(audioEngine.getLimiter(DEFAULT_PLAN_LIMITER_ID))
  const transport = useTransportController(toneSynth, trackStrip, DEFAULT_MIDI_CLIP_SOURCE)
  const [trackRecByTrackId, setTrackRecByTrackId] = useState<Record<string, boolean>>({
    [INITIAL_TRACK_ID]: true,
  })
  const trackSelection = useTrackSelection(INITIAL_TRACK_ID)
  const uiRuntime = buildUiRuntime({
    uiPlan: DEFAULT_UI_PLAN,
    midiClipStore: DEFAULT_MIDI_CLIP_STORE,
    audioEngine,
    selectedTrackId: trackSelection.selectedTrack,
  })

  const trackZoneModel: TrackZoneModel = {
    playbackState: transport.playbackState,
    bpm: transport.bpm,
    loop: transport.loop,
    selectedTrackId: trackSelection.selectedTrack,
    getPositionSeconds: transport.getPositionSeconds,
    tracks: uiRuntime.trackZoneModel.tracks.map((runtimeTrack) => ({
      trackId: runtimeTrack.trackId,
      displayName: runtimeTrack.displayName,
      clips: runtimeTrack.clips,
      meterSource:
        runtimeTrack.trackStripId === TRANSPORT_TRACK_STRIP_ID
          ? trackStrip.meterSource
          : runtimeTrack.trackStrip.meterSource,
      volumeDb:
        runtimeTrack.trackStripId === TRANSPORT_TRACK_STRIP_ID
          ? trackStrip.trackVolume
          : runtimeTrack.trackStrip.trackVolume,
      isMuted:
        runtimeTrack.trackStripId === TRANSPORT_TRACK_STRIP_ID
          ? trackStrip.isTrackMuted
          : runtimeTrack.trackStrip.isTrackMuted,
      isRecEnabled: trackRecByTrackId[runtimeTrack.trackId] ?? false,
    })),
    masterTrack: {
      trackId: uiRuntime.trackZoneModel.masterTrack.trackId,
      displayName: uiRuntime.trackZoneModel.masterTrack.displayName,
      meterSource: masterStrip.meterSource,
      volumeDb: masterStrip.masterVolume,
    },
  }

  const devicePanelModel = {
    ...uiRuntime.devicePanelModel,
    devices: uiRuntime.devicePanelModel.devices.map((device) => {
      if (device.moduleId === DEFAULT_PLAN_SYNTH_ID) {
        return { ...device, module: toneSynth }
      }
      if (device.moduleId === DEFAULT_PLAN_PANNER_ID) {
        return { ...device, module: panner }
      }
      if (device.moduleId === DEFAULT_PLAN_LIMITER_ID) {
        return { ...device, module: limiter }
      }
      return device
    }),
  }

  const trackZoneActions: TrackZoneActions = {
    selectTrack: (trackId) => trackSelection.selectTrack(trackId),
    setTrackMute: (trackId, muted) => {
      const runtimeTrack = uiRuntime.trackZoneModel.tracks.find((track) => track.trackId === trackId)
      if (!runtimeTrack) {
        return
      }

      if (runtimeTrack.trackStripId === TRANSPORT_TRACK_STRIP_ID) {
        transport.setTrackMute(muted)
        return
      }

      runtimeTrack.trackStrip.setTrackMuted(muted)
    },
    setTrackRecEnabled: (trackId, recEnabled) => {
      setTrackRecByTrackId((current) => ({ ...current, [trackId]: recEnabled }))
    },
    setTrackVolume: (trackId, db) => {
      const runtimeTrack = uiRuntime.trackZoneModel.tracks.find((track) => track.trackId === trackId)
      if (!runtimeTrack) {
        return
      }

      if (runtimeTrack.trackStripId === TRANSPORT_TRACK_STRIP_ID) {
        trackStrip.setTrackVolume(db)
        return
      }

      runtimeTrack.trackStrip.setTrackVolume(db)
    },
    setMasterVolume: (db) => masterStrip.setMasterVolume(db),
  }

  useEffect(() => {
    window.__panicCount = 0
    window.__activeSteps = []
  }, [])

  useEffect(() => {
    if (transport.currentStep >= 0) {
      window.__activeSteps = [...(window.__activeSteps ?? []), transport.currentStep]
    }
  }, [transport.currentStep])

  const handlePanic = () => {
    transport.panic()
    window.__panicCount = (window.__panicCount ?? 0) + 1
  }

  return (
    <div id="app">
      <Toolbar
        isPlaying={transport.isPlaying}
        onPlay={transport.toggle}
        onStop={transport.stop}
        onPanic={handlePanic}
        bpm={transport.bpm}
        onBpmChange={transport.setBpm}
        loop={transport.loop}
        onLoopToggle={() => transport.setLoop(!transport.loop)}
      />
      <TrackZone
        model={trackZoneModel}
        actions={trackZoneActions}
      />
      <DevicePanel model={devicePanelModel} />
      <MidiKeyboard synth={toneSynth} enabled={trackRecByTrackId[INITIAL_TRACK_ID] ?? false} />
    </div>
  )
}

export default App
