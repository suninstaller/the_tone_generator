# 🚀 v2 Expansion Guide

This guide explains how to extend the **Tone Generator v2** with new high-performance oscillators, AudioWorklets, and LFO-ready effects.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Adding a New Generator](#adding-a-new-generator)
- [Implementing AudioWorklets](#implementing-audioworklets)
- [Adding a New Effect](#adding-a-new-effect)
- [LFO Modulation Support](#lfo-modulation-support)
- [Tips & Best Practices](#tips--best-practices)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SynthEngine (main_v2.js)                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │Channel 0│  │Channel 1│  │Channel 2│  │Channel 3│        │
│  │Generator│  │Generator│  │Generator│  │Generator│        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
│       ▼            ▼            ▼            ▼              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Effect  │  │ Effect  │  │ Effect  │  │ Effect  │        │
│  │ Chain   │  │ Chain   │  │ Chain   │  │ Chain   │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       └────────────┴────────────┴────────────┘              │
│                         │                                    │
│                         ▼                                    │
│                  ┌──────────────┐                           │
│                  │  Master Out  │                           │
│                  └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Files (v2)
- `js/generators_v2.js` - Oscillator and Generator implementations.
- `js/effects_v2.js` - Effect implementations + LFO System.
- `js/main_v2.js` - SynthEngine (routing and state management).
- `js/ui_v2.js` - UIManager (DOM events and visualization).
- `js/worklets/` - Custom AudioWorklet processors (high-performance).

---

## Adding a New Generator

### Step 1: Create the Generator Class
Add your new generator class to `js/generators_v2.js`. Every generator must implement the following interface:

```javascript
class MyNewGenerator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.outputGain = this.audioContext.createGain();
        this.isPlaying = false;
        this.frequency = 440;
    }

    start(destination) {
        if (this.isPlaying) return;
        // 1. Create your nodes
        this.osc = this.audioContext.createOscillator();
        // 2. Route to outputGain
        this.osc.connect(this.outputGain);
        if (destination) this.outputGain.connect(destination);
        // 3. Start
        this.osc.start();
        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;
        // Use a small fade-out to prevent clicks
        const now = this.audioContext.currentTime;
        this.outputGain.gain.setTargetAtTime(0, now, 0.02);
        setTimeout(() => {
            if (this.osc) this.osc.stop();
            this.isPlaying = false;
        }, 50);
    }

    // Required Setters
    setFrequency(f) { this.frequency = f; /* Update nodes */ }
    setVolume(v) { this.outputGain.gain.setTargetAtTime(v, this.audioContext.currentTime, 0.01); }
    getOutput() { return this.outputGain; }
    getIsPlaying() { return this.isPlaying; }
    destroy() { this.stop(); }
}
```

### Step 2: Register in GeneratorFactory
Update `GeneratorFactory.create()` and `GeneratorFactory.getGeneratorTypes()` in `js/generators_v2.js`.

---

## Implementing AudioWorklets

For advanced synthesis (like granular or physical modeling), use an `AudioWorklet`.

1.  **Create the processor:** Add a file in `js/worklets/my-processor.js`.
2.  **Register in `main_v2.js`:**
    ```javascript
    await this.audioContext.audioWorklet.addModule('js/worklets/my-processor.js');
    ```
3.  **Use in your Generator:**
    ```javascript
    this.workletNode = new AudioWorkletNode(this.audioContext, 'my-processor');
    this.osc.connect(this.workletNode).connect(this.outputGain);
    ```

---

## Adding a New Effect

### Step 1: Create the Effect Class
Add to `js/effects_v2.js`. Note how `getParamDefinitions()` automatically creates the UI.

```javascript
class MyNewEffect extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'my-effect';
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        this.params = { drive: 1, mix: 0.5 };
        // Setup nodes...
        this.updateParams();
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        // Update nodes using this.params
    }

    // Param Definitions (Automates UI Generation)
    getParamDefinitions() {
        return [
            { name: 'drive', label: 'Drive', min: 1, max: 10, default: 1, step: 0.1 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }
}
```

### Step 2: Register in EffectFactory
Update `EffectFactory.create()` and `EffectFactory.getEffectTypes()` in `js/effects_v2.js`.

---

## LFO Modulation Support

The v2 engine includes a global LFO system. To make your effect "modulatable":

1.  **Use `AudioParam`:** Ensure your effect parameters (like `filter.frequency`) are `AudioParam` objects.
2.  **LFO Connection:** The `LFO` class in `effects_v2.js` can automatically connect to these parameters via `lfo.addTarget(effect.node.parameter, min, max)`.
3.  **UI Sync:** The UI in `ui_v2.js` automatically maps the LFO assignment dropdowns based on your `getParamDefinitions()`.

---

## Tips & Best Practices

1.  **Anti-Aliasing:** Use `PeriodicWave` (see `ToneGenerator.createSquareWaveWithDuty`) instead of raw oscillators for custom waveforms to prevent high-frequency noise.
2.  **Performance:** Prefer `AudioWorklet` for per-sample processing. Avoid `ScriptProcessorNode` (deprecated).
3.  **Cleanup:** Always implement a `destroy()` method to disconnect nodes and stop LFOs to prevent memory leaks.
4.  **Local Server:** Always run via `npx serve` or `python3 -m http.server` to allow module and worklet loading.

Happy coding! 🎹🎛️🎵
