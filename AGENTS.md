# The Tone Generator - Project Context

## Overview
Real-time 4-channel modular synthesizer with professional effects chains and MIDI control.
- **GitHub**: https://github.com/suninstaller/the_tone_generator
- **Tech Stack**: Vanilla JS, Web Audio API, HTML5, CSS3
- **MIDI Device**: Novation 25SL MKII (CC 1-23 mapped)

## File Structure
```
index.html      - Main UI (4 channels, 3 effect slots each)
js/generators.js - 9 waveform generators (ToneGenerator, Noise, Binaural, FM, Granular, Infrasound)
js/effects.js   - 24 professional audio effects
js/midi.js      - Web MIDI API controller
js/ui.js        - UI bindings and event handlers
js/main.js      - SynthEngine - audio graph management
```

## Features (9 Generators)
- Traditional: Sine, Sawtooth, Triangle, Square (with PWM)
- **Noise**: White/Pink/Brown with filter
- **Binaural Beats**: Brainwave entrainment (Delta/Theta/Alpha/Beta)
- **FM Synth**: 2-operator FM with multiple algorithms
- **Granular**: Cloud textures from oscillator grains
- **Infrasound**: 0.5-200Hz for cymatic photography (buffer-based for stability)

## Effects (24 Total)
Dynamics: Compressor, PreFET, Distortion, WaveFolder, GateExpander, ZenerLimiter
Modulation: Tremolo, Flanger, Phaser, Chorus, AM, Pan360, Doppler
Time: TapeDelay, PingPong, PitchShifter, TimeStretch
Space: Reverb, Pro-R
EQ/Filter: 3-Band EQ, CombFilter, StereoWidener
Lo-fi: RingMod, BitCrusher

## Recent Fixes (Feb 23 2026)
- ✅ Fixed JavaScript syntax errors in generators.js (duplicate export blocks)
- ✅ Removed duplicate midi.js script tag from index.html
- ✅ Added screenshot to README
- 🐛 Known: Effect chain occasionally drops audio when swapping effects rapidly
- 🐛 Known: TimeStretch effect shows console warnings (non-critical)

## MIDI Mappings (CC)
```
CC 1  - Master volume (mod wheel)
CC 7-10  - Channel 1-4 volumes (sliders)
CC 11-14 - Channel 1-4 frequencies (top knobs)
CC 15-23 - Effect parameters (middle knobs)
```

## Key Technical Details
- Effect chains: Up to 3 effects per channel in series, hot-swappable
- Audio routing: Uses `disconnect()/connect()` without stopping generators
- Infrasound: Uses 2-second AudioBuffer loop for sub-20Hz stability
- Requires HTTPS or localhost for Web MIDI API

## Total Code
~8,300 lines across 6 files
