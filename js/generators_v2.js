/**
 * Tone Generator Module
 * Handles oscillator creation and waveform generation
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
        this.wavetableCache = {};
    }

    createSquareWaveWithDuty(duty) {
        const cacheKey = 'square_' + duty;
        if (this.wavetableCache[cacheKey]) return this.wavetableCache[cacheKey];
        const harmonics = 64;
        const real = new Float32Array(harmonics);
        const imag = new Float32Array(harmonics);
        for (let i = 1; i < harmonics; i++) {
            imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
        }
        const wave = this.audioContext.createPeriodicWave(real, imag);
        this.wavetableCache[cacheKey] = wave;
        return wave;
    }

    createOscillator() {
        if (this.oscillator) { this.oscillator.stop(); this.oscillator.disconnect(); }
        this.oscillator = this.audioContext.createOscillator();
        this.oscillator.frequency.value = this.frequency;
        if (this.waveform === 'square') {
            this.oscillator.setPeriodicWave(this.createSquareWaveWithDuty(this.dutyCycle));
        } else {
            this.oscillator.type = this.waveform;
        }
        if (!this.gainNode) {
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.volume;
        }
        this.oscillator.connect(this.gainNode);
        this.oscillator.start();
        return this.gainNode;
    }

    start(destination) {
        if (this.isPlaying) return;
        const output = this.createOscillator();
        if (destination) output.connect(destination);
        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;
        if (this.gainNode) {
            const now = this.audioContext.currentTime;
            this.gainNode.gain.setTargetAtTime(0.001, now, 0.02);
            setTimeout(() => {
                if (this.oscillator) { try { this.oscillator.stop(); this.oscillator.disconnect(); } catch(e){} this.oscillator = null; }
            }, 50);
        }
        this.isPlaying = false;
    }

    setWaveform(type) { this.waveform = type; if (this.isPlaying) this.createOscillator(); }
    setFrequency(freq) { this.frequency = freq; if (this.oscillator) this.oscillator.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.01); }
    setVolume(vol) { this.volume = vol; if (this.gainNode) this.gainNode.gain.setTargetAtTime(vol, this.audioContext.currentTime, 0.01); }
    setDutyCycle(duty) { this.dutyCycle = duty; if (this.isPlaying && this.waveform === 'square') this.createOscillator(); }
    getOutput() { return this.gainNode; }
    getIsPlaying() { return this.isPlaying; }
    destroy() { this.stop(); if (this.gainNode) this.gainNode.disconnect(); }
}

class NoiseGenerator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.noiseNode = null;
        this.gainNode = null;
        this.filterNode = null;
        this.volume = 0.5;
        this.isPlaying = false;
        this.noiseType = 'white';
        this.filterFreq = 1000;
    }

    createNoiseBuffer() {
        const bufferSize = 2 * this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);
        if (this.noiseType === 'white') {
            for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
        } else {
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5;
            }
        }
        return buffer;
    }

    start(destination) {
        if (this.isPlaying) return;
        this.noiseNode = this.audioContext.createBufferSource();
        this.noiseNode.buffer = this.createNoiseBuffer();
        this.noiseNode.loop = true;
        this.filterNode = this.audioContext.createBiquadFilter();
        this.filterNode.frequency.value = this.filterFreq;
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;
        this.noiseNode.connect(this.filterNode).connect(this.gainNode);
        if (destination) this.gainNode.connect(destination);
        this.noiseNode.start();
        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;
        if (this.noiseNode) { try { this.noiseNode.stop(); this.noiseNode.disconnect(); } catch(e){} }
        this.isPlaying = false;
    }

    setNoiseType(t) { this.noiseType = t; if (this.isPlaying) { this.stop(); this.start(); } }
    setFilterFreq(f) { 
        this.filterFreq = f; 
        if (this.filterNode) {
            const now = this.audioContext.currentTime;
            this.filterNode.frequency.cancelScheduledValues(now);
            this.filterNode.frequency.setTargetAtTime(f, now, 0.01); 
        }
    }
    setVolume(v) { this.volume = v; if (this.gainNode) this.gainNode.gain.setTargetAtTime(v, this.audioContext.currentTime, 0.01); }
    getOutput() { return this.gainNode; }
    getIsPlaying() { return this.isPlaying; }
    destroy() { this.stop(); }
}

class BinauralBeatsGenerator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.oscLeft = null; this.oscRight = null;
        this.outputGain = this.audioContext.createGain();
        this.isPlaying = false;
        this.volume = 0.5;
        this.baseFreq = 200;
        this.beatFreq = 10;
    }

    start(destination) {
        if (this.isPlaying) return;
        const merger = this.audioContext.createChannelMerger(2);
        this.oscLeft = this.audioContext.createOscillator();
        this.oscRight = this.audioContext.createOscillator();
        this.oscLeft.frequency.value = this.baseFreq - (this.beatFreq/2);
        this.oscRight.frequency.value = this.baseFreq + (this.beatFreq/2);
        this.oscLeft.connect(merger, 0, 0);
        this.oscRight.connect(merger, 0, 1);
        merger.connect(this.outputGain);
        if (destination) this.outputGain.connect(destination);
        this.oscLeft.start(); this.oscRight.start();
        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;
        [this.oscLeft, this.oscRight].forEach(o => { if (o) { try { o.stop(); o.disconnect(); } catch(e){} } });
        this.isPlaying = false;
    }

    setBaseFrequency(f) { this.baseFreq = f; this.update(); }
    setBeatFrequency(f) { this.beatFreq = f; this.update(); }
    update() {
        if (!this.isPlaying) return;
        const now = this.audioContext.currentTime;
        // Ensure frequencies stay positive and within safe limits
        const leftFreq = Math.max(1, this.baseFreq - (this.beatFreq/2));
        const rightFreq = Math.max(1, this.baseFreq + (this.beatFreq/2));
        
        this.oscLeft.frequency.cancelScheduledValues(now);
        this.oscRight.frequency.cancelScheduledValues(now);
        this.oscLeft.frequency.setTargetAtTime(leftFreq, now, 0.01);
        this.oscRight.frequency.setTargetAtTime(rightFreq, now, 0.01);
    }
    setVolume(v) { this.volume = v; this.outputGain.gain.setTargetAtTime(v, this.audioContext.currentTime, 0.01); }
    getOutput() { return this.outputGain; }
    getIsPlaying() { return this.isPlaying; }
    destroy() { this.stop(); }
}

class FMSynthesizer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.carrier = null; this.modulator = null;
        this.modIndex = this.audioContext.createGain();
        this.outputGain = this.audioContext.createGain();
        this.isPlaying = false;
        this.volume = 0.5;
        this.carrierFreq = 440;
        this.modulatorFreq = 110;
        this.modulationDepth = 100;
    }

    start(destination) {
        if (this.isPlaying) return;
        this.carrier = this.audioContext.createOscillator();
        this.modulator = this.audioContext.createOscillator();
        this.carrier.frequency.value = this.carrierFreq;
        this.modulator.frequency.value = this.modulatorFreq;
        this.modIndex.gain.value = this.modulationDepth;
        this.modulator.connect(this.modIndex).connect(this.carrier.frequency);
        this.carrier.connect(this.outputGain);
        if (destination) this.outputGain.connect(destination);
        this.carrier.start(); this.modulator.start();
        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;
        [this.carrier, this.modulator].forEach(o => { if (o) { try { o.stop(); o.disconnect(); } catch(e){} } });
        this.isPlaying = false;
    }

    setCarrierFreq(f) { this.carrierFreq = f; if (this.carrier) this.carrier.frequency.setTargetAtTime(f, this.audioContext.currentTime, 0.01); }
    setModulatorFreq(f) { this.modulatorFreq = f; if (this.modulator) this.modulator.frequency.setTargetAtTime(f, this.audioContext.currentTime, 0.01); }
    setModulationIndex(i) { this.modulationDepth = i; this.modIndex.gain.setTargetAtTime(i, this.audioContext.currentTime, 0.01); }
    setVolume(v) { this.volume = v; this.outputGain.gain.setTargetAtTime(v, this.audioContext.currentTime, 0.01); }
    getOutput() { return this.outputGain; }
    getIsPlaying() { return this.isPlaying; }
    destroy() { this.stop(); }
}

class GranularSynthesizer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.worklet = null;
        this.sourceOsc = this.audioContext.createOscillator();
        this.outputGain = this.audioContext.createGain();
        this.isPlaying = false;
        this.volume = 0.5;
        this.density = 20;
        this.grainSize = 0.05;
        this.baseFreq = 440;
        this.waveform = 'sine';
    }

    async start(destination) {
        if (this.isPlaying) return;
        if (window.synth && !window.synth.workletsLoaded) {
            console.error('Worklet not loaded');
            return;
        }
        try {
            this.worklet = new AudioWorkletNode(this.audioContext, 'grain-player');
            this.sourceOsc = this.audioContext.createOscillator();
            this.sourceOsc.type = this.waveform;
            this.sourceOsc.frequency.value = this.baseFreq;
            this.sourceOsc.connect(this.worklet).connect(this.outputGain);
            if (destination) this.outputGain.connect(destination);
            this.sourceOsc.start();
            this.isPlaying = true;
            this.updateParams();
        } catch (e) { console.error(e); }
    }

    stop() {
        if (!this.isPlaying) return;
        if (this.sourceOsc) { try { this.sourceOsc.stop(); this.sourceOsc.disconnect(); } catch(e){} }
        if (this.worklet) this.worklet.disconnect();
        this.isPlaying = false;
    }

    updateParams() {
        if (!this.worklet) return;
        const now = this.audioContext.currentTime;
        let overlap = 1 - (1 / (this.density * this.grainSize));
        overlap = Math.max(0.1, Math.min(0.9, overlap));
        this.worklet.parameters.get('grainSize').setTargetAtTime(this.grainSize, now, 0.01);
        this.worklet.parameters.get('overlap').setTargetAtTime(overlap, now, 0.01);
        if (this.sourceOsc) { this.sourceOsc.frequency.setTargetAtTime(this.baseFreq, now, 0.01); this.sourceOsc.type = this.waveform; }
        this.outputGain.gain.setTargetAtTime(this.volume, now, 0.01);
    }

    setBaseFreq(f) { this.baseFreq = f; this.updateParams(); }
    setWaveform(t) { this.waveform = t; this.updateParams(); }
    setVolume(v) { this.volume = v; this.updateParams(); }
    setDensity(v) { this.density = v; this.updateParams(); }
    setGrainSize(v) { this.grainSize = v / 1000; this.updateParams(); }
    setSpray(v) {} 
    setPitchVariation(v) {}
    setStereoSpread(v) {}
    getOutput() { return this.outputGain; }
    getIsPlaying() { return this.isPlaying; }
    destroy() { this.stop(); }
}

class InfrasoundGenerator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.worklet = null;
        this.outputGain = this.audioContext.createGain();
        this.isPlaying = false;
        this.frequency = 8;
        this.fineTune = 0;
        this.waveform = 'sine';
        this.dutyCycle = 0.5;
        this.volume = 0.7;
    }

    async start(destination) {
        if (this.isPlaying) return;
        if (window.synth && !window.synth.workletsLoaded) return;
        try {
            this.worklet = new AudioWorkletNode(this.audioContext, 'infrasound-processor');
            this.worklet.connect(this.outputGain);
            if (destination) this.outputGain.connect(destination);
            this.isPlaying = true;
            this.updateParams();
        } catch (e) { console.error(e); }
    }

    stop() {
        if (!this.isPlaying) return;
        if (this.worklet) { this.worklet.disconnect(); this.worklet = null; }
        this.isPlaying = false;
    }

    updateParams() {
        if (!this.worklet) return;
        const now = this.audioContext.currentTime;
        this.worklet.parameters.get('frequency').setTargetAtTime(this.frequency + this.fineTune, now, 0.01);
        this.worklet.parameters.get('dutyCycle').setTargetAtTime(this.dutyCycle, now, 0.01);
        this.worklet.port.postMessage({ type: 'setWaveform', waveform: this.waveform });
        this.outputGain.gain.setTargetAtTime(this.volume, now, 0.01);
    }

    setFrequency(f) { this.frequency = f; this.updateParams(); }
    setFineTune(f) { this.fineTune = f; this.updateParams(); }
    setWaveform(t) { this.waveform = t; this.updateParams(); }
    setDutyCycle(d) { this.dutyCycle = d; this.updateParams(); }
    setVolume(v) { this.volume = v; this.updateParams(); }
    getOutput() { return this.outputGain; }
    getIsPlaying() { return this.isPlaying; }
    destroy() { this.stop(); }
}

const GeneratorFactory = {
    create(type, audioContext) {
        switch (type) {
            case 'infrasound': return new InfrasoundGenerator(audioContext);
            case 'fm': return new FMSynthesizer(audioContext);
            case 'granular': return new GranularSynthesizer(audioContext);
            case 'binaural': return new BinauralBeatsGenerator(audioContext);
            case 'noise': return new NoiseGenerator(audioContext);
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
            { id: 'fm', name: '🎹 FM Synth', hasDuty: false },
            { id: 'granular', name: '☁️ Granular', hasDuty: false },
            { id: 'infrasound', name: '🔊 Infrasound', hasDuty: false }
        ];
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        ToneGenerator, NoiseGenerator, BinauralBeatsGenerator, 
        FMSynthesizer, GranularSynthesizer, InfrasoundGenerator, GeneratorFactory 
    };
}