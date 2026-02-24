/**
 * Tone Generator Module
 * Handles oscillator creation and waveform generation
 * 
 * TO ADD A NEW GENERATOR:
 * 1. Add your generator class below
 * 2. Update the GeneratorFactory at the bottom
 * 3. Add the option to the HTML select elements
 */

class ToneGenerator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.oscillator = null;
        this.gainNode = null;
        this.waveform = 'sine';
        this.frequency = 440;
        this.volume = 0.5;
        this.dutyCycle = 0.5;
        this.isPlaying = false;
        
        // Create wavetable cache for custom waveforms
        this.wavetableCache = {};
    }

    /**
     * Create a custom periodic wave for square wave with variable duty cycle
     */
    createSquareWaveWithDuty(duty) {
        const cacheKey = `square_${duty}`;
        if (this.wavetableCache[cacheKey]) {
            return this.wavetableCache[cacheKey];
        }

        // Use Fourier series to create a square wave with adjustable duty cycle
        const harmonics = 64;
        const real = new Float32Array(harmonics);
        const imag = new Float32Array(harmonics);

        real[0] = 0;
        imag[0] = 0;

        for (let i = 1; i < harmonics; i++) {
            const n = i;
            // Sinc-like function for pulse width
            const coeff = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
            
            real[i] = 0;
            imag[i] = coeff;
        }

        const wave = this.audioContext.createPeriodicWave(real, imag, {
            disableNormalization: false
        });
        
        this.wavetableCache[cacheKey] = wave;
        return wave;
    }

    /**
     * Create a band-limited sawtooth wave using additive synthesis
     */
    createSawtoothWave() {
        const cacheKey = 'sawtooth';
        if (this.wavetableCache[cacheKey]) {
            return this.wavetableCache[cacheKey];
        }

        const harmonics = 64;
        const real = new Float32Array(harmonics);
        const imag = new Float32Array(harmonics);

        real[0] = 0;
        imag[0] = 0;

        for (let i = 1; i < harmonics; i++) {
            // Sawtooth: 2/pi * (-1)^n / n
            const sign = i % 2 === 0 ? 1 : -1;
            real[i] = 0;
            imag[i] = sign * (2 / (i * Math.PI));
        }

        const wave = this.audioContext.createPeriodicWave(real, imag, {
            disableNormalization: false
        });
        
        this.wavetableCache[cacheKey] = wave;
        return wave;
    }

    /**
     * Create a band-limited triangle wave using additive synthesis
     */
    createTriangleWave() {
        const cacheKey = 'triangle';
        if (this.wavetableCache[cacheKey]) {
            return this.wavetableCache[cacheKey];
        }

        const harmonics = 64;
        const real = new Float32Array(harmonics);
        const imag = new Float32Array(harmonics);

        real[0] = 0;
        imag[0] = 0;

        for (let i = 1; i < harmonics; i++) {
            // Triangle: only odd harmonics, 8/(pi^2) * (-1)^((n-1)/2) / n^2
            if (i % 2 === 1) {
                const sign = ((i - 1) / 2) % 2 === 0 ? 1 : -1;
                real[i] = 0;
                imag[i] = sign * (8 / (Math.PI * Math.PI * i * i));
            } else {
                real[i] = 0;
                imag[i] = 0;
            }
        }

        const wave = this.audioContext.createPeriodicWave(real, imag, {
            disableNormalization: false
        });
        
        this.wavetableCache[cacheKey] = wave;
        return wave;
    }

    /**
     * Create the oscillator with the specified waveform
     */
    createOscillator() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
        }

        this.oscillator = this.audioContext.createOscillator();
        this.oscillator.frequency.value = this.frequency;

        switch (this.waveform) {
            case 'sine':
                this.oscillator.type = 'sine';
                break;
            case 'square':
                const squareWave = this.createSquareWaveWithDuty(this.dutyCycle);
                this.oscillator.setPeriodicWave(squareWave);
                break;
            case 'sawtooth':
                const sawWave = this.createSawtoothWave();
                this.oscillator.setPeriodicWave(sawWave);
                break;
            case 'triangle':
                const triWave = this.createTriangleWave();
                this.oscillator.setPeriodicWave(triWave);
                break;
            default:
                this.oscillator.type = 'sine';
        }

        if (!this.gainNode) {
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.volume;
        }

        this.oscillator.connect(this.gainNode);
        this.oscillator.start();
        
        return this.gainNode;
    }

    /**
     * Start playing the tone
     */
    start(destination) {
        if (this.isPlaying) return;

        const output = this.createOscillator();
        if (destination) {
            output.connect(destination);
        }
        
        this.isPlaying = true;
    }

    /**
     * Stop playing the tone
     */
    stop() {
        if (!this.isPlaying) return;

        if (this.gainNode) {
            const now = this.audioContext.currentTime;
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            
            setTimeout(() => {
                if (this.oscillator) {
                    try {
                        this.oscillator.stop();
                        this.oscillator.disconnect();
                    } catch (e) {}
                    this.oscillator = null;
                }
            }, 60);
        }

        this.isPlaying = false;
    }

    setWaveform(type) {
        this.waveform = type;
        if (this.isPlaying) {
            this.createOscillator();
        }
    }

    setFrequency(freq) {
        this.frequency = freq;
        if (this.oscillator) {
            const now = this.audioContext.currentTime;
            this.oscillator.frequency.setTargetAtTime(freq, now, 0.01);
        }
    }

    setVolume(vol) {
        this.volume = vol;
        if (this.gainNode) {
            const now = this.audioContext.currentTime;
            this.gainNode.gain.setTargetAtTime(vol, now, 0.01);
        }
    }

    setDutyCycle(duty) {
        this.dutyCycle = duty;
        if (this.isPlaying && this.waveform === 'square') {
            this.createOscillator();
        }
    }

    getOutput() {
        return this.gainNode;
    }

    getIsPlaying() {
        return this.isPlaying;
    }

    destroy() {
        this.stop();
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
    }
}


/**
 * ============================================================================
 * EXAMPLE: Noise Generator
 * ============================================================================
 * This is an example of how to add a new generator type.
 * 
 * New generators can be completely different from oscillators - they just need
 * to provide: start(), stop(), setVolume(), getOutput(), getIsPlaying(), destroy()
 */

class NoiseGenerator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.noiseNode = null;
        this.gainNode = null;
        this.filterNode = null;
        this.volume = 0.5;
        this.isPlaying = false;
        this.noiseType = 'white'; // white, pink, brown
        this.filterFreq = 1000;
    }

    /**
     * Create noise buffer based on type
     */
    createNoiseBuffer() {
        const bufferSize = 2 * this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);

        switch (this.noiseType) {
            case 'white':
                // Pure random noise
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }
                break;
                
            case 'pink':
                // Pink noise (1/f) - more energy in lower frequencies
                let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + white * 0.0555179;
                    b1 = 0.99332 * b1 + white * 0.0750759;
                    b2 = 0.96900 * b2 + white * 0.1538520;
                    b3 = 0.86650 * b3 + white * 0.3104856;
                    b4 = 0.55000 * b4 + white * 0.5329522;
                    b5 = -0.7616 * b5 - white * 0.0168980;
                    output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                    output[i] *= 0.11; // Normalize
                    b6 = white * 0.115926;
                }
                break;
                
            case 'brown':
                // Brown noise (1/f²) - even more low-frequency energy
                let lastOut = 0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    output[i] = (lastOut + (0.02 * white)) / 1.02;
                    lastOut = output[i];
                    output[i] *= 3.5; // Normalize
                }
                break;
        }

        return buffer;
    }

    /**
     * Create the noise source
     */
    createNoiseNode() {
        if (this.noiseNode) {
            this.noiseNode.stop();
            this.noiseNode.disconnect();
        }

        const buffer = this.createNoiseBuffer();
        this.noiseNode = this.audioContext.createBufferSource();
        this.noiseNode.buffer = buffer;
        this.noiseNode.loop = true;

        // Create filter
        if (!this.filterNode) {
            this.filterNode = this.audioContext.createBiquadFilter();
            this.filterNode.type = 'lowpass';
            this.filterNode.frequency.value = this.filterFreq;
            this.filterNode.Q.value = 0.5;
        }

        // Create gain node
        if (!this.gainNode) {
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.volume;
        }

        // Connect: noise -> filter -> gain
        this.noiseNode.connect(this.filterNode);
        this.filterNode.connect(this.gainNode);
        this.noiseNode.start();

        return this.gainNode;
    }

    start(destination) {
        if (this.isPlaying) return;

        const output = this.createNoiseNode();
        if (destination) {
            output.connect(destination);
        }

        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;

        if (this.gainNode) {
            const now = this.audioContext.currentTime;
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            setTimeout(() => {
                if (this.noiseNode) {
                    try {
                        this.noiseNode.stop();
                        this.noiseNode.disconnect();
                    } catch (e) {}
                    this.noiseNode = null;
                }
            }, 60);
        }

        this.isPlaying = false;
    }

    setNoiseType(type) {
        this.noiseType = type;
        if (this.isPlaying) {
            this.createNoiseNode();
        }
    }

    setFilterFreq(freq) {
        this.filterFreq = freq;
        if (this.filterNode) {
            const now = this.audioContext.currentTime;
            this.filterNode.frequency.setTargetAtTime(freq, now, 0.01);
        }
    }

    setVolume(vol) {
        this.volume = vol;
        if (this.gainNode) {
            const now = this.audioContext.currentTime;
            this.gainNode.gain.setTargetAtTime(vol, now, 0.01);
        }
    }

    getOutput() {
        return this.gainNode;
    }

    getIsPlaying() {
        return this.isPlaying;
    }

    destroy() {
        this.stop();
        if (this.filterNode) {
            this.filterNode.disconnect();
            this.filterNode = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
    }
}


/**
 * ============================================================================
 * Binaural Beats Generator
 * ============================================================================
 * Creates two sine waves with slightly different frequencies for brainwave
 * entrainment. Best experienced with headphones.
 * 
 * Brainwave frequency ranges:
 * - Delta (1-4 Hz): Deep sleep, healing
 * - Theta (4-8 Hz): Meditation, deep relaxation
 * - Alpha (8-14 Hz): Relaxed alertness, creativity
 * - Beta (14-30 Hz): Active thinking, focus
 * - Gamma (30-100 Hz): High-level cognition, peak concentration
 */

class BinauralBeatsGenerator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // Two oscillators for binaural effect
        this.oscLeft = null;
        this.oscRight = null;
        
        // Stereo panning
        this.merger = null;
        this.leftGain = null;
        this.rightGain = null;
        this.outputGain = null;
        
        this.isPlaying = false;
        this.volume = 0.5;
        
        // Parameters
        this.baseFreq = 200;        // Carrier frequency
        this.beatFreq = 10;         // Beat frequency (difference between ears)
        this.waveform = 'sine';
        
        // Preset brainwave frequencies
        this.presets = {
            delta: 2,      // 1-4 Hz: Deep sleep
            theta: 6,      // 4-8 Hz: Meditation
            alpha: 10,     // 8-14 Hz: Relaxed alertness
            beta: 20,      // 14-30 Hz: Focus
            gamma: 40      // 30-100 Hz: Peak cognition
        };
    }

    createBinauralOscillators() {
        // Clean up existing
        if (this.oscLeft) {
            this.oscLeft.stop();
            this.oscLeft.disconnect();
        }
        if (this.oscRight) {
            this.oscRight.stop();
            this.oscRight.disconnect();
        }
        
        // Create merger for stereo output
        this.merger = this.audioContext.createChannelMerger(2);
        
        // Left ear oscillator
        this.oscLeft = this.audioContext.createOscillator();
        this.oscLeft.type = this.waveform;
        this.oscLeft.frequency.value = this.baseFreq - (this.beatFreq / 2);
        
        // Right ear oscillator
        this.oscRight = this.audioContext.createOscillator();
        this.oscRight.type = this.waveform;
        this.oscRight.frequency.value = this.baseFreq + (this.beatFreq / 2);
        
        // Individual channel gains for stereo balance
        this.leftGain = this.audioContext.createGain();
        this.leftGain.gain.value = 1;
        
        this.rightGain = this.audioContext.createGain();
        this.rightGain.gain.value = 1;
        
        // Master output gain
        this.outputGain = this.audioContext.createGain();
        this.outputGain.gain.value = this.volume;
        
        // Routing: oscillators -> channel gains -> merger -> output
        this.oscLeft.connect(this.leftGain);
        this.leftGain.connect(this.merger, 0, 0); // Connect to left channel
        
        this.oscRight.connect(this.rightGain);
        this.rightGain.connect(this.merger, 0, 1); // Connect to right channel
        
        this.merger.connect(this.outputGain);
        
        this.oscLeft.start();
        this.oscRight.start();
        
        return this.outputGain;
    }

    start(destination) {
        if (this.isPlaying) return;
        
        const output = this.createBinauralOscillators();
        if (destination) {
            output.connect(destination);
        }
        
        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;
        
        // Smooth fade out
        if (this.outputGain) {
            const now = this.audioContext.currentTime;
            this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
            this.outputGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            
            setTimeout(() => {
                if (this.oscLeft) {
                    try { this.oscLeft.stop(); this.oscLeft.disconnect(); } catch (e) {}
                    this.oscLeft = null;
                }
                if (this.oscRight) {
                    try { this.oscRight.stop(); this.oscRight.disconnect(); } catch (e) {}
                    this.oscRight = null;
                }
                if (this.merger) {
                    this.merger.disconnect();
                    this.merger = null;
                }
            }, 60);
        }
        
        this.isPlaying = false;
    }

    setBaseFrequency(freq) {
        this.baseFreq = freq;
        if (this.isPlaying) {
            const now = this.audioContext.currentTime;
            this.oscLeft.frequency.setTargetAtTime(this.baseFreq - (this.beatFreq / 2), now, 0.01);
            this.oscRight.frequency.setTargetAtTime(this.baseFreq + (this.beatFreq / 2), now, 0.01);
        }
    }

    setBeatFrequency(freq) {
        this.beatFreq = freq;
        if (this.isPlaying) {
            const now = this.audioContext.currentTime;
            this.oscLeft.frequency.setTargetAtTime(this.baseFreq - (this.beatFreq / 2), now, 0.01);
            this.oscRight.frequency.setTargetAtTime(this.baseFreq + (this.beatFreq / 2), now, 0.01);
        }
    }

    setPreset(presetName) {
        if (this.presets[presetName]) {
            this.setBeatFrequency(this.presets[presetName]);
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
        if (this.leftGain) {
            this.leftGain.disconnect();
            this.leftGain = null;
        }
        if (this.rightGain) {
            this.rightGain.disconnect();
            this.rightGain = null;
        }
        if (this.outputGain) {
            this.outputGain.disconnect();
            this.outputGain = null;
        }
    }
}


/**
 * ============================================================================
 * Generator Factory
 * ============================================================================
 * Use this factory to create generators. Add new generator types here.
 */

const GeneratorFactory = {
    create(type, audioContext) {
        switch (type) {
            case 'fm':
                return new FMSynthesizer(audioContext);
            case 'binaural':
                return new BinauralBeatsGenerator(audioContext);
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
            { id: 'binaural', name: '🧠 Binaural', hasDuty: false },
            { id: 'fm', name: '🎹 FM Synth', hasDuty: false }
        ];
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {


// ============================================================================
// FM Synthesizer
// ============================================================================

/**
 * FM Synthesizer Module
 * Frequency Modulation synthesis using two oscillators:
 * - Carrier: The main audible tone
 * - Modulator: Modulates the carrier's frequency, creating sidebands/harmonics
 */

class FMSynthesizer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.carrier = null;
        this.modulator = null;
        this.modulationIndex = null;
        this.outputGain = null;
        this.isPlaying = false;
        this.volume = 0.5;
        
        this.carrierFreq = 440;
        this.modulatorFreq = 110;
        this.modulationDepth = 100;
        this.algorithm = 0;
        
        this.algorithms = [
            { name: '1:1 Classic FM', carrierMult: 1, modulatorMult: 1 },
            { name: '1:2 Octave Up', carrierMult: 1, modulatorMult: 2 },
            { name: '2:1 Octave Down', carrierMult: 2, modulatorMult: 1 },
            { name: '3:1 Bell-like', carrierMult: 3, modulatorMult: 1 }
        ];
    }

    calculateFrequencies() {
        const algo = this.algorithms[this.algorithm];
        return {
            carrier: this.carrierFreq * algo.carrierMult,
            modulator: this.modulatorFreq * algo.modulatorMult
        };
    }

    createFMOscillators() {
        if (this.carrier) {
            this.carrier.stop();
            this.carrier.disconnect();
        }
        if (this.modulator) {
            this.modulator.stop();
            this.modulator.disconnect();
        }
        if (this.modulationIndex) {
            this.modulationIndex.disconnect();
        }
        
        const freqs = this.calculateFrequencies();
        
        this.modulator = this.audioContext.createOscillator();
        this.modulator.type = 'sine';
        this.modulator.frequency.value = freqs.modulator;
        
        this.modulationIndex = this.audioContext.createGain();
        this.modulationIndex.gain.value = this.modulationDepth;
        
        this.carrier = this.audioContext.createOscillator();
        this.carrier.type = 'sine';
        this.carrier.frequency.value = freqs.carrier;
        
        if (!this.outputGain) {
            this.outputGain = this.audioContext.createGain();
            this.outputGain.gain.value = this.volume;
        }
        
        this.modulator.connect(this.modulationIndex);
        this.modulationIndex.connect(this.carrier.frequency);
        this.carrier.connect(this.outputGain);
        
        this.modulator.start();
        this.carrier.start();
        
        return this.outputGain;
    }

    start(destination) {
        if (this.isPlaying) return;
        
        const output = this.createFMOscillators();
        if (destination) {
            output.connect(destination);
        }
        
        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;
        
        if (this.outputGain) {
            const now = this.audioContext.currentTime;
            this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
            this.outputGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            
            setTimeout(() => {
                if (this.carrier) {
                    try { this.carrier.stop(); this.carrier.disconnect(); } catch (e) {}
                    this.carrier = null;
                }
                if (this.modulator) {
                    try { this.modulator.stop(); this.modulator.disconnect(); } catch (e) {}
                    this.modulator = null;
                }
                if (this.modulationIndex) {
                    this.modulationIndex.disconnect();
                    this.modulationIndex = null;
                }
            }, 60);
        }
        
        this.isPlaying = false;
    }

    setCarrierFreq(freq) {
        this.carrierFreq = Math.max(20, Math.min(2000, freq));
        if (this.isPlaying && this.carrier) {
            const freqs = this.calculateFrequencies();
            const now = this.audioContext.currentTime;
            this.carrier.frequency.setTargetAtTime(freqs.carrier, now, 0.01);
        }
    }

    setModulatorFreq(freq) {
        this.modulatorFreq = Math.max(1, Math.min(2000, freq));
        if (this.isPlaying && this.modulator) {
            const freqs = this.calculateFrequencies();
            const now = this.audioContext.currentTime;
            this.modulator.frequency.setTargetAtTime(freqs.modulator, now, 0.01);
        }
    }

    setModulationIndex(index) {
        this.modulationDepth = Math.max(0, Math.min(1000, index));
        if (this.isPlaying && this.modulationIndex) {
            const now = this.audioContext.currentTime;
            this.modulationIndex.gain.setTargetAtTime(this.modulationDepth, now, 0.01);
        }
    }

    setAlgorithm(alg) {
        this.algorithm = Math.max(0, Math.min(3, Math.floor(alg)));
        if (this.isPlaying) {
            const freqs = this.calculateFrequencies();
            const now = this.audioContext.currentTime;
            if (this.carrier) {
                this.carrier.frequency.setTargetAtTime(freqs.carrier, now, 0.01);
            }
            if (this.modulator) {
                this.modulator.frequency.setTargetAtTime(freqs.modulator, now, 0.01);
            }
        }
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.outputGain) {
            const now = this.audioContext.currentTime;
            this.outputGain.gain.setTargetAtTime(this.volume, now, 0.01);
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
        if (this.outputGain) {
            this.outputGain.disconnect();
            this.outputGain = null;
        }
    }
}


// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        ToneGenerator, 
        NoiseGenerator,
        BinauralBeatsGenerator,
        FMSynthesizer,
        GeneratorFactory 
    };
}

}
