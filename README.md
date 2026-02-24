# 🎛️ Tone Generator

A real-time, browser-based synthesizer with multiple waveform generators and professional-grade effects. Built with the Web Audio API for zero-latency sound synthesis directly in your browser.

![Screenshot](screenshot.png)

## ✨ Features

### 5 Generator Types (4 Independent Channels)

#### Traditional Oscillators
- **Sine** - Pure tone, no harmonics
- **Sawtooth** - Rich, bright sound with all harmonics
- **Triangle** - Soft sound with odd harmonics
- **Square** - Hollow sound with adjustable duty cycle (PWM)

#### Advanced Generators
- **Noise** - 🆕 White, Pink, and Brown noise with adjustable filter
- **Binaural Beats** - 🆕 Brainwave entrainment for meditation, focus, and sleep (best with headphones!)

### Effects Chain (3 slots per channel)

#### Dynamics & Tone
- **Compressor/Limiter** - 🆕 Professional dynamics with character/saturation
- **PreFET Preamp** - 🆕 Transistor warmth and harmonic saturation
- **Distortion** - Soft-clipping overdrive
- **Bit Crusher** - Lo-fi digital reduction

#### Modulation Effects
- **Tremolo** - 🆕 Guitar-style amplitude modulation with auto-pan
- **Flanger** - Modulated delay for swooshing effect
- **Chorus** - Multi-voice modulation for thicker sound
- **Ring Modulator** - Multiplies signal with carrier frequency

#### Time & Space
- **Pro-R Reverb** - 🆕 Professional reverb with EQ, modulation, and frequency-specific decay
- **Tape Delay** - Analog-style delay with feedback and tone control
- **Reverb** - Convolution-based room simulation

### Special Features

#### Binaural Beats - Brainwave Entrainment 🧠
Best experienced with headphones! Creates two slightly different frequencies in each ear to produce a "beat" frequency that entrains brainwaves:

| Frequency | Name | State |
|-----------|------|-------|
| 1-4 Hz | Delta | Deep sleep, healing |
| 4-8 Hz | Theta | Meditation, deep relaxation |
| 8-14 Hz | Alpha | Relaxed alertness, creativity |
| 14-30 Hz | Beta | Active thinking, focus |
| 30-100 Hz | Gamma | High-level cognition |

### Real-time Controls
- Individual channel on/off
- Frequency/Carrier control
- Beat frequency (for binaural)
- Volume per channel
- Duty cycle for square waves
- Master volume with visualization

### Visualization
- Live waveform display on master output
- Smooth parameter transitions

### Presets
- **Drone** - Ambient atmospheric textures
- **Bass** - Deep bass sounds
- **Lead** - Bright lead tones with flanger
- **FX** - Experimental effects showcase
- **Meditate** - 🆕 Binaural theta waves for meditation
- **Reset** - Return to defaults

## 🚀 Getting Started

1. **Open `index.html`** in a modern web browser (Chrome, Firefox, Safari, Edge)

2. **Click "START AUDIO"** to initialize the audio engine

3. **Enable channels** using the toggle switches

4. **Select generator type:**
   - Traditional oscillators: Sine, Sawtooth, Triangle, Square
   - Noise with filter control
   - Binaural beats for brainwave entrainment

5. **Adjust settings:**
   - Set frequency/carrier (20Hz - 2000Hz)
   - For binaural: set beat frequency (1-50 Hz) or use brainwave presets
   - For square waves: adjust duty cycle (1% - 99%)
   - Adjust volume

6. **Add effects:**
   - Select effect from dropdown
   - Adjust effect parameters in real-time
   - Chain up to 3 effects per channel

7. **Use presets** for quick sound exploration

## 🧘 Using Binaural Beats

1. Select **"Binaural Beats"** from the waveform dropdown
2. Put on **headphones** (required for the effect!)
3. Set your carrier frequency (typically 100-400 Hz)
4. Choose your target brainwave:
   - Click **δ Sleep** for deep sleep
   - Click **θ Meditate** for meditation
   - Click **α Relax** for relaxed alertness
   - Click **β Focus** for concentration
   - Click **γ Peak** for peak cognition
5. Add reverb for a more immersive experience
6. Keep volume moderate and comfortable

**Note:** The effect works best when you're relaxed in a quiet environment. Give it 5-10 minutes to feel the full effect.

## 🏗️ Architecture

The project is designed to be **highly expandable**:

```
js/
├── generators.js   # 6 generator types + GeneratorFactory
├── effects.js      # 11 effects + EffectFactory
├── main.js         # SynthEngine - handles routing and state
└── ui.js           # UIManager - handles DOM and visualization
```

### Key Design Patterns

1. **Factory Pattern** - New generators/effects are automatically picked up by the UI
2. **Modular Effects Chain** - Effects can be chained in any order
3. **Smooth Transitions** - All parameter changes use audio-rate smoothing
4. **Band-limited Waveforms** - Custom wavetables prevent aliasing

## 📚 Expansion Guide

Want to add your own oscillators or effects? See **[EXPANSION_GUIDE.md](EXPANSION_GUIDE.md)** for:

- Step-by-step instructions for adding new generators
- Step-by-step instructions for adding new effects
- Code templates to get started quickly
- Tips for Web Audio API best practices

### Quick Example: Adding a New Effect

```javascript
// 1. Add to effects.js
class MyEffect extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'myeffect';
        // ... your implementation
    }
    
    getParamDefinitions() {
        return [
            { name: 'param1', label: 'Param 1', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }
}

// 2. Register in EffectFactory
const EffectFactory = {
    create(type, audioContext) {
        switch (type) {
            case 'myeffect':
                return new MyEffect(audioContext);
            // ...
        }
    }
};

// 3. Add to HTML dropdown - that's it!
```

## 🌐 Browser Compatibility

| Browser | Version |
|---------|---------|
| Chrome | 66+ |
| Firefox | 60+ |
| Safari | 14.1+ |
| Edge | 79+ |

**Note:** Binaural beats require stereo output and work best with headphones.

## 💡 Tips

### Sound Design
- **Start with one channel** and gradually add more
- **Use the duty cycle** on square waves for PWM sounds
- **Stack effects** in different orders for unique textures
- **Try slightly detuned frequencies** (e.g., 440Hz and 442Hz) for beating effects
- **Noise + Filter** = instant percussion sounds

### Binaural Beats
- Use **low volumes** - the effect works at quiet levels
- Theta (4-8 Hz) is best for **meditation and creativity**
- Alpha (8-14 Hz) helps with **learning and relaxation**
- Don't use beta/gamma for extended periods - can be overstimulating

### Professional Sound
- Use **Compressor/Limiter** to control dynamics
- Add **PreFET** for analog warmth on sterile digital sounds
- **Pro-R Reverb** with modulation for lush, immersive spaces
- **Tremolo** with square wave for rhythmic chop effects

## 🎹 Ideas to Try

1. **Atmospheric Drone**: 3 sine waves at close frequencies + Pro-R reverb
2. **8-bit Bass**: Square wave with bit crusher and compressor
3. **Sci-fi Laser**: Sawtooth with flanger and ring modulator
4. **Ocean Waves**: Pink noise with tremolo (sine, slow rate)
5. **Meditation Session**: Binaural theta + pink noise + Pro-R reverb
6. **Vintage Lead**: Sine + PreFET + Tape Delay + Chorus
7. **Rhythmic Chop**: Any waveform + Tremolo (square, tempo-synced rate)

## 📁 File Structure

```
tonegenerator/
├── index.html          # Main UI
├── styles.css          # Styling
├── README.md           # This file
├── EXPANSION_GUIDE.md  # Guide for extending
└── js/
    ├── main.js         # Synth engine and audio routing (~350 lines)
    ├── generators.js   # Oscillator implementations (~550 lines)
    ├── effects.js      # Effect processors (~900 lines)
    └── ui.js           # UI event handling (~550 lines)
```

## 🛠️ Technical Details

- **Sample Rate**: Uses browser's native sample rate (typically 44.1kHz or 48kHz)
- **FFT Size**: 2048 for visualization
- **Max Channels**: 4 (easily expandable)
- **Max Effects per Channel**: 3 (easily expandable)
- **Latency**: Low-latency processing via Web Audio API

## ⚕️ Disclaimer

**Binaural beats are for entertainment and relaxation purposes.** While some studies suggest benefits for focus, relaxation, and sleep, they are not a medical treatment. Do not use while driving or operating machinery. If you have epilepsy or a seizure disorder, consult a doctor before using binaural beats.

## 📜 License

MIT License - feel free to use, modify, and distribute!

## 🙏 Credits

Built with the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

**Have fun making noise (and finding your zen)!** 🎵🧘🔊
