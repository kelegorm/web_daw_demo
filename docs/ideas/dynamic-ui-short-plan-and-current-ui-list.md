# Dynamic UI: Short Plan and Exact Current UI List

## Short Plan

1. Keep fixed shells always mounted: `Toolbar`, `TrackZone`, `DevicePanel`, `MidiKeyboard`.
2. Keep `Master Track` always present inside `TrackZone`.
3. Build dynamic parts from `UiPlan` + runtime only:
   - regular track rows in `TrackZone`
   - selected track device list in `DevicePanel`
4. Introduce one bridge layer (`useUiBindings`) that maps:
   - input: `uiPlan`, `audioEngine`, `midiClipStore`, selection/transport state
   - output: `trackZoneModel`, `trackZoneActions`, `devicePanelModel`
5. Simplify `App.tsx` to composition root only (no `APP_*` constants, no hardcoded module routing).
6. Selection rule for devices:
   - master selected -> devices from `UiPlan.masterTrack.devices`
   - regular track selected -> devices from selected `UiPlan.tracks[i].devices`
7. Definition of done: UI structure changes are made through `UiPlan` + runtime inputs, not by editing `App` wiring branches.

## Exact Current UI List

### Top-level components rendered by `App`

- `Toolbar` (`src/components/Toolbar.tsx`)
- `TrackZone` (`src/components/TrackZone.tsx`)
- `DevicePanel` (`src/components/DevicePanel.tsx`)
- `MidiKeyboard` (`src/components/MidiKeyboard.tsx`)

### `TrackZone` internal UI

- `TimelineRuler`
- Regular track rows rendered from `model.tracks.map(...)`
- `VUMeter` for track strips (when meter source exists)
- `Playhead` overlay
- `Master Track` row is always rendered as a dedicated internal row
- `VUMeter` for master strip (when meter source exists)

### `DevicePanel` internal UI

- Left track-name strip (selected track label)
- Dynamic device area rendered from `model.devices.map(...)`
- Device rendering goes through `renderDeviceFromRegistry(...)`

### Device components currently supported by registry

- `SynthDevice`
- `PannerDevice`
- `LimiterDevice`

### Shared nested UI used by device components

- `Knob` (used by Synth/Panner/Limiter)
- `VUMeter` (used by Limiter input meter)

### Components present in `src/components` but not mounted by current `App`

- `ParameterPanel`
- `PianoKeyboard`
- `SequencerDisplay`
- `Transport`
