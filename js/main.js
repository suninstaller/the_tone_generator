/**
 * Main Application Module
 * Initializes the synthesizer engine and connects all components
 */

class SynthEngine {
    constructor() {
        this.audioContext = null;
        this.isAudioStarted = false;
        
        // 4 generators (one per channel)
        this.generators = [];
        
        // Effect chains for each channel (3 effects per channel max)
        this.effectChains = [[], [], [], []];
        
        // Master output chain
        this.masterGain = null;
        this.analyser = null;
        this.compressor = null;
        
        // Channel settings
        this.channelSettings = [
            { enabled: true, volume: 0.5, waveform: 'sine' },
            { enabled: false, volume: 0.5, waveform: 'sawtooth' },
            { enabled: false, volume: 0.5, waveform: 'triangle' },
            { enabled: false, volume: 0.5, waveform: 'square' }
        ];
        
        // LFOs for modulation
        this.lfos = [];
        this.lfoTargets = new Map(); // Maps "channel-effectIndex-param" to LFO index
    }

    /**
     * Initialize the audio context and start audio
     */
    async start() {
        if (this.isAudioStarted) return;
        
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.setupMasterChain();
            
            // Create generators for each channel using factory
            for (let i = 0; i < 4; i++) {
                this.createChannel(i);
            }
            
            // Create 3 LFOs for modulation
            for (let i = 0; i < 3; i++) {
                this.lfos.push(new LFO(this.audioContext));
            }
            
            this.isAudioStarted = true;
            console.log('Audio engine started successfully');
            
        } catch (error) {
            console.error('Failed to start audio:', error);
            alert('Failed to start audio. Please check your browser supports Web Audio API.');
        }
    }

    /**
     * Stop audio and clean up
     */
    stop() {
        if (!this.isAudioStarted) return;
        
        this.generators.forEach(gen => {
            if (gen) gen.destroy();
        });
        this.generators = [];
        
        this.effectChains.forEach(chain => {
            chain.forEach(effect => {
                if (effect) effect.destroy();
            });
        });
        this.effectChains = [[], [], [], []];
        
        if (this.masterGain) {
            this.masterGain.disconnect();
            this.masterGain = null;
        }
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        if (this.compressor) {
            this.compressor.disconnect();
            this.compressor = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.isAudioStarted = false;
        console.log('Audio engine stopped');
    }

    /**
     * Set up the master output chain
     */
    setupMasterChain() {
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.7;
        
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;
        
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
    }

    /**
     * Create a channel with generator and effect chain
     */
    createChannel(index) {
        // Use the factory to create the appropriate generator type
        const waveform = this.channelSettings[index].waveform;
        const generator = GeneratorFactory.create(waveform, this.audioContext);
        this.generators[index] = generator;
        
        // Connect generator directly to master initially
        if (this.channelSettings[index].enabled) {
            generator.start(this.masterGain);
            generator.setVolume(this.channelSettings[index].volume);
        }
    }

    /**
     * Rebuild the effect chain for a channel
     */
    rebuildEffectChain(channelIndex) {
        const generator = this.generators[channelIndex];
        if (!generator) return;
        
        const outputNode = generator.getOutput();
        if (!outputNode) return;
        
        // Disconnect output from wherever it was connected
        try {
            outputNode.disconnect();
        } catch (e) {
            // Might not be connected, that's ok
        }
        
        const effects = this.effectChains[channelIndex].filter(e => e !== null);
        
        if (effects.length > 0) {
            // Connect generator -> first effect
            outputNode.connect(effects[0].getInput());
            
            // Chain effects together
            for (let i = 0; i < effects.length - 1; i++) {
                try {
                    effects[i].disconnect();
                } catch (e) {}
                effects[i].connect(effects[i + 1].getInput());
            }
            
            // Connect last effect -> master
            try {
                effects[effects.length - 1].disconnect();
            } catch (e) {}
            effects[effects.length - 1].connect(this.masterGain);
        } else {
            // No effects - connect directly to master
            outputNode.connect(this.masterGain);
        }
    }

    /**
     * Enable/disable a channel
     */
    setChannelEnabled(index, enabled) {
        this.channelSettings[index].enabled = enabled;
        
        const generator = this.generators[index];
        if (!generator) return;
        
        if (enabled) {
            if (!generator.getIsPlaying()) {
                generator.start(this.masterGain);
                this.rebuildEffectChain(index);
            }
        } else {
            generator.stop();
        }
    }

    /**
     * Set channel waveform - can change generator type!
     */
    setChannelWaveform(index, waveform) {
        const wasEnabled = this.channelSettings[index].enabled;
        const wasPlaying = this.generators[index] && this.generators[index].getIsPlaying();
        
        // Update settings
        this.channelSettings[index].waveform = waveform;
        
        // Destroy old generator
        if (this.generators[index]) {
            this.generators[index].destroy();
        }
        
        // Create new generator of the appropriate type
        const generator = GeneratorFactory.create(waveform, this.audioContext);
        this.generators[index] = generator;
        
        // Restore volume
        generator.setVolume(this.channelSettings[index].volume);
        
        // Rebuild effect chain
        this.rebuildEffectChain(index);
        
        // Restart if it was playing
        if (wasEnabled && wasPlaying) {
            generator.start(this.masterGain);
        }
    }

    /**
     * Set channel frequency (for oscillators)
     */
    setChannelFrequency(index, frequency) {
        const generator = this.generators[index];
        if (!generator) return;
        
        // Handle different generator types
        if (generator.setFrequency) {
            // Standard oscillators (sine, sawtooth, triangle, square)
            generator.setFrequency(frequency);
        } else if (generator.setBaseFrequency) {
            // Binaural beats - frequency slider controls carrier
            generator.setBaseFrequency(frequency);
        } else if (generator.setCarrierFreq) {
            // FM synthesizer - frequency slider controls carrier
            generator.setCarrierFreq(frequency);
        } else if (generator.setFilterFreq) {
            // Noise generator - frequency controls filter
            generator.setFilterFreq(frequency);
        } else if (generator.setBaseFreq) {
            // Granular synthesizer
            generator.setBaseFreq(frequency);
        }
    }

    /**
     * Set channel duty cycle (for square wave)
     */
    setChannelDuty(index, duty) {
        const generator = this.generators[index];
        if (!generator) return;
        
        if (generator.setDutyCycle) {
            generator.setDutyCycle(duty);
        }
    }

    /**
     * Set channel volume
     */
    setChannelVolume(index, volume) {
        this.channelSettings[index].volume = volume;
        
        const generator = this.generators[index];
        if (!generator) return;
        
        generator.setVolume(volume);
    }

    /**
     * Set noise-specific parameters
     */
    setChannelNoiseType(index, type) {
        const generator = this.generators[index];
        if (!generator || !generator.setNoiseType) return;
        generator.setNoiseType(type);
    }

    setChannelNoiseFilter(index, freq) {
        const generator = this.generators[index];
        if (!generator || !generator.setFilterFreq) return;
        generator.setFilterFreq(freq);
    }

    /**
     * Set binaural beats specific parameters
     */
    setChannelBinauralBaseFreq(index, freq) {
        const generator = this.generators[index];
        if (!generator || !generator.setBaseFrequency) return;
        generator.setBaseFrequency(freq);
    }

    setChannelBinauralBeatFreq(index, freq) {
        const generator = this.generators[index];
        if (!generator || !generator.setBeatFrequency) return;
        generator.setBeatFrequency(freq);
    }

    setChannelBinauralPreset(index, preset) {
        const generator = this.generators[index];
        if (!generator || !generator.setPreset) return;
        generator.setPreset(preset);
    }

    /**
     * Set FM synthesizer specific parameters
     */
    setChannelFMModulatorFreq(index, freq) {
        const generator = this.generators[index];
        if (!generator || !generator.setModulatorFreq) return;
        generator.setModulatorFreq(freq);
    }

    setChannelFMIndex(index, amount) {
        const generator = this.generators[index];
        if (!generator || !generator.setModulationIndex) return;
        generator.setModulationIndex(amount);
    }

    setChannelFMAlgorithm(index, alg) {
        const generator = this.generators[index];
        if (!generator || !generator.setAlgorithm) return;
        generator.setAlgorithm(alg);
    }

    /**
     * Set granular synthesizer parameters
     */
    /**
     * Set infrasound waveform type
     */
    setChannelInfrasoundWaveform(index, type) {
        const generator = this.generators[index];
        if (!generator || !generator.setWaveform) return;
        generator.setWaveform(type);
    }
    
    setChannelInfrasoundDuty(index, duty) {
        const generator = this.generators[index];
        if (!generator || !generator.setDutyCycle) return;
        generator.setDutyCycle(duty);
    }

    setChannelGranularParam(index, param, value) {
        const generator = this.generators[index];
        if (!generator) return;
        
        switch(param) {
            case 'density':
                if (generator.setDensity) generator.setDensity(value);
                break;
            case 'spray':
                if (generator.setSpray) generator.setSpray(value);
                break;
            case 'grainSize':
                if (generator.setGrainSize) generator.setGrainSize(value);
                break;
            case 'pitchVariation':
                if (generator.setPitchVariation) generator.setPitchVariation(value);
                break;
            case 'stereoSpread':
                if (generator.setStereoSpread) generator.setStereoSpread(value);
                break;
        }
    }

    /**
     * LFO Control Methods
     */
    setLFORate(lfoIndex, rate) {
        if (lfoIndex < 0 || lfoIndex >= this.lfos.length) return;
        this.lfos[lfoIndex].setRate(rate);
    }
    
    setLFODepth(lfoIndex, depth) {
        if (lfoIndex < 0 || lfoIndex >= this.lfos.length) return;
        this.lfos[lfoIndex].setDepth(depth);
    }
    
    setLFOWaveform(lfoIndex, waveform) {
        if (lfoIndex < 0 || lfoIndex >= this.lfos.length) return;
        this.lfos[lfoIndex].setWaveform(waveform);
    }
    
    /**
     * Assign LFO to effect parameter
     * @param {number} lfoIndex - Which LFO (0-2)
     * @param {number} channelIndex - Channel (0-3)
     * @param {number} effectIndex - Effect slot (0-2)
     * @param {string} paramName - Parameter name (e.g., 'spread', 'time', 'mix')
     * @param {number} min - Minimum value for modulation
     * @param {number} max - Maximum value for modulation
     * @param {boolean} bipolar - Whether LFO is bipolar (-1 to 1) or unipolar (0 to 1)
     */
    assignLFOToEffectParam(lfoIndex, channelIndex, effectIndex, paramName, min, max, bipolar = true) {
        if (lfoIndex < 0 || lfoIndex >= this.lfos.length) return false;
        
        const effect = this.effectChains[channelIndex][effectIndex];
        if (!effect) return false;
        
        const lfo = this.lfos[lfoIndex];
        const targetKey = `${channelIndex}-${effectIndex}-${paramName}`;
        
        // Check if parameter has a setter method
        const setterName = `set${paramName.charAt(0).toUpperCase()}${paramName.slice(1)}`;
        
        if (typeof effect[setterName] === 'function') {
            // Create a callback function that calls the setter
            const callback = (value) => {
                effect[setterName](value);
            };
            
            // Remove existing target for this param if any
            this.unassignLFOFromEffectParam(channelIndex, effectIndex, paramName);
            
            // Add new target
            lfo.addTarget(callback, min, max, bipolar);
            this.lfoTargets.set(targetKey, { lfoIndex, callback });
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Unassign LFO from effect parameter
     */
    unassignLFOFromEffectParam(channelIndex, effectIndex, paramName) {
        const targetKey = `${channelIndex}-${effectIndex}-${paramName}`;
        const existing = this.lfoTargets.get(targetKey);
        
        if (existing) {
            const lfo = this.lfos[existing.lfoIndex];
            lfo.removeTarget(existing.callback);
            this.lfoTargets.delete(targetKey);
        }
    }
    
    /**
     * Check if LFO is assigned to a parameter
     */
    isLFOAssigned(channelIndex, effectIndex, paramName) {
        const targetKey = `${channelIndex}-${effectIndex}-${paramName}`;
        return this.lfoTargets.has(targetKey);
    }
    
    /**
     * Get LFO assignment info for a parameter
     */
    getLFOAssignment(channelIndex, effectIndex, paramName) {
        const targetKey = `${channelIndex}-${effectIndex}-${paramName}`;
        return this.lfoTargets.get(targetKey);
    }

    /**
     * Set an effect for a channel
     */
    setChannelEffect(channelIndex, effectIndex, effectType) {
        // Clean up any LFO targets for this effect slot
        for (let [key, value] of this.lfoTargets) {
            if (key.startsWith(`${channelIndex}-${effectIndex}-`)) {
                const lfo = this.lfos[value.lfoIndex];
                lfo.removeTarget(value.callback);
                this.lfoTargets.delete(key);
            }
        }
        
        const existingEffect = this.effectChains[channelIndex][effectIndex];
        if (existingEffect) {
            existingEffect.destroy();
        }
        
        if (effectType !== 'none') {
            this.effectChains[channelIndex][effectIndex] = EffectFactory.create(
                effectType, 
                this.audioContext
            );
        } else {
            this.effectChains[channelIndex][effectIndex] = null;
        }
        
        this.rebuildEffectChain(channelIndex);
    }

    /**
     * Set a parameter on a channel's effect
     */
    setEffectParam(channelIndex, effectIndex, paramName, value) {
        const effect = this.effectChains[channelIndex][effectIndex];
        if (!effect) return;
        
        const setterName = `set${paramName.charAt(0).toUpperCase()}${paramName.slice(1)}`;
        if (typeof effect[setterName] === 'function') {
            effect[setterName](value);
        }
    }

    /**
     * Get an effect instance (for UI to query parameters)
     */
    getEffectInstance(effectType) {
        if (!this.audioContext) return null;
        return EffectFactory.create(effectType, this.audioContext);
    }

    /**
     * Set master volume
     */
    setMasterVolume(volume) {
        if (this.masterGain) {
            const now = this.audioContext.currentTime;
            this.masterGain.gain.setTargetAtTime(volume, now, 0.01);
        }
    }

    /**
     * Get analyser node for visualization
     */
    getAnalyser() {
        return this.analyser;
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const synth = new SynthEngine();
    const midi = new MIDIController(synth);
    const ui = new UIManager(synth);
    
    window.synth = synth;
    window.midi = midi;
    window.ui = ui;
    
    console.log('Tone Generator initialized');
});
