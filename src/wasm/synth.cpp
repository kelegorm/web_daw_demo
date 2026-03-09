#include <cmath>
#include <cstring>

static float g_phase = 0.0f;
static float g_freq = 0.0f;
static int   g_active = 0;
static float g_filter_cutoff = 20000.0f;
static float g_voice_spread  = 0.0f;
static float g_reverb_mix    = 0.0f;

static const float SAMPLE_RATE = 44100.0f;
static const float TWO_PI      = 6.283185307179586f;

static float midi_to_freq(int note) {
    return 440.0f * powf(2.0f, (note - 69) / 12.0f);
}

extern "C" {

void noteOn(int midiNote) {
    g_freq   = midi_to_freq(midiNote);
    g_active = 1;
}

void noteOff() {
    g_active = 0;
}

void panic() {
    g_active = 0;
    g_phase  = 0.0f;
}

void setFilterCutoff(float hz) { g_filter_cutoff = hz; }
void setVoiceSpread(float v)   { g_voice_spread  = v; }
void setReverbMix(float v)     { g_reverb_mix    = v; }

void process(float* out, int blockSize) {
    float phaseInc = TWO_PI * g_freq / SAMPLE_RATE;
    for (int i = 0; i < blockSize; i++) {
        out[i] = g_active ? sinf(g_phase) * 0.3f : 0.0f;
        g_phase += phaseInc;
        if (g_phase >= TWO_PI) g_phase -= TWO_PI;
    }
}

} // extern "C"
