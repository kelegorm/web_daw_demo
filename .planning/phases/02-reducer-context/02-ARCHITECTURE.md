# Phase 2: Architecture — Four-Layer Data Model

## Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  LAYER 1: DOMAIN MODEL                                              │
│  src/state/                                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    ProjectDocument (as in music document, because potentially there can be different projects/documents)                             │    │
│  │          (pure data — no audio, no UI knowledge)            │    │
│  │                                                              │    │
│  │  tracks: {                                                   │    │
│  │    byId: {                                                   │    │
│  │      "track-1": {                                            │    │
│  │        id, displayName,                                      │    │
│  │        deviceIds: ["dev-1", "dev-2"],                       │    │
│  │        clipIds: ["clip-1"]                                   │    │
│  │      }                                                       │    │
│  │    }                                                         │    │
│  │    ids: ["track-1"]                                          │    │
│  │  }                                                           │    │
│  │                                                              │    │
│  │  devices: {                                                  │    │
│  │    byId: {                                                   │    │
│  │      "dev-1": { id, kind: "SYNTH", name: "Synth" }         │    │
│  │      "dev-2": { id, kind: "PANNER", name: "Panner" }       │    │
│  │      "dev-lim": { id, kind: "LIMITER", name: "Limiter" }   │    │
│  │    }                                                         │    │
│  │  }                                                           │    │
│  │                                                              │    │
│  │  clips: {                                                    │    │
│  │    byId: {                                                   │    │
│  │      "clip-1": { clipId, startBeat, lengthSteps, steps[] }  │    │
│  │    }                                                         │    │
│  │  }                                                           │    │
│  │                                                              │    │
│  │  masterTrack: {                                              │    │
│  │    id: "master", displayName: "Master",                     │    │
│  │    deviceIds: ["dev-lim"]                                    │    │
│  │  }                                                           │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  UiState (separate from ProjectState)                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  selectedTrackId: "track-1"  // to be expanded in the future                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  State transitions via internal reducer (pure functions):           │
│    projectReducer(state, action) → ProjectState                    │
│    uiReducer(state, action) → UiState                              │
│    dawReducer delegates to both based on action type               │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LAYER 2: APPLICATION CONTROLLER (Binding Node)                     │
│  src/state/                                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  DawStore (class) - BLoC like in FLUTTER                             │    │
│  │     Owns state + coordinates engine + generates IDs         │    │
incapsulate what you can into separate parts, SMALL AND PRETTY good and 💅
Example - all logic reguarding validating and creating new id and cache all existing ids so they never be used again and old ids never be reused - this logic should be in one place
│  │                                                              │    │
│  │  Private:                                                    │    │
│  │    #state: { project: ProjectState, ui: UiState }           │    │
│  │    #engine: AudioEngine                                      │    │
│  │    #listeners: Set<() => void>                               │    │
│  │                                                              │    │
│  │  Public methods:                                             │    │
│  │    addTrack():                                               │    │
│  │      1. generate new ID                                      │    │
│  │      2. engine.createTrackSubgraph(id)  ← engine first      │    │
│  │      3. dispatch(ADD_TRACK) internally  ← state second      │    │
│  │      4. notify listeners                                     │    │
│  │                                                              │    │
│  │    removeTrack(id):                                          │    │
│  │      1. engine.removeTrackSubgraph(id)  ← engine first      │    │
│  │      2. dispatch(REMOVE_TRACK) internally                    │    │
│  │      3. notify listeners                                     │    │
│  │                                                              │    │
│  │    selectTrack(id):                                          │    │
│  │      1. dispatch(SELECT_TRACK) internally ← UI only         │    │
│  │      2. notify listeners                                     │    │
│  │                                                              │    │
│  │  For useSyncExternalStore:                                   │    │
│  │    subscribe(listener): () => void                           │    │
│  │    getProjectSnapshot(): ProjectState                        │    │
│  │    getUiSnapshot(): UiState                                  │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LAYER 3: REACT BRIDGE                                              │
│  src/context/                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  DawProvider                                  │    │
│  │     Bridges DawStore → React contexts                        │    │
│  │                                                              │    │
│  │  ProjectContext ← useSyncExternalStore(store.subscribe,      │    │
│  │                     store.getProjectSnapshot)                │    │
│  │  UiContext ← useSyncExternalStore(store.subscribe,           │    │
│  │               store.getUiSnapshot)                           │    │
│  │  DispatchContext ← store methods (addTrack, selectTrack...) │    │
│  │                                                              │    │
│  │  Hooks (exported from src/context/):                         │    │
│  │    useProjectState() → ProjectState                          │    │
│  │    useUiState() → UiState                                    │    │
│  │    useDawDispatch() → { addTrack, removeTrack, selectTrack } │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Audio engine should not have to rely on react updates!    │
│  LAYER 3a - AUDIO ENGINE (peer to components, not a layer above/below)         │
│  src/engine/                                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │   AudioEngine (singleton)                                    │    │
│  │   Called by DawStore methods, read by components for meters  │    │
│  │                                                              │    │
│  │   TrackFacade: .setGain() .setMute() .setRecArm()          │    │
│  │                .getMeterL/R() .setPan()                      │    │
│  │   MasterFacade: .setGain() .getMeterL/R()                   │    │
│  │   LimiterFacade: .getGainReduction()                        │    │
│  └─────────────────────────────────────────────────────────────┘ 
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LAYER 4: UI COMPONENTS                                             │
│  src/components/                                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                                                              │    │
│  │  TrackZone:                                                  │    │
│  │    structure: useProjectState() → tracks, clips              │    │
│  │    selection: useUiState() → selectedTrackId                 │    │
│  │    audio:     engine.getTrackFacade(id) → meters, gain      │    │
│  │                                                              │    │
│  │  DevicePanel:                                                │    │
│  │    selection: useUiState() → selectedTrackId                 │    │
│  │    devices:   useProjectState() → track/master deviceIds    │    │
│  │              → devices.byId[id] → get device refs           │    │
│  │    resolved:  deviceRegistry resolves kind → engine module   │    │
│  │    (master selected → limiter; track selected → synth+pan)  │    │
│  │                                                              │    │
│  │  VUMeter:                                                    │    │
│  │    audio:     engine facade → analyser data (no context)    │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flows

### Add Track

```
Component → useDawDispatch().addTrack()
  → DawStore.addTrack():
    1. Generate unique ID (encapsulated ID service — caches all
       existing IDs, validates uniqueness, never reuses old IDs)
    2. engine.createTrackSubgraph(id)         ← engine first
    3. Internal dispatch(ADD_TRACK, { id })    ← state second
       → dawReducer:
         projectReducer: adds track to byId + ids, adds empty
           devices + clips
         uiReducer: sets selectedTrackId to new track
         (single atomic action, composed from pure functions)
    4. Notify listeners
       → React re-renders via useSyncExternalStore
```

### Remove Track

```
Component → useDawDispatch().removeTrack(id)
  → DawStore.removeTrack(id):
    1. Validate: cannot remove if only 1 track remains
    2. engine.removeTrackSubgraph(id)         ← engine first
    3. Internal dispatch(REMOVE_TRACK, { id })
       → dawReducer:
         projectReducer: removes track, cleans up orphaned
           devices + clips
         uiReducer: adjusts selectedTrackId to adjacent track
         (single atomic action)
    4. Notify listeners
```

### Select Track

```
Component → useDawDispatch().selectTrack(id)
  → DawStore.selectTrack(id):
    1. Internal dispatch(SELECT_TRACK)        ← UI only, no engine
    2. Notify listeners
       → UiContext consumers re-render
       → ProjectContext consumers do NOT re-render
```

### Toggle Mute (audio-only)

```
Component → engine.getTrackFacade(id).setMute(true)
  → Engine-only, no store involvement
  → UI re-reads facade on next render/animation frame
```

### Select Master → DevicePanel

```
useDawDispatch().selectTrack("master")
  → UiState.selectedTrackId = "master"
  → DevicePanel:
    selectedTrackId === masterTrack.id?
      YES → reads masterTrack.deviceIds from ProjectDocument
          → resolves each via devices.byId[id]
          → deviceRegistry maps kind → engine module
          → renders limiter device
      NO  → reads track.deviceIds from tracks.byId[selectedTrackId]
          → resolves each via devices.byId[id]
          → renders synth + panner devices
```

## Key Design Decisions

| Decision | Detail |
|----------|--------|
| Single source of truth | DawStore class (BLoC pattern) owns all state |
| Domain model naming | **ProjectDocument** — music document, future multi-project |
| State shape | ProjectDocument (domain) + UiState (selection) — separate |
| Normalized entities | tracks, devices, clips all stored as `{ byId }` flat maps |
| Internal reducer | Pure function + discriminated union actions inside DawStore |
| React bridge | useSyncExternalStore (React 18 built-in) |
| Two read contexts | ProjectContext + UiContext — selection changes don't re-render project consumers |
| One dispatch context | Single useDawDispatch() routes to DawStore methods |
| Engine coordination | DawStore calls engine first, then state update |
| Audio values | Mute, gain, pan, recArm, meters — all on engine facades, never in state |
| ID generation | Encapsulated service — validates, caches, never reuses |
| Encapsulation | Small, focused parts — ID service, reducers, store, provider all separate |
| Engine independence | Audio engine does NOT rely on React updates (Layer 3a peer) |
