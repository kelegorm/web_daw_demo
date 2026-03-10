# Plan: Spatial Reverb WASM Node

## Overview
Implement a spatial reverb effect as a WASM AudioWorklet node,
replacing the PannerDevice on the synth1 track.
C++ DSP split into 4 modules per ТЗ: SpatialObjectGeometry,
HrtfRenderer, EarlyReflectionsEngine, LateTailEngine.
JS side: AudioWorkletNode wrapper + React device component.

Architecture:
- C++ compiled to WASM via Emscripten
- AudioWorkletNode loads WASM, calls process() each block
- React DevicePanel shows SpatialReverbDevice when synth1 selected
- PannerDevice removed from synth1 chain, SpatialReverb inserted

## Validation Commands
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- `make -C src/wasm/spatial-reverb` (WASM build)

---

### Task 1: WASM project scaffold and SpatialObjectGeometry
- [ ] Create `src/wasm/spatial-reverb/` directory with `CMakeLists.txt` for Emscripten build
- [ ] Create `src/wasm/spatial-reverb/SpatialObjectGeometry.cpp` and `.h`
- [ ] Implement `xyPadToAzEl(float x, float y, float& az, float& el)` — converts pad coords to azimuth/elevation using `vz = sqrt(max(0, 1 - x² - y²))`, `az = atan2(vx, vz)`, `el = atan2(vy, sqrt(vx² + vz²))`
- [ ] Implement `computeCenterAzEffective(float centerAz, float size)` — clamps center so edges stay within `[-89°, +89°]`
- [ ] Implement `computeEdges(float centerAzEff, float centerEl, float size, StereoEdges& out)` — `LeftEdgeAz = centerAzEff - size/2`, `RightEdgeAz = centerAzEff + size/2`, both at same elevation
- [ ] Implement `computeTailSpread(float size)` — `clamp(size * 0.85, 5°, 90°)`
- [ ] All angles in degrees internally, converted to radians only at HRTF call sites
- [ ] Write C++ unit tests: `xyPadToAzEl(0, 0)` → az=0, el=0
- [ ] Write C++ unit tests: `xyPadToAzEl(1, 0)` → az=+89°, el≈0
- [ ] Write C++ unit tests: `computeCenterAzEffective` clamps correctly when size=90°
- [ ] Write C++ unit tests: `computeEdges` edges do not exceed ±89° for any valid input
- [ ] Build WASM: `emcc` compiles without errors
- [ ] Mark completed

### Task 2: HrtfRenderer — libmysofa integration and FIR convolution
- [ ] Add libmysofa as git submodule or vendored source in `src/wasm/spatial-reverb/libs/mysofa/`
- [ ] Download one freeware SOFA file (e.g. MIT KEMAR) to `public/hrtf/kemar.sofa`
- [ ] Create `HrtfRenderer.cpp/.h`
- [ ] Implement `loadSofa(const char* path)` — loads SOFA via `mysofa_open()`
- [ ] Implement `getFilter(float azDeg, float elDeg, float distance, float* leftIR, float* rightIR, float* leftDelay, float* rightDelay)` — calls `mysofa_getfilter_float()` with linear interpolation between nearest HRTF points
- [ ] Implement `FFTConvolver` class: overlap-add FIR convolution, block size 128 samples
- [ ] Implement `render(const float* monoIn, int blockSize, float az, float el, float distance, float* stereoOut)`:
    - fetch HRIR + delays via `getFilter()`
    - apply `leftDelay/rightDelay` sample delays to input before convolution
    - convolve with `leftIR` → left channel, `rightIR` → right channel
- [ ] Implement crossfade on position update: when az/el changes, blend old IR output with new IR output over 32 samples
- [ ] Write C++ unit test: `render()` with az=0 produces symmetric L/R output
- [ ] Write C++ unit test: `render()` with az=+45° produces louder right channel
- [ ] Write C++ unit test: crossfade produces no discontinuity (max sample delta < 0.01) on az step change
- [ ] Build WASM: compiles with libmysofa linked
- [ ] Mark completed

### Task 3: EarlyReflectionsEngine
- [ ] Create `EarlyReflectionsEngine.cpp/.h`
- [ ] Define 6 ER taps as compile-time constants for room `6m × 3.2m × 8m`:
    - left wall, right wall, ceiling, floor, front wall, rear scatter
    - each with: `delay_ms`, `gain`, `hf_damping_hz`, `azimuth_deg`, `elevation_deg`
- [ ] Implement mono mix input: `ERInput = 0.5 * (InL + InR)`
- [ ] Implement tap delay lines (ring buffers, max 150ms each)
- [ ] Implement per-tap 1-pole LPF with `hf_damping_hz` cutoff
- [ ] Implement per-tap allpass diffuser, order 2–4ms
- [ ] Implement `process(const float* inL, const float* inR, int blockSize, float distanceM, float reverbLevel, float* erBusL, float* erBusR)`:
    - compute mono input
    - run each tap through delay → LPF → allpass
    - spatialize each tap via `HrtfRenderer::render()` at tap's azimuth/elevation
    - scale by `gain * ERGain` where `ERGain = 0.65 * reverbLevel`
    - accumulate into `erBusL/erBusR`
- [ ] Distance scales ER delays: `tapDelay *= (1 + distanceM / 12.0)`
- [ ] Distance scales ER gains: `tapGain *= 1 / max(1, distanceM / 3.0)`
- [ ] Write C++ unit test: silent input → silent output
- [ ] Write C++ unit test: with reverbLevel=0 → output is zero
- [ ] Write C++ unit test: sum of ER energy is less than input energy (no gain explosion)
- [ ] Mark completed

### Task 4: LateTailEngine (zita FDN)
- [ ] Vendor zita-rev1 source files into `src/wasm/spatial-reverb/libs/zita/`
- [ ] Create `LateTailEngine.cpp/.h`
- [ ] Implement `init(float sampleRate)` — initialize zita 8x8 FDN at given sample rate
- [ ] Implement `process(const float* inL, const float* inR, int blockSize, float* tailL, float* tailR)` — runs zita FDN
- [ ] Implement `computeTailComponents(const float* tailL, const float* tailR, int blockSize, float* centerOut, float* leftOut, float* rightOut)`:
    - `TailCenter = 0.5 * (tailL + tailR)` × 0.7
    - `TailLeft = tailL` × 0.5
    - `TailRight = tailR` × 0.5
- [ ] Implement `spatialize(float centerAzEff, float tailSpread, float reverbLevel, ...)`:
    - `TailCenterAz = centerAzEff`
    - `TailLeftAz = centerAzEff - tailSpread/2`
    - `TailRightAz = centerAzEff + tailSpread/2`
    - render each through `HrtfRenderer::render()`
    - scale by `TailGain = 1.0 * reverbLevel`
    - accumulate into `tailBusL/tailBusR`
- [ ] Write C++ unit test: silent input → silent output
- [ ] Write C++ unit test: tail energy decays over time (RMS at t+2s < RMS at t+0.5s)
- [ ] Write C++ unit test: tailSpread=0° → TailLeft and TailRight same position → symmetric output
- [ ] Mark completed

### Task 5: SpatialReverbProcessor — main DSP and parameter smoothing
- [ ] Create `SpatialReverbProcessor.cpp/.h`
- [ ] Owns instances of: `SpatialObjectGeometry`, `HrtfRenderer`, `EarlyReflectionsEngine`, `LateTailEngine`
- [ ] Implement parameter smoothing for all 5 params: x, y, size, distance, reverb
    - 1-pole smoother: `smoothed += (target - smoothed) * coeff` per sample, `coeff = 1 - exp(-1 / (sampleRate * 0.020))`
- [ ] Implement `setX(float)`, `setY(float)`, `setSize(float)`, `setDistance(float)`, `setReverb(float)`
- [ ] Implement `process(const float* inL, const float* inR, float* outL, float* outR, int blockSize)`:
    - advance smoothers
    - recompute geometry from smoothed params each block
    - Direct: `InL → HRTF(LeftEdge)`, `InR → HRTF(RightEdge)`, sum → DirectBus
    - ER: call `EarlyReflectionsEngine::process()` → ERBus
    - Tail: call `LateTailEngine::process()` then `spatialize()` → TailBus
    - `Out = DirectBus + ERBus + TailBus`
- [ ] Export C API for Emscripten:
    - `spatialreverb_create()` → handle
    - `spatialreverb_process(handle, inL, inR, outL, outR, blockSize)`
    - `spatialreverb_set_x(handle, float)`
    - `spatialreverb_set_y(handle, float)`
    - `spatialreverb_set_size(handle, float)`
    - `spatialreverb_set_distance(handle, float)`
    - `spatialreverb_set_reverb(handle, float)`
    - `spatialreverb_destroy(handle)`
- [ ] Write C++ unit test: x=0, y=0, reverb=0 → output ≈ input (direct only, centered)
- [ ] Write C++ unit test: reverb=1 → output energy > input energy (reverb adds energy)
- [ ] Write C++ unit test: parameter smoothing — no sample-level discontinuity on step change
- [ ] Build final WASM: `emcc` outputs `public/spatial-reverb.wasm` + `public/spatial-reverb.js`
- [ ] Mark completed

### Task 6: AudioWorklet wrapper
- [ ] Create `src/worklets/spatial-reverb-processor.js`
- [ ] Load and instantiate `spatial-reverb.wasm` inside worklet via `AudioWorkletGlobalScope`
- [ ] Implement `process(inputs, outputs, parameters)`:
    - read stereo input `inputs[0][0]` (L) and `inputs[0][1]` (R)
    - call `spatialreverb_process()` with input/output Float32Arrays
    - write to `outputs[0][0]` (L) and `outputs[0][1]` (R)
- [ ] Declare AudioParams: `x` (-1..1), `y` (-1..1), `size` (0..1 → 0°..90°), `distance` (0..1 → 0.5m..12m), `reverb` (0..1)
- [ ] Pass AudioParam values to `spatialreverb_set_*()` each block
- [ ] Handle `MessagePort` message `{ type: 'panic' }` → `spatialreverb_set_reverb(0)` instantly
- [ ] Write Playwright test: worklet registers without errors (`audioContext.audioWorklet.addModule`)
- [ ] Write Playwright test: connect oscillator → SpatialReverbNode → destination, verify non-silent output
- [ ] Mark completed

### Task 7: useSpatialReverb hook
- [ ] Create `src/hooks/useSpatialReverb.ts`
- [ ] Instantiate `AudioWorkletNode` with `spatial-reverb-processor`
- [ ] Connect in synth1 chain: `PolySynth output → SpatialReverbNode → masterGain` (replaces PannerNode)
- [ ] Expose: `setX(v)`, `setY(v)`, `setSize(v)`, `setDistance(v)`, `setReverb(v)`, `setEnabled(bool)`
- [ ] Each setter updates the corresponding `AudioParam`
- [ ] `setEnabled(false)` bypasses node (connect PolySynth directly to masterGain)
- [ ] Delete `src/hooks/usePanner.ts` (replaced by this hook)
- [ ] Delete or update any imports of `usePanner` in App.tsx and DevicePanel
- [ ] Write Vitest test: `setX(0.5)` sets `workletNode.parameters.get('x').value` to 0.5
- [ ] Write Vitest test: `setEnabled(false)` disconnects worklet node from chain
- [ ] Mark completed

### Task 8: SpatialReverbDevice component and DevicePanel wiring
- [ ] Create `src/components/SpatialReverbDevice.tsx`
- [ ] Same device block layout as other devices
- [ ] Enable/disable toggle in top-left corner, calls `useSpatialReverb.setEnabled()`
- [ ] Label "Spatial Reverb", type tag "FX"
- [ ] XY Pad: circular pad (clip to unit circle), mouse drag updates x/y, calls `setX()/setY()`
    - render current position as dot inside circle
    - circle border, crosshair lines at center
- [ ] Three knobs: Size (0–90°), Distance (0–100%), Reverb (0–100%)
- [ ] Replace `<PannerDevice />` with `<SpatialReverbDevice />` in DevicePanel when `selectedTrack === 'synth1'`
- [ ] Write Playwright test: "Spatial Reverb" label visible when synth1 selected
- [ ] Write Playwright test: drag XY pad, verify x/y AudioParam values change
- [ ] Write Playwright test: drag Size knob, verify `size` AudioParam changes
- [ ] Write Playwright test: PannerDevice is no longer rendered anywhere in the DOM
- [ ] Mark completed