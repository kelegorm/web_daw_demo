# Phase 1: Engine Multi-Track Foundation - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The audio engine becomes a standalone singleton managing N parallel track subgraphs through a stable, React-independent API. Exposes TrackFacade, MasterFacade, and DeviceFacade interfaces. Does not include device CRUD, reducer/context, or UI wiring — those are later phases.

</domain>

<decisions>
## Implementation Decisions

### Track subgraph lifecycle
- New tracks start silent and disarmed (gain at 0 dB, unmuted, NOT rec-armed — user must arm before input routes)
- Track removal disconnects and disposes nodes immediately — no fade-out
- Track removal allowed during active playback — other tracks keep playing unaffected
- No hard limit on track count — let browser/AudioContext be the constraint

### Facade API surface
- TrackFacade exposes high-level methods only (setGain, getMeterLevel, setMute, etc.) — no raw AudioNode exposure. Only expose what is actually used elsewhere
- TrackFacade is a class instance with private node refs and a dispose method
- Calling methods on a disposed facade throws an error — surfaces bugs fast
- TrackFacade covers strip-level only: gain, mute, meters. No synth/instrument access, no pan
- Pan, limiter, and other processing stages are "devices" — NOT part of the track facade
- Devices get their own DeviceFacade interface, accessed via independent engine lookup (not via track)
- Devices are part of the audio processing chain, not separate track editing tools
- MasterFacade exposes only master track direct properties (gain, meters). Limiter and other processing accessed separately through device facades
- All facade interfaces (TrackFacade, MasterFacade, DeviceFacade) defined in this phase

### Singleton bootstrap
- AudioContext created eagerly on module import
- getAudioEngine() is idempotent — handles React StrictMode double-invocation internally, returns same instance
- Engine is app-lifetime — no dispose() method, lives until page unload
- Engine starts with one default track already created and wired

### Bus topology
- All tracks (except master) route to a dedicated summing node, which then feeds into the first master track device
- Summing node is pass-through only (unity gain, no level control) — purely an aggregation point
- Signal chain: track outputs → summing node → master device chain (limiter etc.) → master strip → destination
- Summing node and master chain pre-created on engine bootstrap — always ready before any track operations

</decisions>

<specifics>
## Specific Ideas

- Device model: panner, limiter, synth are all "devices" on a track's processing chain, each with their own facade — not properties of the track itself
- Master track follows the same device model — master-level processing (limiter) is a device on the master chain, not a master track property
- The engine lookup pattern for devices: engine-level registry, not track-level (e.g., engine.getDeviceFacade(trackId, deviceType))

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-engine-multi-track-foundation*
*Context gathered: 2026-03-12*
