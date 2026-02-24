# 🚀 Expansion Guide

This guide explains how to extend the tone generator with new oscillators and effects.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Adding a New Oscillator](#adding-a-new-oscillator)
- [Adding a New Effect](#adding-a-new-effect)
- [Adding More Channels](#adding-more-channels)
- [Tips & Best Practices](#tips--best-practices)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SynthEngine (main.js)                     │
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

### Key Files
- `js/generators.js` - Oscillator implementations + GeneratorFactory
- `js/effects.js` - Effect implementations + EffectFactory
- `js/main.js` - SynthEngine (routing and state management)
- `js/ui.js` - UIManager (DOM events and visualization)
- `index.html` - UI structure

---

## Adding a New Oscillator

### Step 1: Create the Generator Class

Add your new generator class to `js/generators.js`:

```javascript
/**
 * FM Synthesizer Example
 * A simple 2-operator FM synthesizer
 */
class FMSynth {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.carrier = null;
        this.modulator = null;
        this.modulatorGain = null;
        this.outputGain = null;
        this.isPlaying = false;
        
        // Parameters
        this.frequency = 440;
        this.volume = 0.5;
        this.modFreq = 110;     // Modulator frequency
        this.modDepth = 100;    // Modulation index
    }

    createSynth() {
        // Create carrier
        this.carrier = this.audioContext.createOscillator();
        this.carrier.frequency.value = this.frequency;
        this.carrier.type = 'sine';
        
        // Create modulator
        this.modulator = this.audioContext.createOscillator();
        this.modulator.frequency.value = this.modFreq;
        this.modulator.type = 'sine';
        
        // Modulator gain (controls FM depth)
        this.modulatorGain = this.audioContext.createGain();
        this.modulatorGain.gain.value = this.modDepth;
        
        // Output gain
        this.outputGain = this.audioContext.createGain();
        this.outputGain.gain.value = this.volume;
        
        // FM routing: modulator -> modulatorGain -> carrier.frequency
        this.modulator.connect(this.modulatorGain);
        this.modulatorGain.connect(this.carrier.frequency);
        
        // Carrier -> output
        this.carrier.connect(this.outputGain);
        
        // Start oscillators
        this.carrier.start();
        this.modulator.start();
        
        return this.outputGain;
    }

    start(destination) {
        if (this.isPlaying) return;
        
        const output = this.createSynth();
        if (destination) {
            output.connect(destination);
        }
        
        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;
        
        // Fade out
        const now = this.audioContext.currentTime;
        this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
        this.outputGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        setTimeout(() => {
            if (this.carrier) {
                this.carrier.stop();
                this.carrier.disconnect();
                this.carrier = null;
            }
            if (this.modulator) {
                this.modulator.stop();
                this.modulator.disconnect();
                this.modulator = null;
            }
        }, 60);
        
        this.isPlaying = false;
    }

    // Required methods
    setFrequency(freq) {
        this.frequency = freq;
        if (this.carrier) {
            const now = this.audioContext.currentTime;
            this.carrier.frequency.setTargetAtTime(freq, now, 0.01);
        }
    }

    setModFreq(freq) {
        this.modFreq = freq;
        if (this.modulator) {
            const now = this.audioContext.currentTime;
            this.modulator.frequency.setTargetAtTime(freq, now, 0.01);
        }
    }

    setModDepth(depth) {
        this.modDepth = depth;
        if (this.modulatorGain) {
            const now = this.audioContext.currentTime;
            this.modulatorGain.gain.setTargetAtTime(depth, now, 0.01);
        }
    }

    setVolume(vol) {
        this.volume = vol;
        if (this.outputGain) {
            const now = this.audioContext.currentTime;
            this.outputGain.gain.setTargetAtTime(vol, now, 0.01);
        }
    }

    getOutput() {
        return this.outputGain;
    }

    getIsPlaying() {
        return this.isPlaying;
    }

    destroy() {
        this.stop();
        if (this.modulatorGain) {
            this.modulatorGain.disconnect();
            this.modulatorGain = null;
        }
        if (this.outputGain) {
            this.outputGain.disconnect();
            this.outputGain = null;
        }
    }
}
```

### Step 2: Register in GeneratorFactory

Add your generator to the factory in `js/generators.js`:

```javascript
const GeneratorFactory = {
    create(type, audioContext) {
        switch (type) {
            case 'fm':               // New!
                return new FMSynth(audioContext);
            case 'noise':
                return new NoiseGenerator(audioContext);
            case 'sine':
            case 'sawtooth':
            case 'triangle':
            case 'square':
            default:
                const gen = new ToneGenerator(audioContext);
                gen.setWaveform(type);
                return gen;
        }
    },

    getGeneratorTypes() {
        return [
            { id: 'sine', name: 'Sine', hasDuty: false },
            { id: 'sawtooth', name: 'Sawtooth', hasDuty: false },
            { id: 'triangle', name: 'Triangle', hasDuty: false },
            { id: 'square', name: 'Square', hasDuty: true },
            { id: 'noise', name: 'Noise', hasDuty: false },
            { id: 'fm', name: '🎹 FM Synth', hasDuty: false }  // New!
        ];
    }
};
```

### Step 3: Add to HTML

Add the option to each waveform selector in `index.html`:

```html
<select class="waveform">
    <option value="sine">Sine</option>
    <option value="sawtooth">Sawtooth</option>
    <option value="triangle">Triangle</option>
    <option value="square">Square</option>
    <option value="noise">🔊 Noise</option>
    <option value="fm">🎹 FM Synth</option>  <!-- New! -->
</select>
```

### Step 4: Handle FM-specific UI (Optional)

If your generator has special parameters (like FM's modFreq and modDepth), update `js/ui.js` to show controls when that waveform is selected.

---

## Adding a New Effect

### Step 1: Create the Effect Class

Add your new effect to `js/effects.js`:

```javascript
/**
 * Auto-Wah Effect
 * Envelope-filter that opens/closes based on input volume
 */
class AutoWah extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'autowah';
        
        // Create nodes
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        // Filter (the "wah")
        this.filter = this.audioContext.createBiquadFilter();
        this.filter.type = 'bandpass';
        this.filter.Q.value = 5;
        this.filter.frequency.value = 1000;
        
        // Follower (envelope detector)
        this.follower = this.audioContext.createAnalyser();
        this.follower.fftSize = 32;
        
        // LFO for manual wah mode
        this.lfo = this.audioContext.createOscillator();
        this.lfoGain = this.audioContext.createGain();
        
        // Mix
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        // Parameters
        this.params = {
            baseFreq: 200,      // Minimum filter frequency
            range: 2000,        // How much the filter sweeps
            sensitivity: 0.5,   // How much input affects the filter
            mix: 0.5
        };
        
        // Routing
        this.input.connect(this.filter);
        this.filter.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Envelope follower (simplified - in reality you'd use a script processor or worklet)
        this.input.connect(this.follower);
        
        this.updateParams();
        this.startEnvelopeFollower();
    }

    startEnvelopeFollower() {
        // In a real implementation, you'd continuously analyze the input
        // and adjust the filter frequency. For this example, we'll use an LFO.
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.filter.frequency);
        this.lfo.frequency.value = 2;
        this.lfoGain.gain.value = 1000;
        this.lfo.start();
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.filter.frequency.setTargetAtTime(this.params.baseFreq, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setBaseFreq(freq) {
        this.params.baseFreq = freq;
        this.updateParams();
    }

    setRange(range) {
        this.params.range = range;
        this.lfoGain.gain.setTargetAtTime(range, this.audioContext.currentTime, 0.01);
    }

    setSensitivity(sens) {
        this.params.sensitivity = sens;
    }

    setMix(mix) {
        this.params.mix = mix;
        this.updateParams();
    }

    getParamDefinitions() {
        return [
            { name: 'baseFreq', label: 'Base Freq', min: 50, max: 1000, default: 200, step: 10 },
            { name: 'range', label: 'Sweep Range', min: 100, max: 5000, default: 2000, step: 100 },
            { name: 'sensitivity', label: 'Sensitivity', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }

    destroy() {
        this.lfo.stop();
        super.destroy();
    }
}
```

### Step 2: Register in EffectFactory

Add your effect to the factory:

```javascript
const EffectFactory = {
    create(type, audioContext) {
        switch (type) {
            case 'autowah':      // New!
                return new AutoWah(audioContext);
            case 'chorus':
                return new Chorus(audioContext);
            // ... other effects
        }
    },

    getEffectTypes() {
        return [
            { id: 'none', name: '-- No Effect --' },
            { id: 'ringmod', name: 'Ring Modulator' },
            { id: 'flanger', name: 'Flanger' },
            { id: 'chorus', name: 'Chorus' },
            { id: 'delay', name: 'Tape Delay' },
            { id: 'reverb', name: 'Reverb' },
            { id: 'distortion', name: 'Distortion' },
            { id: 'bitcrusher', name: 'Bit Crusher' },
            { id: 'autowah', name: '🆕 Auto-Wah' }  // New!
        ];
    }
};
```

### Step 3: Add to HTML

Add to each effect dropdown in `index.html`:

```html
<select class="effect-type">
    <option value="none">-- No Effect --</option>
    <option value="ringmod">Ring Modulator</option>
    <option value="flanger">Flanger</option>
    <option value="chorus">Chorus</option>
    <option value="delay">Tape Delay</option>
    <option value="reverb">Reverb</option>
    <option value="distortion">Distortion</option>
    <option value="bitcrusher">Bit Crusher</option>
    <option value="autowah">🆕 Auto-Wah</option>
</select>
```

---

## Adding More Channels

Want 8 channels instead of 4? Easy!

### Step 1: Update SynthEngine

In `js/main.js`, change the initialization:

```javascript
constructor() {
    // ...
    this.channelSettings = [
        { enabled: true, volume: 0.5, waveform: 'sine' },
        { enabled: false, volume: 0.5, waveform: 'sawtooth' },
        { enabled: false, volume: 0.5, waveform: 'triangle' },
        { enabled: false, volume: 0.5, waveform: 'square' },
        { enabled: false, volume: 0.5, waveform: 'noise' },  // New
        { enabled: false, volume: 0.5, waveform: 'fm' },     // New
        { enabled: false, volume: 0.5, waveform: 'sine' },   // New
        { enabled: false, volume: 0.5, waveform: 'sawtooth' } // New
    ];
}

async start() {
    // ...
    for (let i = 0; i < 8; i++) {  // Changed from 4 to 8
        this.createChannel(i);
    }
    // ...
}
```

### Step 2: Add HTML for New Channels

Copy one of the existing channel blocks in `index.html` and adjust the `data-channel` attribute and default values.

### Step 3: Update CSS (if needed)

The grid is responsive, so it should automatically adjust. But you might want to tweak:

```css
.synth-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
}
```

---

## Tips & Best Practices

### 1. Always Implement Required Methods

Every generator must have:
- `start(destination)` - Start playing
- `stop()` - Stop playing
- `setVolume(vol)` - Set volume (0-1)
- `getOutput()` - Return the output audio node
- `getIsPlaying()` - Return boolean playing state
- `destroy()` - Cleanup and disconnect

Every effect must have:
- `getInput()` - Return input node
- `getOutput()` - Return output node
- `connect(destination)` - Connect output to something
- `disconnect()` - Disconnect output
- `destroy()` - Cleanup
- `getParamDefinitions()` - Return parameter definitions array

### 2. Use Smooth Parameter Changes

Always use `setTargetAtTime` instead of direct assignment:

```javascript
// Good - smooth transition
this.gainNode.gain.setTargetAtTime(newValue, this.audioContext.currentTime, 0.01);

// Bad - causes clicks/pops
this.gainNode.gain.value = newValue;
```

### 3. Handle Cleanup Properly

Always clean up AudioNodes to prevent memory leaks:

```javascript
destroy() {
    this.stop();
    if (this.someNode) {
        this.someNode.disconnect();
        this.someNode = null;
    }
}
```

### 4. Use the Factory Pattern

Always register new components in the factories. This keeps the code modular and the UI will automatically pick up new options.

### 5. Test in Multiple Browsers

Web Audio API implementations vary slightly between Chrome, Firefox, Safari, and Edge.

---

## Example: Quick Effect Template

```javascript
class MyEffect extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'myeffect';
        
        // Create nodes
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        // Your processing nodes here
        
        // Parameters
        this.params = {
            param1: 0.5,
            mix: 0.5
        };
        
        // Routing
        // input -> your nodes -> output
        
        this.updateParams();
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        // Update your nodes here
    }

    setParam1(val) { this.params.param1 = val; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'param1', label: 'Param 1', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }
}
```

---

## Need More Ideas?

Here are some effects and generators you could add:

### Generators
- **FM Synth** (2-4 operators)
- **Karplus-Strong** (plucked string synthesis)
- **Granular Synth** (cloud of tiny samples)
- **Super Saw** (detuned sawtooth stack)
- **Vocoder** (robot voice effect)

### Effects
- **Phaser** (series of all-pass filters)
- **Tremolo** (amplitude modulation)
- **Vibrato** (pitch modulation)
- **Compressor** (dynamic range compression)
- **EQ** (3-band equalizer)
- **Pitch Shifter** (harmonizer)
- **Stereo Widener**

Happy coding! 🎹🎛️🎵
