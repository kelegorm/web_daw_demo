;; WebAssembly Text format equivalent of synth.cpp
;; Imports sinf and powf from the host environment.
;; Compile to WASM with: node scripts/build-wasm.js
;; Or with Emscripten: see CLAUDE.md

(module
  (import "env" "sinf"  (func $sinf  (param f32) (result f32)))
  (import "env" "powf"  (func $powf  (param f32 f32) (result f32)))

  (memory (export "memory") 1)

  ;; Globals
  (global $phase         (mut f32) (f32.const 0.0))
  (global $freq          (mut f32) (f32.const 0.0))
  (global $active        (mut i32) (i32.const 0))
  (global $filter_cutoff (mut f32) (f32.const 20000.0))
  (global $voice_spread  (mut f32) (f32.const 0.0))
  (global $reverb_mix    (mut f32) (f32.const 0.0))

  ;; noteOn(midiNote: i32)
  (func (export "noteOn") (param $note i32)
    (local $freq_f32 f32)
    ;; freq = 440 * pow(2, (note - 69) / 12)
    (local.set $freq_f32
      (f32.mul
        (f32.const 440.0)
        (call $powf
          (f32.const 2.0)
          (f32.div
            (f32.convert_i32_s
              (i32.sub (local.get $note) (i32.const 69)))
            (f32.const 12.0)))))
    (global.set $freq (local.get $freq_f32))
    (global.set $active (i32.const 1)))

  ;; noteOff()
  (func (export "noteOff")
    (global.set $active (i32.const 0)))

  ;; panic()
  (func (export "panic")
    (global.set $active (i32.const 0))
    (global.set $phase  (f32.const 0.0)))

  ;; setFilterCutoff(hz: f32)
  (func (export "setFilterCutoff") (param $hz f32)
    (global.set $filter_cutoff (local.get $hz)))

  ;; setVoiceSpread(v: f32)
  (func (export "setVoiceSpread") (param $v f32)
    (global.set $voice_spread (local.get $v)))

  ;; setReverbMix(v: f32)
  (func (export "setReverbMix") (param $v f32)
    (global.set $reverb_mix (local.get $v)))

  ;; process(ptr: i32, blockSize: i32)
  (func (export "process") (param $ptr i32) (param $blockSize i32)
    (local $i i32)
    (local $sample f32)
    (local $phaseInc f32)
    ;; phaseInc = 2*PI * freq / 44100
    (local.set $phaseInc
      (f32.div
        (f32.mul (f32.const 6.283185307) (global.get $freq))
        (f32.const 44100.0)))
    (local.set $i (i32.const 0))
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (local.get $blockSize)))
        ;; sample = active ? sinf(phase) * 0.3 : 0.0
        (local.set $sample
          (select
            (f32.mul
              (call $sinf (global.get $phase))
              (f32.const 0.3))
            (f32.const 0.0)
            (global.get $active)))
        ;; store sample at ptr + i*4
        (f32.store
          (i32.add (local.get $ptr) (i32.shl (local.get $i) (i32.const 2)))
          (local.get $sample))
        ;; phase += phaseInc
        (global.set $phase
          (f32.add (global.get $phase) (local.get $phaseInc)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop))))
)
