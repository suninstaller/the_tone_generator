# The Tone Generator - Project Context

## Overview
Real-time 4-channel modular synthesizer with professional effects chains and MIDI control.
- **GitHub**: https://github.com/suninstaller/the_tone_generator
- **Tech Stack**: Vanilla JS, Web Audio API (with AudioWorklets), HTML5, CSS3
- **Hardware Profile**: Optimized for Novation 25SL MKII but supports any device via MIDI Learn.

## File Structure
```
index.html      - Main UI (4 channels, 3 effect slots each)
js/generators.js - 9 waveform generators (High-performance Worklet architecture)
js/effects.js   - 24 professional audio effects (Integrated with Worklets)
js/midi.js      - Web MIDI API controller with Dynamic Learning
js/ui.js        - UI bindings, Patch management, and visualization
js/main.js      - SynthEngine - Audio graph and Worklet module management
js/worklets/    - Custom DSP processors (grain-player, infrasound-processor)
```

## Features & Architecture
- **Generators**: Sine, Sawtooth, Triangle, Square (PWM), Noise, Binaural, FM Synth.
- **Granular Synthesis**: Now uses 'grain-player' AudioWorklet for jitter-free scheduling.
- **Infrasound**: 0.01-200Hz using custom 'infrasound-processor' Worklet for perfect stability.
- **Dynamic Routing**: Persistent channel gain nodes with 5ms crossfades prevent all clicks during swaps.
- **State Persistence**: Automatic localStorage saving of all synth parameters and LFO assignments.
- **User Patch Library**: Users can save, name, and delete custom configurations.

## MIDI System
- **MIDI Learn**: Right-click any slider to enter Learn mode; move hardware to map instantly.
- **Visual Feedback**: Success toasts and overlay indicators during mapping.
- **Native Mappings**: Hardcoded fallback for Novation 25SL MKII CC 1-23.

## Visuals & Optimization
- **LFO Meters**: Real-time progress bars for each LFO's modulation value.
- **CPU Management**: Visualizer requestAnimationFrame loop automatically pauses when audio is stopped.
- **Robustness**: Automatic detection of 'file://' protocol with helpful alerts regarding CORS restrictions.

## Recent Major Updates (Feb 26 2026)
- ✅ **Stability**: Eliminated audio drops during effect/generator hot-swapping.
- ✅ **DSP**: Migrated Granular and Infrasound engines to high-performance AudioWorklets.
- ✅ **Persistence**: Implemented full Patch Serialization system (Save/Load).
- ✅ **UX**: Added MIDI Learn, Toast notifications, and real-time LFO meters.
- ✅ **Fix**: Resolved 'TimeStretch' API errors and non-standard phase property warnings.

## Running the Project
- **Requirement**: Must run via a local web server to load AudioWorklet modules.
- **Quick Start**: 'python3 -m http.server' or 'npx serve'.
- **URL**: http://localhost:8000

## Total Code
~8,500 lines across 8 files
