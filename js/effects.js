/**
 * Effects Module
 * Provides audio effects: Ring Modulator, Flanger, Tape Delay, Reverb
 * 
 * TO ADD A NEW EFFECT:
 * 1. Create a new class extending Effect
 * 2. Implement: constructor, updateParams, setX() methods for each param, getParamDefinitions()
 * 3. Add to EffectFactory,
        Phaser,
        PingPongDelay,
        AmplitudeModulation,
        CombFilter.create() and EffectFactory.getEffectTypes()
 */

class Effect {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.input = null;
        this.output = null;
        this.bypass = false;
        this.params = {};
    }

    connect(destination) {
        if (this.output) {
            this.output.connect(destination);
        }
    }

    disconnect() {
        if (this.output) {
            this.output.disconnect();
        }
    }

    getInput() {
        return this.input;
    }

    getOutput() {
        return this.output;
    }

    setBypass(enable) {
        this.bypass = enable;
    }

    destroy() {
        this.disconnect();
    }
}


// ============================================================================
// EXISTING EFFECTS
// ============================================================================

class RingModulator extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'ringmod';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        this.carrier = this.audioContext.createOscillator();
        this.carrierGain = this.audioContext.createGain();
        this.modulator = this.audioContext.createGain();
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = { frequency: 440, mix: 0.5 };
        
        this.carrier.connect(this.carrierGain);
        this.carrierGain.connect(this.modulator.gain);
        
        this.input.connect(this.modulator);
        this.modulator.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        this.carrier.frequency.value = this.params.frequency;
        this.carrier.type = 'sine';
        this.carrier.start();
        
        this.updateParams();
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.carrier.frequency.setTargetAtTime(this.params.frequency, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
        this.carrierGain.gain.value = 1;
    }

    setFrequency(freq) { this.params.frequency = freq; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'frequency', label: 'Frequency', min: 20, max: 2000, default: 440, step: 1 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }

    destroy() {
        this.carrier.stop();
        super.destroy();
    }
}


class Flanger extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'flanger';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        this.delay = this.audioContext.createDelay(0.1);
        this.lfo = this.audioContext.createOscillator();
        this.lfoGain = this.audioContext.createGain();
        this.feedback = this.audioContext.createGain();
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = { rate: 0.5, depth: 0.002, feedback: 0.5, mix: 0.5 };
        
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.delay.delayTime);
        
        this.input.connect(this.delay);
        this.delay.connect(this.feedback);
        this.feedback.connect(this.delay);
        
        this.delay.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        this.lfo.type = 'sine';
        this.lfo.frequency.value = this.params.rate;
        this.lfo.start();
        
        this.delay.delayTime.value = 0.005;
        
        this.updateParams();
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.lfo.frequency.setTargetAtTime(this.params.rate, now, 0.01);
        this.lfoGain.gain.setTargetAtTime(this.params.depth, now, 0.01);
        this.feedback.gain.setTargetAtTime(this.params.feedback, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setRate(rate) { this.params.rate = rate; this.updateParams(); }
    setDepth(depth) { this.params.depth = depth; this.updateParams(); }
    setFeedback(feedback) { this.params.feedback = feedback; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'rate', label: 'Rate', min: 0.1, max: 10, default: 0.5, step: 0.1 },
            { name: 'depth', label: 'Depth', min: 0.0001, max: 0.01, default: 0.002, step: 0.0001 },
            { name: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0.5, step: 0.01 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }

    destroy() {
        this.lfo.stop();
        super.destroy();
    }
}


class TapeDelay extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'delay';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        this.delay = this.audioContext.createDelay(5.0);
        this.feedback = this.audioContext.createGain();
        this.toneFilter = this.audioContext.createBiquadFilter();
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = { time: 0.3, feedback: 0.4, tone: 0.5, mix: 0.3 };
        
        this.toneFilter.type = 'lowpass';
        this.toneFilter.frequency.value = 3000;
        this.toneFilter.Q.value = 0.5;
        
        this.input.connect(this.delay);
        this.delay.connect(this.toneFilter);
        this.toneFilter.connect(this.feedback);
        this.feedback.connect(this.delay);
        
        this.delay.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        this.updateParams();
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.delay.delayTime.setTargetAtTime(this.params.time, now, 0.1);
        this.feedback.gain.setTargetAtTime(this.params.feedback, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
        const freq = 200 + (this.params.tone * 7800);
        this.toneFilter.frequency.setTargetAtTime(freq, now, 0.01);
    }

    setTime(time) { this.params.time = time; this.updateParams(); }
    setFeedback(feedback) { this.params.feedback = feedback; this.updateParams(); }
    setTone(tone) { this.params.tone = tone; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'time', label: 'Time', min: 0.05, max: 2, default: 0.3, step: 0.01 },
            { name: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0.4, step: 0.01 },
            { name: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.3, step: 0.01 }
        ];
    }
}


class Reverb extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'reverb';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        this.convolver = this.audioContext.createConvolver();
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        this.preDelay = this.audioContext.createDelay(0.5);
        
        this.params = { size: 0.5, decay: 2.0, preDelay: 0.02, mix: 0.3 };
        
        this.input.connect(this.preDelay);
        this.preDelay.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        this.generateImpulseResponse();
        this.updateParams();
    }

    generateImpulseResponse() {
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * this.params.decay * 2;
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            
            for (let i = 0; i < length; i++) {
                const time = i / sampleRate;
                let envelope = Math.exp(-3 * time / this.params.decay);
                const noise = (Math.random() * 2 - 1);
                
                if (time < 0.1) {
                    const earlyEnvelope = Math.exp(-10 * time);
                    channelData[i] = noise * earlyEnvelope * 0.3;
                } else {
                    channelData[i] = noise * envelope * this.params.size;
                }
            }
        }
        
        this.convolver.buffer = impulse;
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.preDelay.delayTime.setTargetAtTime(this.params.preDelay, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setSize(size) { this.params.size = size; this.generateImpulseResponse(); }
    setDecay(decay) { this.params.decay = decay; this.generateImpulseResponse(); }
    setPreDelay(preDelay) { this.params.preDelay = preDelay; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'size', label: 'Room Size', min: 0.1, max: 1, default: 0.5, step: 0.01 },
            { name: 'decay', label: 'Decay', min: 0.5, max: 5, default: 2, step: 0.1 },
            { name: 'preDelay', label: 'Pre-Delay', min: 0, max: 0.2, default: 0.02, step: 0.001 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.3, step: 0.01 }
        ];
    }
}


// ============================================================================
// NEW EFFECTS EXAMPLES
// ============================================================================

/**
 * Chorus Effect
 * Similar to flanger but with longer delay times for a thicker sound
 */
class Chorus extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'chorus';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        // Multiple delay lines for richer chorus
        this.delay1 = this.audioContext.createDelay(0.1);
        this.delay2 = this.audioContext.createDelay(0.1);
        
        this.lfo1 = this.audioContext.createOscillator();
        this.lfo2 = this.audioContext.createOscillator();
        this.lfoGain1 = this.audioContext.createGain();
        this.lfoGain2 = this.audioContext.createGain();
        
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = {
            rate: 1.5,      // LFO rate
            depth: 0.015,   // Delay modulation depth (longer than flanger)
            voices: 2,      // Number of chorus voices
            mix: 0.5
        };
        
        // Set up LFOs with phase offset for stereo-like effect
        this.lfo1.connect(this.lfoGain1);
        this.lfoGain1.connect(this.delay1.delayTime);
        
        this.lfo2.connect(this.lfoGain2);
        this.lfo2.connect(this.delay2.delayTime);
        
        // Input to delays
        this.input.connect(this.delay1);
        this.input.connect(this.delay2);
        
        // Delays to wet output
        this.delay1.connect(this.wetGain);
        this.delay2.connect(this.wetGain);
        
        this.wetGain.connect(this.output);
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Set initial delay times
        this.delay1.delayTime.value = 0.02;
        this.delay2.delayTime.value = 0.025;
        
        // Start LFOs
        this.lfo1.type = 'sine';
        this.lfo1.frequency.value = this.params.rate;
        this.lfo1.start();
        
        this.lfo2.type = 'sine';
        this.lfo2.frequency.value = this.params.rate * 0.95; // Slight detune
        this.lfo2.start();
        
        this.updateParams();
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.lfo1.frequency.setTargetAtTime(this.params.rate, now, 0.01);
        this.lfo2.frequency.setTargetAtTime(this.params.rate * 0.95, now, 0.01);
        this.lfoGain1.gain.setTargetAtTime(this.params.depth, now, 0.01);
        this.lfoGain2.gain.setTargetAtTime(this.params.depth, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setRate(rate) { this.params.rate = rate; this.updateParams(); }
    setDepth(depth) { this.params.depth = depth; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'rate', label: 'Rate', min: 0.1, max: 5, default: 1.5, step: 0.1 },
            { name: 'depth', label: 'Depth', min: 0.001, max: 0.03, default: 0.015, step: 0.001 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }

    destroy() {
        this.lfo1.stop();
        this.lfo2.stop();
        super.destroy();
    }
}


/**
 * Distortion Effect
 * Adds harmonics and grit using waveshaping
 */
class Distortion extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'distortion';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        this.waveshaper = this.audioContext.createWaveShaper();
        this.preGain = this.audioContext.createGain();
        this.postGain = this.audioContext.createGain();
        this.tone = this.audioContext.createBiquadFilter();
        
        this.params = {
            amount: 20,     // Distortion amount
            tone: 0.5,      // High-cut filter
            mix: 0.3
        };
        
        // Set up tone filter
        this.tone.type = 'lowpass';
        this.tone.frequency.value = 3000;
        this.tone.Q.value = 0.5;
        
        // Chain: input -> pre-gain -> waveshaper -> tone -> post-gain -> output
        this.input.connect(this.preGain);
        this.preGain.connect(this.waveshaper);
        this.waveshaper.connect(this.tone);
        this.tone.connect(this.postGain);
        
        // Mix handling
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.input.connect(this.dryGain);
        this.postGain.connect(this.wetGain);
        
        this.dryGain.connect(this.output);
        this.wetGain.connect(this.output);
        
        this.makeDistortionCurve();
        this.updateParams();
    }

    /**
     * Create waveshaper curve for distortion
     */
    makeDistortionCurve() {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const amount = this.params.amount;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            // Soft clipping function
            curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
        }
        
        this.waveshaper.curve = curve;
        this.waveshaper.oversample = '4x';
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        
        // Pre-gain increases drive
        const drive = 1 + (this.params.amount / 5);
        this.preGain.gain.setTargetAtTime(drive, now, 0.01);
        
        // Post-gain compensates for volume increase
        this.postGain.gain.setTargetAtTime(1 / Math.sqrt(drive), now, 0.01);
        
        // Tone control
        const freq = 500 + (this.params.tone * 9500);
        this.tone.frequency.setTargetAtTime(freq, now, 0.01);
        
        // Mix
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setAmount(amount) {
        this.params.amount = amount;
        this.makeDistortionCurve();
        this.updateParams();
    }

    setTone(tone) {
        this.params.tone = tone;
        this.updateParams();
    }

    setMix(mix) {
        this.params.mix = mix;
        this.updateParams();
    }

    getParamDefinitions() {
        return [
            { name: 'amount', label: 'Drive', min: 0, max: 100, default: 20, step: 1 },
            { name: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.3, step: 0.01 }
        ];
    }
}


/**
 * Bit Crusher Effect
 * Reduces bit depth and sample rate for lo-fi digital sound
 */
class BitCrusher extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'bitcrusher';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        // We need a script processor for bit crushing (or use an AudioWorklet in modern browsers)
        // For simplicity, we'll use a waveshaper to simulate bit reduction
        this.quantizer = this.audioContext.createWaveShaper();
        
        this.params = {
            bits: 8,        // Bit depth (1-16)
            mix: 0.5
        };
        
        this.input.connect(this.quantizer);
        this.quantizer.connect(this.output);
        
        this.makeQuantizationCurve();
        this.updateParams();
    }

    makeQuantizationCurve() {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const levels = Math.pow(2, this.params.bits - 1);
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            // Quantize to N bits
            const quantized = Math.round(x * levels) / levels;
            curve[i] = quantized;
        }
        
        this.quantizer.curve = curve;
    }

    updateParams() {
        // Nothing to update continuously
    }

    setBits(bits) {
        this.params.bits = bits;
        this.makeQuantizationCurve();
    }

    setMix(mix) {
        this.params.mix = mix;
        // Would need wet/dry mix - simplified here
    }

    getParamDefinitions() {
        return [
            { name: 'bits', label: 'Bit Depth', min: 1, max: 16, default: 8, step: 1 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }
}


// ============================================================================
// NEW ADVANCED EFFECTS
// ============================================================================

/**
 * Compressor/Limiter (Zener Limiter style)
 * Professional dynamics processor with Peak/RMS detection modes
 * Includes harmonic saturation for character
 */
class CompressorLimiter extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'compressor';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        // Main compressor using native DynamicsCompressorNode
        this.compressor = this.audioContext.createDynamicsCompressor();
        
        // Makeup gain
        this.makeupGain = this.audioContext.createGain();
        
        // Harmonic saturation for character (Zener-style)
        this.saturator = this.audioContext.createWaveShaper();
        this.saturationGain = this.audioContext.createGain();
        
        // Wet/dry mix
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        // Parameters
        this.params = {
            threshold: -24,      // dB
            knee: 30,           // dB
            ratio: 12,          // 1:1 to 20:1
            attack: 0.003,      // seconds
            release: 0.25,      // seconds
            detection: 'peak',  // 'peak' or 'rms'
            saturation: 0.3,    // 0-1 character amount
            makeup: 0,          // dB makeup gain
            mix: 1.0           // wet/dry
        };
        
        // Build saturation curve
        this.makeSaturationCurve();
        
        // Routing: input -> compressor -> saturator -> makeup -> wet
        this.input.connect(this.compressor);
        this.compressor.connect(this.saturator);
        this.saturator.connect(this.saturationGain);
        this.saturationGain.connect(this.makeupGain);
        this.makeupGain.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        // Dry path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        this.updateParams();
    }

    makeSaturationCurve() {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const amount = this.params.saturation * 10 + 1; // 1 to 11
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            // Zener-like soft limiting with harmonics
            const saturated = Math.tanh(amount * x);
            // Blend based on saturation amount
            curve[i] = x * (1 - this.params.saturation) + saturated * this.params.saturation;
        }
        
        this.saturator.curve = curve;
        this.saturator.oversample = '4x';
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        
        // Compressor parameters
        this.compressor.threshold.setTargetAtTime(this.params.threshold, now, 0.01);
        this.compressor.knee.setTargetAtTime(this.params.knee, now, 0.01);
        this.compressor.ratio.setTargetAtTime(this.params.ratio, now, 0.01);
        this.compressor.attack.setTargetAtTime(this.params.attack, now, 0.01);
        this.compressor.release.setTargetAtTime(this.params.release, now, 0.01);
        
        // Makeup gain (convert dB to linear)
        const makeupLinear = Math.pow(10, this.params.makeup / 20);
        this.makeupGain.gain.setTargetAtTime(makeupLinear, now, 0.01);
        
        // Saturation blend
        this.saturationGain.gain.setTargetAtTime(this.params.saturation > 0 ? 1 : 0, now, 0.01);
        
        // Mix
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
        
        // Rebuild curve if saturation changed
        this.makeSaturationCurve();
    }

    setThreshold(db) { this.params.threshold = db; this.updateParams(); }
    setKnee(db) { this.params.knee = db; this.updateParams(); }
    setRatio(ratio) { this.params.ratio = ratio; this.updateParams(); }
    setAttack(sec) { this.params.attack = sec; this.updateParams(); }
    setRelease(sec) { this.params.release = sec; this.updateParams(); }
    setDetection(mode) { this.params.detection = mode; /* Native node handles this internally */ }
    setSaturation(amount) { this.params.saturation = amount; this.updateParams(); }
    setMakeup(db) { this.params.makeup = db; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'threshold', label: 'Threshold (dB)', min: -60, max: 0, default: -24, step: 1 },
            { name: 'knee', label: 'Knee (dB)', min: 0, max: 40, default: 30, step: 1 },
            { name: 'ratio', label: 'Ratio', min: 1, max: 20, default: 12, step: 0.5 },
            { name: 'attack', label: 'Attack (s)', min: 0.001, max: 1, default: 0.003, step: 0.001 },
            { name: 'release', label: 'Release (s)', min: 0.01, max: 1, default: 0.25, step: 0.01 },
            { name: 'saturation', label: 'Character', min: 0, max: 1, default: 0.3, step: 0.01 },
            { name: 'makeup', label: 'Makeup (dB)', min: 0, max: 24, default: 0, step: 0.5 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 1, step: 0.01 }
        ];
    }
}


/**
 * Tremolo Control
 * Guitar-style tremolo with multiple LFO waveforms
 * Can create reverse-sounding effects with square wave
 */
class Tremolo extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'tremolo';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        // LFO for amplitude modulation
        this.lfo = this.audioContext.createOscillator();
        this.lfoGain = this.audioContext.createGain();
        this.depthGain = this.audioContext.createGain();
        
        // Stereo panner for auto-pan option
        this.panner = this.audioContext.createStereoPanner();
        
        // Parameters
        this.params = {
            rate: 5,            // LFO rate in Hz
            depth: 0.5,         // Modulation depth (0-1)
            waveform: 'sine',   // sine, square, triangle, sawtooth
            stereo: 0,          // 0 = tremolo, 1 = auto-pan
            phase: 0            // Stereo phase offset for width
        };
        
        // Routing
        this.input.connect(this.output);
        
        // LFO controls the gain
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.output.gain);
        
        // Stereo panning
        this.lfo.connect(this.panner.pan);
        
        this.lfo.frequency.value = this.params.rate;
        this.lfo.type = this.params.waveform;
        this.lfo.start();
        
        this.updateParams();
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        
        this.lfo.frequency.setTargetAtTime(this.params.rate, now, 0.01);
        this.lfo.type = this.params.waveform;
        
        // Depth controls how much the gain varies
        // At depth 1: gain goes from 0 to 1
        // At depth 0.5: gain goes from 0.5 to 1
        const minGain = 1 - this.params.depth;
        this.lfoGain.gain.setTargetAtTime((1 - minGain) / 2, now, 0.01);
        this.output.gain.setTargetAtTime(minGain + (1 - minGain) / 2, now, 0.01);
        
        // Stereo width
        this.panner.pan.setTargetAtTime(this.params.stereo, now, 0.01);
    }

    setRate(rate) { this.params.rate = rate; this.updateParams(); }
    setDepth(depth) { this.params.depth = depth; this.updateParams(); }
    
    setWaveform(waveform) {
        this.params.waveform = waveform;
        this.updateParams();
    }
    
    setStereo(width) { this.params.stereo = width; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'rate', label: 'Rate (Hz)', min: 0.1, max: 20, default: 5, step: 0.1 },
            { name: 'depth', label: 'Depth', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'waveform', label: 'Waveform', min: 0, max: 3, default: 0, step: 1 }, // Special handling
            { name: 'stereo', label: 'Auto-Pan', min: 0, max: 1, default: 0, step: 0.01 }
        ];
    }

    destroy() {
        this.lfo.stop();
        super.destroy();
    }
}


/**
 * PreFET Preamp Emulation
 * Transistor-style preamp with warmth and harmonic saturation
 * Adds even and odd harmonics for that "analog" sound
 */
class PreFET extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'prefet';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        // High-pass filter to remove DC/low freq rumble
        this.hpFilter = this.audioContext.createBiquadFilter();
        this.hpFilter.type = 'highpass';
        this.hpFilter.frequency.value = 20;
        
        // Main saturation stages
        this.saturator1 = this.audioContext.createWaveShaper();
        this.stage1Gain = this.audioContext.createGain();
        
        this.saturator2 = this.audioContext.createWaveShaper();
        this.stage2Gain = this.audioContext.createGain();
        
        // Tone shaping EQ
        this.toneLow = this.audioContext.createBiquadFilter();
        this.toneLow.type = 'lowshelf';
        this.toneLow.frequency.value = 200;
        
        this.toneHigh = this.audioContext.createBiquadFilter();
        this.toneHigh.type = 'highshelf';
        this.toneHigh.frequency.value = 3000;
        
        // Output trim
        this.trimGain = this.audioContext.createGain();
        
        // Wet/dry
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        // Parameters
        this.params = {
            drive: 30,          // Input gain (dB)
            warmth: 0.5,        // Low harmonic content
            presence: 0.3,      // High frequency emphasis
            output: 0,          // Output trim (dB)
            mix: 0.5
        };
        
        // Build saturation curves
        this.makeSaturationCurves();
        
        // Routing
        this.input.connect(this.hpFilter);
        this.hpFilter.connect(this.stage1Gain);
        this.stage1Gain.connect(this.saturator1);
        this.saturator1.connect(this.stage2Gain);
        this.stage2Gain.connect(this.saturator2);
        this.saturator2.connect(this.toneLow);
        this.toneLow.connect(this.toneHigh);
        this.toneHigh.connect(this.trimGain);
        this.trimGain.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        this.updateParams();
    }

    makeSaturationCurves() {
        // Stage 1: Gentle tube-like saturation
        const samples = 44100;
        const curve1 = new Float32Array(samples);
        const curve2 = new Float32Array(samples);
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            
            // Stage 1: Soft asymmetrical saturation (even harmonics)
            const asym = x > 0 ? x : x * 0.9; // Slight asymmetry
            curve1[i] = Math.tanh(asym * 2);
            
            // Stage 2: Harder symmetrical saturation (odd harmonics)
            curve2[i] = Math.tanh(x * 3) * 0.8 + x * 0.2;
        }
        
        this.saturator1.curve = curve1;
        this.saturator1.oversample = '4x';
        this.saturator2.curve = curve2;
        this.saturator2.oversample = '4x';
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        
        // Drive increases input gain
        const driveLinear = Math.pow(10, this.params.drive / 20);
        this.stage1Gain.gain.setTargetAtTime(driveLinear, now, 0.01);
        
        // Stage 2 gain based on warmth
        this.stage2Gain.gain.setTargetAtTime(0.5 + this.params.warmth * 0.5, now, 0.01);
        
        // Tone controls
        const lowGain = -12 + this.params.warmth * 24; // -12dB to +12dB
        this.toneLow.gain.setTargetAtTime(lowGain, now, 0.01);
        
        const highGain = -6 + this.params.presence * 18; // -6dB to +12dB
        this.toneHigh.gain.setTargetAtTime(highGain, now, 0.01);
        
        // Output trim
        const trimLinear = Math.pow(10, this.params.output / 20);
        this.trimGain.gain.setTargetAtTime(trimLinear, now, 0.01);
        
        // Mix
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setDrive(db) { this.params.drive = db; this.updateParams(); }
    setWarmth(amount) { this.params.warmth = amount; this.updateParams(); }
    setPresence(amount) { this.params.presence = amount; this.updateParams(); }
    setOutput(db) { this.params.output = db; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'drive', label: 'Drive (dB)', min: 0, max: 60, default: 30, step: 1 },
            { name: 'warmth', label: 'Warmth', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'presence', label: 'Presence', min: 0, max: 1, default: 0.3, step: 0.01 },
            { name: 'output', label: 'Output (dB)', min: -24, max: 12, default: 0, step: 0.5 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }
}


/**
 * ProR - Professional Reverb
 * Advanced reverb with EQ, modulation, and frequency-specific decay
 */
class ProR extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'pror';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        // Pre-delay
        this.preDelay = this.audioContext.createDelay(0.5);
        
        // Input filter (tone control)
        this.inputFilter = this.audioContext.createBiquadFilter();
        this.inputFilter.type = 'lowpass';
        this.inputFilter.frequency.value = 8000;
        
        // Multiple parallel comb filters for dense reflections
        this.combFilters = [];
        this.combGains = [];
        const combDelays = [0.0297, 0.0371, 0.0411, 0.0437];
        
        for (let i = 0; i < 4; i++) {
            const delay = this.audioContext.createDelay(0.1);
            delay.delayTime.value = combDelays[i];
            
            const gain = this.audioContext.createGain();
            gain.gain.value = 0.5;
            
            this.combFilters.push(delay);
            this.combGains.push(gain);
        }
        
        // All-pass filters for diffusion
        this.allpassFilters = [];
        const apDelays = [0.005, 0.0017, 0.0005];
        
        for (let i = 0; i < 3; i++) {
            const ap = this.audioContext.createBiquadFilter();
            ap.type = 'allpass';
            ap.frequency.value = 1000 / (i + 1);
            ap.Q.value = 0.5;
            this.allpassFilters.push(ap);
        }
        
        // Modulation LFO for shimmer
        this.modLFO = this.audioContext.createOscillator();
        this.modGain = this.audioContext.createGain();
        
        // Output filters (frequency-dependent decay)
        this.lowDecay = this.audioContext.createBiquadFilter();
        this.lowDecay.type = 'lowpass';
        this.lowDecay.frequency.value = 1000;
        this.lowDecay.Q.value = 0.5;
        
        this.highDecay = this.audioContext.createBiquadFilter();
        this.highDecay.type = 'highpass';
        this.highDecay.frequency.value = 200;
        this.highDecay.Q.value = 0.5;
        
        // Wet/dry
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        // Parameters
        this.params = {
            size: 0.5,          // Room size (affects delay times)
            decay: 2.0,         // Decay time in seconds
            preDelay: 0.02,     // Pre-delay time
            modulation: 0.3,    // Modulation depth
            dampLow: 0.3,       // Low frequency damping
            dampHigh: 0.5,      // High frequency damping
            mix: 0.3
        };
        
        // Build routing
        this.buildRouting();
        
        this.modLFO.type = 'sine';
        this.modLFO.frequency.value = 0.5;
        this.modLFO.connect(this.modGain);
        this.modLFO.start();
        
        this.updateParams();
    }

    buildRouting() {
        // Input -> pre-delay -> input filter
        this.input.connect(this.preDelay);
        this.preDelay.connect(this.inputFilter);
        
        // Input filter -> parallel comb filters
        for (let i = 0; i < 4; i++) {
            this.inputFilter.connect(this.combFilters[i]);
            this.combFilters[i].connect(this.combGains[i]);
        }
        
        // Comb filters -> allpass chain
        const mixGain = this.audioContext.createGain();
        mixGain.gain.value = 0.25;
        
        for (let i = 0; i < 4; i++) {
            this.combGains[i].connect(mixGain);
        }
        
        let currentNode = mixGain;
        for (let i = 0; i < 3; i++) {
            currentNode.connect(this.allpassFilters[i]);
            currentNode = this.allpassFilters[i];
        }
        
        // Allpass -> decay filters -> wet
        currentNode.connect(this.lowDecay);
        this.lowDecay.connect(this.highDecay);
        this.highDecay.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        // Modulation affects comb filter delays
        this.modGain.connect(this.combFilters[0].delayTime);
        this.modGain.connect(this.combFilters[1].delayTime);
        
        // Dry path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        
        // Pre-delay
        this.preDelay.delayTime.setTargetAtTime(this.params.preDelay, now, 0.01);
        
        // Comb filter delays based on size
        const baseDelays = [0.0297, 0.0371, 0.0411, 0.0437];
        for (let i = 0; i < 4; i++) {
            const scaledDelay = baseDelays[i] * (0.5 + this.params.size);
            this.combFilters[i].delayTime.setTargetAtTime(scaledDelay, now, 0.01);
            
            // Feedback gain based on decay time
            const feedback = Math.pow(0.001, baseDelays[i] / this.params.decay);
            this.combGains[i].gain.setTargetAtTime(feedback, now, 0.01);
        }
        
        // Modulation
        this.modLFO.frequency.setTargetAtTime(0.2 + this.params.modulation * 2, now, 0.01);
        this.modGain.gain.setTargetAtTime(this.params.modulation * 0.001, now, 0.01);
        
        // Damping filters
        const lowFreq = 200 + (1 - this.params.dampLow) * 2000;
        this.lowDecay.frequency.setTargetAtTime(lowFreq, now, 0.01);
        
        const highFreq = 200 + this.params.dampHigh * 8000;
        this.highDecay.frequency.setTargetAtTime(highFreq, now, 0.01);
        
        // Mix
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setSize(size) { this.params.size = size; this.updateParams(); }
    setDecay(decay) { this.params.decay = decay; this.updateParams(); }
    setPreDelay(time) { this.params.preDelay = time; this.updateParams(); }
    setModulation(amount) { this.params.modulation = amount; this.updateParams(); }
    setDampLow(amount) { this.params.dampLow = amount; this.updateParams(); }
    setDampHigh(amount) { this.params.dampHigh = amount; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'size', label: 'Room Size', min: 0.1, max: 1, default: 0.5, step: 0.01 },
            { name: 'decay', label: 'Decay (s)', min: 0.5, max: 10, default: 2, step: 0.1 },
            { name: 'preDelay', label: 'Pre-Delay', min: 0, max: 0.2, default: 0.02, step: 0.001 },
            { name: 'modulation', label: 'Modulation', min: 0, max: 1, default: 0.3, step: 0.01 },
            { name: 'dampLow', label: 'Low Damping', min: 0, max: 1, default: 0.3, step: 0.01 },
            { name: 'dampHigh', label: 'High Damping', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.3, step: 0.01 }
        ];
    }

}


/**
 * ============================================================================
 * BONUS EFFECTS - Phaser, Ping Pong Delay, Amplitude Mod, Comb Filter
 * ============================================================================
 */

/**
 * Phaser Effect
 * Uses all-pass filters to create sweeping notches in the spectrum
 */
class Phaser extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'phaser';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        this.stages = [];
        for (let i = 0; i < 6; i++) {
            const ap = this.audioContext.createBiquadFilter();
            ap.type = 'allpass';
            ap.frequency.value = 1000;
            ap.Q.value = 0.5;
            this.stages.push(ap);
        }
        
        this.lfo = this.audioContext.createOscillator();
        this.lfoGain = this.audioContext.createGain();
        this.feedbackGain = this.audioContext.createGain();
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = { rate: 0.5, depth: 0.6, feedback: 0.5, centerFreq: 1000, mix: 0.5 };
        
        this.buildRouting();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = this.params.rate;
        this.lfo.start();
        this.updateParams();
    }

    buildRouting() {
        this.input.connect(this.dryGain);
        let current = this.input;
        for (let ap of this.stages) {
            current.connect(ap);
            current = ap;
        }
        current.connect(this.feedbackGain);
        this.feedbackGain.connect(this.stages[0]);
        current.connect(this.wetGain);
        this.wetGain.connect(this.output);
        this.dryGain.connect(this.output);
        this.lfo.connect(this.lfoGain);
        for (let ap of this.stages) {
            this.lfoGain.connect(ap.frequency);
        }
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.lfo.frequency.setTargetAtTime(this.params.rate, now, 0.01);
        this.lfoGain.gain.setTargetAtTime(this.params.centerFreq * this.params.depth, now, 0.01);
        for (let i = 0; i < this.stages.length; i++) {
            this.stages[i].frequency.setTargetAtTime(this.params.centerFreq * (1 + i * 0.1), now, 0.01);
        }
        this.feedbackGain.gain.setTargetAtTime(this.params.feedback, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setRate(rate) { this.params.rate = rate; this.updateParams(); }
    setDepth(depth) { this.params.depth = depth; this.updateParams(); }
    setFeedback(fb) { this.params.feedback = fb; this.updateParams(); }
    setCenterFreq(f) { this.params.centerFreq = f; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'rate', label: 'Rate (Hz)', min: 0.05, max: 10, default: 0.5, step: 0.05 },
            { name: 'depth', label: 'Depth', min: 0, max: 1, default: 0.6, step: 0.01 },
            { name: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0.5, step: 0.01 },
            { name: 'centerFreq', label: 'Center (Hz)', min: 200, max: 5000, default: 1000, step: 50 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }

    destroy() { this.lfo.stop(); super.destroy(); }
}


/**
 * Ping Pong Delay
 * Bounces delay between left and right channels
 */
class PingPongDelay extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'pingpong';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        this.merger = this.audioContext.createChannelMerger(2);
        
        this.delayLeft = this.audioContext.createDelay(2.0);
        this.delayRight = this.audioContext.createDelay(2.0);
        this.feedbackLeft = this.audioContext.createGain();
        this.feedbackRight = this.audioContext.createGain();
        this.filterLeft = this.audioContext.createBiquadFilter();
        this.filterLeft.type = 'lowpass';
        this.filterRight = this.audioContext.createBiquadFilter();
        this.filterRight.type = 'lowpass';
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = { time: 0.3, feedback: 0.4, spread: 0.5, tone: 0.5, mix: 0.35 };
        
        this.buildRouting();
        this.updateParams();
    }

    buildRouting() {
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        this.input.connect(this.delayLeft);
        this.input.connect(this.delayRight);
        
        this.delayLeft.connect(this.filterLeft);
        this.filterLeft.connect(this.feedbackLeft);
        this.feedbackLeft.connect(this.delayRight);
        this.filterLeft.connect(this.merger, 0, 0);
        
        this.delayRight.connect(this.filterRight);
        this.filterRight.connect(this.feedbackRight);
        this.feedbackRight.connect(this.delayLeft);
        this.filterRight.connect(this.merger, 0, 1);
        
        this.merger.connect(this.wetGain);
        this.wetGain.connect(this.output);
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        const leftTime = this.params.time * (1 - this.params.spread * 0.3);
        const rightTime = this.params.time * (1 + this.params.spread * 0.3);
        this.delayLeft.delayTime.setTargetAtTime(leftTime, now, 0.1);
        this.delayRight.delayTime.setTargetAtTime(rightTime, now, 0.1);
        this.feedbackLeft.gain.setTargetAtTime(this.params.feedback, now, 0.01);
        this.feedbackRight.gain.setTargetAtTime(this.params.feedback, now, 0.01);
        const freq = 200 + this.params.tone * 7800;
        this.filterLeft.frequency.setTargetAtTime(freq, now, 0.01);
        this.filterRight.frequency.setTargetAtTime(freq, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setTime(t) { this.params.time = t; this.updateParams(); }
    setFeedback(fb) { this.params.feedback = fb; this.updateParams(); }
    setSpread(s) { this.params.spread = s; this.updateParams(); }
    setTone(t) { this.params.tone = t; this.updateParams(); }
    setMix(m) { this.params.mix = m; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'time', label: 'Time (s)', min: 0.05, max: 1.5, default: 0.3, step: 0.01 },
            { name: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0.4, step: 0.01 },
            { name: 'spread', label: 'Spread', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.35, step: 0.01 }
        ];
    }
}

/**
 * Amplitude Modulation
 * Similar to tremolo but with selectable carrier waveform
 */
class AmplitudeModulation extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'am';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        this.carrier = this.audioContext.createOscillator();
        this.carrierGain = this.audioContext.createGain();
        this.depthGain = this.audioContext.createGain();
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = { rate: 5, depth: 0.5, waveform: 0, mix: 0.5 };
        
        this.input.connect(this.depthGain);
        this.depthGain.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        this.carrier.connect(this.carrierGain);
        this.carrierGain.connect(this.depthGain.gain);
        
        this.carrier.frequency.value = this.params.rate;
        this.carrier.type = 'sine';
        this.carrier.start();
        
        this.updateParams();
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.carrier.frequency.setTargetAtTime(this.params.rate, now, 0.01);
        const waveforms = ['sine', 'square', 'triangle', 'sawtooth'];
        this.carrier.type = waveforms[Math.floor(this.params.waveform)] || 'sine';
        this.carrierGain.gain.setTargetAtTime(this.params.depth * 0.5, now, 0.01);
        this.depthGain.gain.setTargetAtTime(1 - this.params.depth * 0.5, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setRate(r) { this.params.rate = r; this.updateParams(); }
    setDepth(d) { this.params.depth = d; this.updateParams(); }
    setWaveform(w) { this.params.waveform = w; this.updateParams(); }
    setMix(m) { this.params.mix = m; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'rate', label: 'Rate (Hz)', min: 0.1, max: 50, default: 5, step: 0.1 },
            { name: 'depth', label: 'Depth', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'waveform', label: 'Wave (0=sine)', min: 0, max: 3, default: 0, step: 1 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }

    destroy() { this.carrier.stop(); super.destroy(); }
}


/**
 * Comb Filter
 * Creates resonant, metallic timbres with adjustable feedback
 */
class CombFilter extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'comb';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        this.delay = this.audioContext.createDelay(0.1);
        this.feedbackGain = this.audioContext.createGain();
        this.filter = this.audioContext.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 8000;
        this.filter.Q.value = 0.5;
        
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = { frequency: 500, feedback: 0.8, tone: 0.7, resonance: 0.5, mix: 0.5 };
        
        this.buildRouting();
        this.updateParams();
    }

    buildRouting() {
        this.input.connect(this.delay);
        this.delay.connect(this.filter);
        this.filter.connect(this.feedbackGain);
        this.feedbackGain.connect(this.delay);
        this.filter.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        const delayTime = 1 / this.params.frequency;
        this.delay.delayTime.setTargetAtTime(delayTime, now, 0.01);
        this.feedbackGain.gain.setTargetAtTime(this.params.feedback, now, 0.01);
        const filterFreq = 200 + this.params.tone * 9800;
        this.filter.frequency.setTargetAtTime(filterFreq, now, 0.01);
        this.filter.Q.setTargetAtTime(0.5 + this.params.resonance * 9.5, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setFrequency(f) { this.params.frequency = f; this.updateParams(); }
    setFeedback(fb) { this.params.feedback = fb; this.updateParams(); }
    setTone(t) { this.params.tone = t; this.updateParams(); }

    setMix(m) { this.params.mix = m; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'frequency', label: 'Freq (Hz)', min: 50, max: 5000, default: 500, step: 10 },
            { name: 'feedback', label: 'Feedback', min: -0.95, max: 0.95, default: 0.8, step: 0.01 },
            { name: 'tone', label: 'Tone', min: 0, max: 1, default: 0.7, step: 0.01 },
            { name: 'resonance', label: 'Resonance', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }
}
// ============================================================================

/**
 * Three Band EQ
 * Parametric equalizer with low, mid, high bands
 */
class ThreeBandEQ extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'eq';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        this.lowFilter = this.audioContext.createBiquadFilter();
        this.lowFilter.type = 'lowshelf';
        this.lowFilter.frequency.value = 100;
        this.lowFilter.gain.value = 0;
        
        this.midFilter = this.audioContext.createBiquadFilter();
        this.midFilter.type = 'peaking';
        this.midFilter.frequency.value = 1000;
        this.midFilter.Q.value = 1;
        this.midFilter.gain.value = 0;
        
        this.highFilter = this.audioContext.createBiquadFilter();
        this.highFilter.type = 'highshelf';
        this.highFilter.frequency.value = 8000;
        this.highFilter.gain.value = 0;
        
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = { lowGain: 0, midGain: 0, midQ: 1, highGain: 0, mix: 1.0 };
        
        this.input.connect(this.lowFilter);
        this.lowFilter.connect(this.midFilter);
        this.midFilter.connect(this.highFilter);
        this.highFilter.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        this.updateParams();
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.lowFilter.gain.setTargetAtTime(this.params.lowGain, now, 0.01);
        this.midFilter.gain.setTargetAtTime(this.params.midGain, now, 0.01);
        this.highFilter.gain.setTargetAtTime(this.params.highGain, now, 0.01);
        this.midFilter.Q.setTargetAtTime(this.params.midQ, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setLowGain(db) { this.params.lowGain = db; this.updateParams(); }
    setMidGain(db) { this.params.midGain = db; this.updateParams(); }
    setMidQ(q) { this.params.midQ = q; this.updateParams(); }
    setHighGain(db) { this.params.highGain = db; this.updateParams(); }
    setMix(mix) { this.params.mix = mix; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'lowGain', label: 'Low Gain (dB)', min: -15, max: 15, default: 0, step: 0.5 },
            { name: 'midGain', label: 'Mid Gain (dB)', min: -15, max: 15, default: 0, step: 0.5 },
            { name: 'midQ', label: 'Mid Q', min: 0.5, max: 5, default: 1, step: 0.1 },
            { name: 'highGain', label: 'High Gain (dB)', min: -15, max: 15, default: 0, step: 0.5 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 1, step: 0.01 }
        ];
    }
}


/**
 * Stereo Widener
 * Mid/Side processing for stereo width control
 */
class StereoWidener extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'widener';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        this.splitter = this.audioContext.createChannelSplitter(2);
        this.merger = this.audioContext.createChannelMerger(2);
        
        this.leftGain = this.audioContext.createGain();
        this.rightGain = this.audioContext.createGain();
        this.midGain = this.audioContext.createGain();
        this.sideGain = this.audioContext.createGain();
        this.widthGain = this.audioContext.createGain();
        
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = { width: 1, monoLow: 0, mix: 1 };
        
        this.buildRouting();
        this.updateParams();
    }

    buildRouting() {
        this.input.connect(this.splitter);
        
        this.splitter.connect(this.leftGain, 0);
        this.splitter.connect(this.rightGain, 1);
        
        this.leftGain.gain.value = 0.5;
        this.rightGain.gain.value = 0.5;
        
        this.leftGain.connect(this.midGain);
        this.rightGain.connect(this.midGain);
        
        this.leftGain.connect(this.sideGain);
        this.rightGain.connect(this.sideGain);
        this.rightGain.gain.value = -0.5;
        
        this.sideGain.connect(this.widthGain);
        
        this.midGain.connect(this.merger, 0, 0);
        this.widthGain.connect(this.merger, 0, 0);
        this.midGain.connect(this.merger, 0, 1);
        this.widthGain.connect(this.merger, 0, 1);
        
        this.merger.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.widthGain.gain.setTargetAtTime(this.params.width, now, 0.01);
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setWidth(w) { this.params.width = w; this.updateParams(); }
    setMonoLow(m) { this.params.monoLow = m; this.updateParams(); }
    setMix(m) { this.params.mix = m; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'width', label: 'Width', min: 0, max: 2, default: 1, step: 0.01 },
            { name: 'monoLow', label: 'Mono Low', min: 0, max: 1, default: 0, step: 1 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 1, step: 0.01 }
        ];
    }
}


/**
 * Wave Folder
 * West-coast synthesis wave folding using multi-stage waveshaping
 */
class WaveFolder extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'wavefolder';
        
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        this.preGain = this.audioContext.createGain();
        this.postFilter = this.audioContext.createBiquadFilter();
        this.postFilter.type = 'lowpass';
        
        this.folders = [];
        this.stageGains = [];
        
        for (let i = 0; i < 5; i++) {
            const folder = this.audioContext.createWaveShaper();
            const gain = this.audioContext.createGain();
            this.folders.push(folder);
            this.stageGains.push(gain);
        }
        
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        this.params = { drive: 3, threshold: 0.25, stages: 3, tone: 0.5, mix: 0.5 };
        
        this.buildRouting();
        this.makeFoldingCurves();
        this.updateParams();
    }

    makeFoldingCurves() {
        for (let stage = 0; stage < 5; stage++) {
            const samples = 44100;
            const curve = new Float32Array(samples);
            const threshold = this.params.threshold;
            const iterations = stage + 1;
            
            for (let i = 0; i < samples; i++) {
                let x = (i * 2) / samples - 1;
                x = x * (1 + this.params.drive / 3);
                
                for (let iter = 0; iter < iterations; iter++) {
                    while (Math.abs(x) > threshold) {
                        if (x > threshold) x = 2 * threshold - x;
                        if (x < -threshold) x = -2 * threshold - x;
                    }
                }
                curve[i] = x;
            }
            this.folders[stage].curve = curve;
            this.folders[stage].oversample = '4x';
        }
    }

    buildRouting() {
        this.input.connect(this.preGain);
        
        let current = this.preGain;
        for (let i = 0; i < 5; i++) {
            current.connect(this.folders[i]);
            this.folders[i].connect(this.stageGains[i]);
            current = this.stageGains[i];
        }
        
        current.connect(this.postFilter);
        this.postFilter.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        this.preGain.gain.setTargetAtTime(this.params.drive, now, 0.01);
        
        for (let i = 0; i < 5; i++) {
            const gain = i < this.params.stages ? 1 : 0;
            this.stageGains[i].gain.setTargetAtTime(gain, now, 0.01);
        }
        
        const freq = 200 + this.params.tone * 9800;
        this.postFilter.frequency.setTargetAtTime(freq, now, 0.01);
        
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
        
        this.makeFoldingCurves();
    }

    setDrive(d) { this.params.drive = d; this.updateParams(); }
    setThreshold(t) { this.params.threshold = t; this.updateParams(); }
    setStages(s) { this.params.stages = s; this.updateParams(); }
    setTone(t) { this.params.tone = t; this.updateParams(); }
    setMix(m) { this.params.mix = m; this.updateParams(); }

    getParamDefinitions() {
        return [
            { name: 'drive', label: 'Drive', min: 1, max: 10, default: 3, step: 0.1 },
            { name: 'threshold', label: 'Threshold', min: 0.1, max: 0.5, default: 0.25, step: 0.01 },
            { name: 'stages', label: 'Stages', min: 1, max: 5, default: 3, step: 1 },
            { name: 'tone', label: 'Tone', min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.01 }
        ];
    }

    destroy() {
        for (let i = 0; i < 5; i++) {
            if (this.stageGains[i]) this.stageGains[i].disconnect();
            if (this.folders[i]) this.folders[i].disconnect();
        }
        super.destroy();
    }
}


// ============================================================================
// Effect Factory
// ============================================================================

const EffectFactory = {
    create(type, audioContext) {
        switch (type) {
            case 'ringmod':
                return new RingModulator(audioContext);
            case 'flanger':
                return new Flanger(audioContext);
            case 'delay':
                return new TapeDelay(audioContext);
            case 'reverb':
                return new Reverb(audioContext);
            case 'chorus':
                return new Chorus(audioContext);
            case 'distortion':
                return new Distortion(audioContext);
            case 'bitcrusher':
                return new BitCrusher(audioContext);
            case 'compressor':
                return new CompressorLimiter(audioContext);
            case 'tremolo':
                return new Tremolo(audioContext);
            case 'prefet':
                return new PreFET(audioContext);
            case 'pror':
                return new ProR(audioContext);
            case 'phaser':
                return new Phaser(audioContext);
            case 'pingpong':
                return new PingPongDelay(audioContext);
            case 'am':
                return new AmplitudeModulation(audioContext);
            case 'comb':
                return new CombFilter(audioContext);
            case 'eq':
                return new ThreeBandEQ(audioContext);
            case 'widener':
                return new StereoWidener(audioContext);
            case 'wavefolder':
                return new WaveFolder(audioContext);
            case 'pitch':
                return new PitchShifter(audioContext);
            case 'gate':
                return new GateExpander(audioContext);
            case 'pan360':
                return new Pan360(audioContext);
            case 'none':
            default:
                return null;
        }
    },

    getEffectTypes() {
        return [
            { id: 'none', name: '-- No Effect --' },
            { id: 'compressor', name: '🎚️ Compressor/Limiter' },
            { id: 'tremolo', name: '🎸 Tremolo' },
            { id: 'prefet', name: '🔥 PreFET Preamp' },
            { id: 'ringmod', name: 'Ring Modulator' },
            { id: 'flanger', name: 'Flanger' },
            { id: 'phaser', name: '🌀 Phaser' },
            { id: 'chorus', name: 'Chorus' },
            { id: 'delay', name: 'Tape Delay' },
            { id: 'pingpong', name: '🏓 Ping Pong' },
            { id: 'reverb', name: 'Reverb' },
            { id: 'pror', name: '🏛️ Pro-R Reverb' },
            { id: 'distortion', name: 'Distortion' },
            { id: 'bitcrusher', name: 'Bit Crusher' },
            { id: 'am', name: '📻 AM Mod' },
            { id: 'comb', name: '🔧 Comb Filter' },
            { id: 'eq', name: '🎛️ 3-Band EQ' },
            { id: 'widener', name: '↔️ Widener' },
            { id: 'wavefolder', name: '〰️ Wave Folder' },
            { id: 'pitch', name: '🔼 Pitch Shifter' },
            { id: 'gate', name: '🚪 Gate/Expander' },
            { id: 'pan360', name: '🔄 360 Pan' }
        ];
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        Effect, 
        RingModulator, 
        Flanger, 
        TapeDelay, 
        Reverb,
        Chorus,
        Distortion,
        BitCrusher,
        CompressorLimiter,
        Tremolo,
        PreFET,
        ProR,
        Phaser,
        PingPongDelay,
        AmplitudeModulation,
        CombFilter,
        ThreeBandEQ,
        StereoWidener,
        WaveFolder,
        PitchShifter,
        GateExpander,
        Pan360,
        EffectFactory 
    };
}

/**
 * Pitch Shifter Effect
 * Delay-based pitch shifting using modulated delay lines with crossfading
 * 
 * Implementation:
 * - Two parallel delay lines (0.02-0.1s range)
 * - LFOs modulate delay times in opposite directions
 * - Crossfade between delays to avoid glitches
 * - Pitch shift range: -12 to +12 semitones
 * 
 * Key concept: When delay time increases, pitch drops. When delay time decreases, pitch rises.
 * - For +semitones: sweep delay time down
 * - For -semitones: sweep delay time up
 */

class PitchShifter extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'pitchshifter';

        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();

        // Two parallel delay lines for crossfading
        this.delayA = this.audioContext.createDelay(0.5);
        this.delayB = this.audioContext.createDelay(0.5);

        // LFOs for modulating delay times (sawtooth for linear ramp)
        this.lfoA = this.audioContext.createOscillator();
        this.lfoB = this.audioContext.createOscillator();
        this.lfoGainA = this.audioContext.createGain();
        this.lfoGainB = this.audioContext.createGain();

        // Add constant offset to LFO for delay time base value
        this.delayOffsetA = this.audioContext.createConstantSource();
        this.delayOffsetB = this.audioContext.createConstantSource();

        // Mixers for delay time control
        this.delayTimeMixerA = this.audioContext.createGain();
        this.delayTimeMixerB = this.audioContext.createGain();

        // Crossfade gains
        this.crossfadeA = this.audioContext.createGain();
        this.crossfadeB = this.audioContext.createGain();

        // Feedback paths
        this.feedbackA = this.audioContext.createGain();
        this.feedbackB = this.audioContext.createGain();

        // Wet/dry mix
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        this.wetInput = this.audioContext.createGain();

        // Parameters
        this.params = {
            semitones: 0,       // -12 to +12 semitones
            wetLevel: 0.5,      // Blend of shifted signal (0-1)
            feedback: 0,        // Feedback for resonant effect (0-0.5)
            mix: 0.5            // Overall wet/dry mix (0-1)
        };

        // Constants for pitch shifting calculation
        this.baseDelayTime = 0.05;  // 50ms base delay
        this.maxDelayTime = 0.1;    // 100ms max delay
        this.minDelayTime = 0.02;   // 20ms min delay

        this.buildRouting();
        this.startLFOs();
        this.updateParams();
    }

    buildRouting() {
        // Input routing
        this.input.connect(this.wetInput);
        this.input.connect(this.dryGain);

        // Wet signal path to both delays
        this.wetInput.connect(this.delayA);
        this.wetInput.connect(this.delayB);

        // Delay A routing with feedback
        this.delayA.connect(this.feedbackA);
        this.feedbackA.connect(this.delayA);
        this.delayA.connect(this.crossfadeA);

        // Delay B routing with feedback
        this.delayB.connect(this.feedbackB);
        this.feedbackB.connect(this.delayB);
        this.delayB.connect(this.crossfadeB);

        // Crossfaded delays to wet gain
        this.crossfadeA.connect(this.wetGain);
        this.crossfadeB.connect(this.wetGain);

        // Wet and dry to output
        this.wetGain.connect(this.output);
        this.dryGain.connect(this.output);

        // LFO routing for delay time modulation
        // LFO A: rising sawtooth (decreasing delay time = pitch up)
        this.lfoA.connect(this.lfoGainA);
        this.lfoGainA.connect(this.delayTimeMixerA);
        this.delayOffsetA.connect(this.delayTimeMixerA);
        this.delayTimeMixerA.connect(this.delayA.delayTime);

        // LFO B: falling sawtooth (opposite phase)
        this.lfoB.connect(this.lfoGainB);
        this.lfoGainB.connect(this.delayTimeMixerB);
        this.delayOffsetB.connect(this.delayTimeMixerB);
        this.delayTimeMixerB.connect(this.delayB.delayTime);

        // Set initial delay times
        this.delayA.delayTime.value = this.baseDelayTime;
        this.delayB.delayTime.value = this.baseDelayTime;
    }

    startLFOs() {
        // LFOs use sawtooth waves for linear delay time ramps
        // This creates consistent pitch shifting

        // LFO A: rising sawtooth (0 to 1, then resets)
        // When connected properly with offset, creates decreasing delay time
        this.lfoA.type = 'sawtooth';
        this.lfoA.frequency.value = 1;
        this.lfoA.start();

        // LFO B: falling sawtooth (1 to 0, then resets) - opposite phase
        // Created by inverting the rising sawtooth
        this.lfoB.type = 'sawtooth';
        this.lfoB.frequency.value = 1;
        // Phase offset of 0.5 (180 degrees) for opposite movement
        this.lfoB.start();

        // Start constant offset sources
        this.delayOffsetA.start();
        this.delayOffsetB.start();
    }

    /**
     * Calculate LFO frequency and gains based on semitone shift
     * 
     * The rate of delay change determines the pitch shift:
     * - Decreasing delay time = pitch up (positive semitones)
     * - Increasing delay time = pitch down (negative semitones)
     * 
     * Formula: rate = (semitones / 12) * (baseDelay / sweepRange)
     * Simplified for our parameters
     */
    calculateLFOParams(semitones) {
        if (Math.abs(semitones) < 0.1) {
            // Near-zero pitch shift: disable modulation
            return {
                frequency: 0,
                lfoGain: 0,
                offset: this.baseDelayTime,
                crossfadePhase: 0
            };
        }

        // Calculate LFO frequency based on semitone shift
        // Higher semitone shifts need faster modulation
        // The formula approximates: f_lfo = f_audio * (2^(semitones/12) - 1)
        // But normalized for our delay range
        const absSemitones = Math.abs(semitones);
        const pitchRatio = Math.pow(2, absSemitones / 12);
        const sweepRange = this.maxDelayTime - this.minDelayTime;

        // LFO frequency calculation
        // We want the delay to sweep through its range at a rate that creates
        // the desired pitch shift
        const lfoFreq = (pitchRatio - 1) * 2; // Approximation for usable range
        const clampedFreq = Math.max(0.1, Math.min(10, lfoFreq));

        // LFO gain (how much the delay time varies)
        // This determines the amount of pitch shifting
        const lfoGain = sweepRange * 0.5 * (absSemitones / 12);

        // Base offset for delay time
        const offset = this.baseDelayTime;

        return {
            frequency: clampedFreq,
            lfoGain: lfoGain,
            offset: offset,
            crossfadePhase: semitones > 0 ? 0 : Math.PI
        };
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        const semitones = this.params.semitones;

        // Calculate LFO parameters
        const lfoParams = this.calculateLFOParams(semitones);

        // Update LFO frequencies
        this.lfoA.frequency.setTargetAtTime(lfoParams.frequency, now, 0.01);
        this.lfoB.frequency.setTargetAtTime(lfoParams.frequency, now, 0.01);

        // Update LFO gains (modulation depth)
        // For positive semitones: LFO A has positive gain, LFO B has negative gain
        // For negative semitones: LFO A has negative gain, LFO B has positive gain
        const modGain = lfoParams.lfoGain * (semitones >= 0 ? 1 : -1);
        this.lfoGainA.gain.setTargetAtTime(modGain, now, 0.01);
        this.lfoGainB.gain.setTargetAtTime(-modGain, now, 0.01);

        // Update delay offsets
        this.delayOffsetA.offset.setTargetAtTime(lfoParams.offset, now, 0.01);
        this.delayOffsetB.offset.setTargetAtTime(lfoParams.offset, now, 0.01);

        // Update crossfade gains based on LFO phase
        // When one delay is at its extremes, fade it out and fade the other in
        // This prevents the "click" when the delay time resets
        const wetLevel = this.params.wetLevel;
        
        // Simple crossfade: each delay contributes 50% when both are active
        // In a more sophisticated implementation, we'd sync to LFO phase
        this.crossfadeA.gain.setTargetAtTime(wetLevel * 0.7, now, 0.01);
        this.crossfadeB.gain.setTargetAtTime(wetLevel * 0.7, now, 0.01);

        // Update feedback
        this.feedbackA.gain.setTargetAtTime(this.params.feedback, now, 0.01);
        this.feedbackB.gain.setTargetAtTime(this.params.feedback, now, 0.01);

        // Update wet/dry mix
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setSemitones(semitones) {
        // Clamp to valid range
        this.params.semitones = Math.max(-12, Math.min(12, semitones));
        this.updateParams();
    }

    setWetLevel(level) {
        this.params.wetLevel = Math.max(0, Math.min(1, level));
        this.updateParams();
    }

    setFeedback(feedback) {
        this.params.feedback = Math.max(0, Math.min(0.5, feedback));
        this.updateParams();
    }

    setMix(mix) {
        this.params.mix = Math.max(0, Math.min(1, mix));
        this.updateParams();
    }

    getParamDefinitions() {
        return [
            { 
                name: 'semitones', 
                label: 'Semitones', 
                min: -12, 
                max: 12, 
                default: 0, 
                step: 1 
            },
            { 
                name: 'wetLevel', 
                label: 'Wet Level', 
                min: 0, 
                max: 1, 
                default: 0.5, 
                step: 0.01 
            },
            { 
                name: 'feedback', 
                label: 'Feedback', 
                min: 0, 
                max: 0.5, 
                default: 0, 
                step: 0.01 
            },
            { 
                name: 'mix', 
                label: 'Mix', 
                min: 0, 
                max: 1, 
                default: 0.5, 
                step: 0.01 
            }
        ];
    }

    destroy() {
        this.lfoA.stop();
        this.lfoB.stop();
        this.delayOffsetA.stop();
        this.delayOffsetB.stop();
        super.destroy();
    }
}


/**
 * Gate/Expander Effect
 * Noise gate that cuts off sound when it falls below a threshold.
 * Expander mode reduces the volume of quieter sounds (opposite of compressor).
 * 
 * Implementation uses a custom envelope follower for smooth transitions:
 * 1. Analyze input level using an AnalyserNode
 * 2. When level < threshold: close gate (reduce gain by ratio amount)
 * 3. When level > threshold: open gate (restore gain)
 * 4. Attack: time to open when signal exceeds threshold
 * 5. Release: time to close when signal drops below threshold
 * 6. Hold: minimum time gate stays open after signal drops
 */

class GateExpander extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = 'gate';

        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();

        // Sidechain input for level detection
        this.detectorInput = this.audioContext.createGain();
        
        // Analyser for level detection
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.1;
        
        // Gate gain control
        this.gateGain = this.audioContext.createGain();
        this.gateGain.gain.value = 1.0;
        
        // Wet/dry mix
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        
        // Parameters
        this.params = {
            threshold: -40,     // dB, level where gate opens (-60 to 0)
            attack: 0.01,       // seconds, time to open (0.0001 to 0.1)
            hold: 0.1,          // seconds, minimum open time (0.01 to 1)
            release: 0.1,       // seconds, time to close (0.01 to 1)
            ratio: 4,           // expansion ratio 1:1 to 1:10 (higher = more reduction)
            hysteresis: 2,      // dB, difference between open and close thresholds
            mix: 1.0            // wet/dry mix (0 to 1)
        };

        // Internal state
        this.isOpen = false;
        this.holdEndTime = 0;
        this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
        
        // Build routing
        this.buildRouting();
        
        // Start the envelope follower
        this.startEnvelopeFollower();
        
        this.updateParams();
    }

    buildRouting() {
        // Input splits to detector and signal path
        this.input.connect(this.detectorInput);
        this.input.connect(this.gateGain);
        
        // Detector path: input -> analyser
        this.detectorInput.connect(this.analyser);
        
        // Signal path: input -> gateGain -> wet/dry mix -> output
        this.gateGain.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        // Dry path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
    }

    /**
     * Convert dB to linear gain
     */
    dbToLinear(db) {
        return Math.pow(10, db / 20);
    }

    /**
     * Get current input level in dB
     */
    getInputLevel() {
        this.analyser.getFloatTimeDomainData(this.dataArray);
        
        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i] * this.dataArray[i];
        }
        const rms = Math.sqrt(sum / this.dataArray.length);
        
        // Convert to dB, with floor to prevent log(0)
        const db = 20 * Math.log10(Math.max(rms, 0.00001));
        return db;
    }

    /**
     * Start the envelope follower loop
     * Uses requestAnimationFrame for smooth gate operation
     */
    startEnvelopeFollower() {
        const processEnvelope = () => {
            if (this.destroyed) return;
            
            const now = this.audioContext.currentTime;
            const level = this.getInputLevel();
            
            // Calculate open and close thresholds with hysteresis
            const openThreshold = this.params.threshold;
            const closeThreshold = this.params.threshold - this.params.hysteresis;
            
            // Calculate target gain based on level and ratio
            // When gate is closed, gain is reduced by ratio amount
            // Ratio 4 means 1:4 expansion (signal below threshold is attenuated 4:1)
            const closedGain = 1 / this.params.ratio;
            
            let targetGain;
            
            if (this.isOpen) {
                // Gate is currently open
                if (level < closeThreshold) {
                    // Signal dropped below close threshold
                    if (now >= this.holdEndTime) {
                        // Hold time expired, start closing
                        this.isOpen = false;
                        targetGain = closedGain;
                    } else {
                        // Still in hold time, stay open
                        targetGain = 1.0;
                    }
                } else {
                    // Signal still above close threshold, stay open
                    targetGain = 1.0;
                    // Extend hold time while signal is strong
                    this.holdEndTime = now + this.params.hold;
                }
            } else {
                // Gate is currently closed
                if (level > openThreshold) {
                    // Signal exceeded open threshold
                    this.isOpen = true;
                    this.holdEndTime = now + this.params.hold;
                    targetGain = 1.0;
                } else {
                    // Signal still below threshold, stay closed
                    targetGain = closedGain;
                }
            }

            // Apply smooth transition using setTargetAtTime
            // Attack time for opening, release time for closing
            const timeConstant = this.isOpen ? this.params.attack : this.params.release;
            
            // Calculate actual target based on mix
            // When mix is 0, gate has no effect (gain = 1)
            // When mix is 1, full gate effect
            const mixedTarget = 1.0 - this.params.mix * (1.0 - targetGain);
            
            // Apply the gain change
            this.gateGain.gain.setTargetAtTime(mixedTarget, now, timeConstant / 3);
            
            // Schedule next frame
            requestAnimationFrame(processEnvelope);
        };
        
        // Start the loop
        requestAnimationFrame(processEnvelope);
    }

    updateParams() {
        const now = this.audioContext.currentTime;
        
        // Update wet/dry mix
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    // Parameter setters
    setThreshold(db) { 
        this.params.threshold = db; 
        // Don't call updateParams - threshold is handled in envelope follower
    }
    
    setAttack(ms) { 
        this.params.attack = ms / 1000; // Convert ms to seconds
    }
    
    setHold(ms) { 
        this.params.hold = ms / 1000; // Convert ms to seconds
    }
    
    setRelease(ms) { 
        this.params.release = ms / 1000; // Convert ms to seconds
    }
    
    setRatio(ratio) { 
        this.params.ratio = ratio; 
    }
    
    setHysteresis(db) { 
        this.params.hysteresis = db; 
    }
    
    setMix(mix) { 
        this.params.mix = mix; 
        this.updateParams(); 
    }

    getParamDefinitions() {
        return [
            { 
                name: 'threshold', 
                label: 'Threshold (dB)', 
                min: -60, 
                max: 0, 
                default: -40, 
                step: 1 
            },
            { 
                name: 'attack', 
                label: 'Attack (ms)', 
                min: 0.1, 
                max: 100, 
                default: 10, 
                step: 0.1 
            },
            { 
                name: 'hold', 
                label: 'Hold (ms)', 
                min: 10, 
                max: 1000, 
                default: 100, 
                step: 10 
            },
            { 
                name: 'release', 
                label: 'Release (ms)', 
                min: 10, 
                max: 1000, 
                default: 100, 
                step: 10 
            },
            { 
                name: 'ratio', 
                label: 'Ratio (1:x)', 
                min: 1, 
                max: 10, 
                default: 4, 
                step: 0.5 
            },
            { 
                name: 'hysteresis', 
                label: 'Hysteresis (dB)', 
                min: 0, 
                max: 12, 
                default: 2, 
                step: 0.5 
            },
            { 
                name: 'mix', 
                label: 'Mix', 
                min: 0, 
                max: 1, 
                default: 1, 
                step: 0.01 
            }
        ];
    }

    destroy() {
        this.destroyed = true;
        
        // Disconnect all nodes
        if (this.input) this.input.disconnect();
        if (this.detectorInput) this.detectorInput.disconnect();
        if (this.gateGain) this.gateGain.disconnect();
        if (this.analyser) this.analyser.disconnect();
        if (this.dryGain) this.dryGain.disconnect();
        if (this.wetGain) this.wetGain.disconnect();
        
        super.destroy();
    }
}
/**
 * 360 Pan (Surround Panner) Effect
 * Creates a rotating/positioning effect that moves the sound around the listener
 * in a full 360-degree circle. Uses StereoPannerNode with an LFO for continuous rotation.
 *
 * Parameters:
 * - rate: 0 to 10 Hz (default 0.5) - rotation speed
 * - width: 0 to 1 (default 1) - pan amount (1 = full 360, 0.5 = 180°, 0 = center)
 * - manual: -1 to 1 (default 0) - manual position override (when rate = 0)
 * - direction: 0 or 1 (default 0) - 0 = clockwise, 1 = counter-clockwise
 * - mix: 0 to 1 (default 1) - wet/dry mix
 *
 * Pan Mapping:
 * - 0° = Center (0)
 * - 90° = Full Right (1)
 * - 180° = Center (0) - back
 * - 270° = Full Left (-1)
 * - 360° = Back to Center
 *
 * Signal Flow:
 * Input -> StereoPanner -> Wet Gain -> Output
 *              ↓
 *            LFO (modulates pan position)
 */

class Pan360 extends Effect {
    constructor(audioContext) {
        super(audioContext);
        this.type = '360pan';

        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();

        // Core stereo panner
        this.panner = this.audioContext.createStereoPanner();

        // LFO for continuous rotation
        this.lfo = this.audioContext.createOscillator();
        this.lfoGain = this.audioContext.createGain();
        this.lfoOffset = this.audioContext.createConstantSource();

        // Manual position control (used when rate = 0)
        this.manualGain = this.audioContext.createGain();

        // Wet/dry mix
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();

        // Parameters
        this.params = {
            rate: 0.5,      // LFO rate in Hz (0-10)
            width: 1,       // Pan width (0-1, 1 = full 360°)
            manual: 0,      // Manual position override (-1 to 1)
            direction: 0,   // 0 = clockwise, 1 = counter-clockwise
            mix: 1          // Wet/dry mix (0-1)
        };

        // Build signal routing
        this.buildRouting();

        // Configure and start LFO
        this.lfo.type = 'sine';
        this.lfo.frequency.value = this.params.rate;
        this.lfo.start();

        // Start constant offset source
        this.lfoOffset.start();
        this.lfoOffset.offset.value = 0;

        this.updateParams();
    }

    buildRouting() {
        // Input splits to dry and wet paths
        this.input.connect(this.dryGain);
        this.input.connect(this.panner);

        // Wet path through panner
        this.panner.connect(this.wetGain);
        this.wetGain.connect(this.output);

        // Dry path
        this.dryGain.connect(this.output);

        // LFO controls the panner position
        // LFO -> lfoGain -> panner.pan (modulates around center)
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.panner.pan);

        // Manual position control
        this.manualGain.connect(this.panner.pan);
    }

    updateParams() {
        const now = this.audioContext.currentTime;

        // Update LFO rate
        this.lfo.frequency.setTargetAtTime(this.params.rate, now, 0.01);

        // Width controls the pan range
        // width 1: pan goes from -1 to +1 (full 360°)
        // width 0.5: pan goes from -0.5 to +0.5 (180°)
        // width 0: pan stays at center
        this.lfoGain.gain.setTargetAtTime(this.params.width, now, 0.01);

        // Manual position override
        // When rate is 0, manual controls the static position
        // When rate > 0, manual adds an offset to the LFO modulation
        this.manualGain.gain.setTargetAtTime(this.params.manual, now, 0.01);

        // Direction: clockwise vs counter-clockwise
        // Invert LFO gain for counter-clockwise rotation
        const directionMultiplier = this.params.direction === 1 ? -1 : 1;
        this.lfoGain.gain.setTargetAtTime(this.params.width * directionMultiplier, now, 0.01);

        // Mix
        this.wetGain.gain.setTargetAtTime(this.params.mix, now, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.params.mix, now, 0.01);
    }

    setRate(rate) {
        this.params.rate = Math.max(0, Math.min(10, rate));
        this.updateParams();
    }

    setWidth(width) {
        this.params.width = Math.max(0, Math.min(1, width));
        this.updateParams();
    }

    setManual(manual) {
        this.params.manual = Math.max(-1, Math.min(1, manual));
        this.updateParams();
    }

    setDirection(direction) {
        this.params.direction = direction === 1 ? 1 : 0;
        this.updateParams();
    }

    setMix(mix) {
        this.params.mix = Math.max(0, Math.min(1, mix));
        this.updateParams();
    }

    getParamDefinitions() {
        return [
            { name: 'rate', label: 'Rate (Hz)', min: 0, max: 10, default: 0.5, step: 0.1 },
            { name: 'width', label: 'Width', min: 0, max: 1, default: 1, step: 0.01 },
            { name: 'manual', label: 'Manual Pos', min: -1, max: 1, default: 0, step: 0.01 },
            { name: 'direction', label: 'Direction', min: 0, max: 1, default: 0, step: 1 },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 1, step: 0.01 }
        ];
    }

    destroy() {
        this.lfo.stop();
        this.lfoOffset.stop();
        super.destroy();
    }
}


// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Pan360 };
}
