/**
 * Main Application Module - v1.0.1
 * Initializes the synthesizer engine and connects all components
 */

class SynthEngine {
    constructor() {
        this.audioContext = null;
        this.isAudioStarted = false;
        
        // 4 generators (one per channel)
        this.generators = [];
        
        // Persistent gain nodes for each channel to avoid clicks during routing
        this.channelGains = [];
        
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
        
        // Check for file:// protocol which blocks AudioWorklets
        if (window.location.protocol === 'file:') {
            alert('SECURITY RESTRICTION: This synthesizer uses high-performance AudioWorklets which are blocked when opening files directly. \n\nPlease run this project through a local web server (e.g., "python3 -m http.server" or "npx serve") to enable all features.');
        }

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Load AudioWorklets
            this.workletsLoaded = false;
            try {
                await this.audioContext.audioWorklet.addModule('js/worklets/grain-player.js');
                await this.audioContext.audioWorklet.addModule('js/worklets/infrasound-processor.js');
                this.workletsLoaded = true;
                console.log('AudioWorklets loaded');
            } catch (e) {
                console.error('Failed to load AudioWorklets:', e);
            }
            
            this.setupMasterChain();
            
            // Create channel gains and generators for each channel
            for (let i = 0; i < 4; i++) {
                const cg = this.audioContext.createGain();
                cg.gain.value = 1.0;
                this.channelGains[i] = cg;
                this.createChannel(i);
            }
            
            // Create 3 LFOs for modulation
            this.lfos = [];
            for (let i = 0; i < 3; i++) {
                const lfo = new LFO(this.audioContext);
                console.log(`Engine: LFO ${i} created. setRate code:`, lfo.setRate.toString());
                this.lfos.push(lfo);
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
        
        this.lfos.forEach(lfo => {
            if (lfo && lfo.destroy) lfo.destroy();
        });
        this.lfos = [];
        
        this.channelGains.forEach(cg => {
            if (cg) cg.disconnect();
        });
        this.channelGains = [];
        
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
        
        // Connect generator through its channel gain
        if (this.channelSettings[index].enabled) {
            generator.start(this.channelGains[index]);
            generator.setVolume(this.channelSettings[index].volume);
            this.rebuildEffectChain(index);
        }
    }

    /**
     * Rebuild the effect chain for a channel
     */
    rebuildEffectChain(channelIndex) {
        const channelGain = this.channelGains[channelIndex];
        if (!channelGain) return;
        
        // Track rebuilds to avoid race conditions during batch updates
        if (!this.pendingRebuilds) this.pendingRebuilds = new Map();
        
        const now = this.audioContext.currentTime;
        
        // Use a fast ramp to avoid clicks during reconnection
        channelGain.gain.setTargetAtTime(0, now, 0.005);
        
        // Cancel existing pending rebuild for this channel if any
        if (this.pendingRebuilds.has(channelIndex)) {
            clearTimeout(this.pendingRebuilds.get(channelIndex));
        }
        
        const timeoutId = setTimeout(() => {
            this.pendingRebuilds.delete(channelIndex);
            if (!this.audioContext || !this.isAudioStarted) return;
            
            // Disconnect channel gain from wherever it was connected
            try {
                channelGain.disconnect();
            } catch (e) {}
            
            const effects = this.effectChains[channelIndex].filter(e => e !== null);
            
            if (effects.length > 0) {
                // Connect channel gain -> first effect
                channelGain.connect(effects[0].getInput());
                
                // Chain effects together
                for (let i = 0; i < effects.length - 1; i++) {
                    try {
                        effects[i].disconnect();
                    } catch (e) {}
                    effects[i].connect(effects[i + 1].getInput());
                }
                
                // Connect last effect -> master
                const lastEffect = effects[effects.length - 1];
                try {
                    lastEffect.disconnect();
                } catch (e) {}
                lastEffect.connect(this.masterGain);
            } else {
                // No effects - connect directly to master
                channelGain.connect(this.masterGain);
            }
            
            // Ramp back up
            const now2 = this.audioContext.currentTime;
            channelGain.gain.cancelScheduledValues(now2);
            channelGain.gain.setTargetAtTime(1.0, now2, 0.01);
        }, 25); // Slightly longer than the ramp-down time (5 * 0.005 = 25ms)
        
        this.pendingRebuilds.set(channelIndex, timeoutId);
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
                generator.start(this.channelGains[index]);
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
        
        // Clean up channel LFO targets
        for (let [key, value] of this.lfoTargets) {
            if (key.startsWith(`chan-${index}-`)) {
                const lfo = this.lfos[value.lfoIndex];
                lfo.removeTarget(value.callback);
                this.lfoTargets.delete(key);
            }
        }
        
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
            generator.start(this.channelGains[index]);
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
        console.log(`Engine: Setting LFO ${lfoIndex} rate to ${rate}. Active LFOs: ${this.lfos.length}`);
        if (lfoIndex < 0 || lfoIndex >= this.lfos.length) {
            console.error(`Engine: LFO index ${lfoIndex} out of bounds!`);
            return;
        }
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
     * Assign LFO to channel (generator) parameter
     */
    assignLFOToChannelParam(lfoIndex, channelIndex, paramName, min, max, bipolar = true) {
        if (lfoIndex < 0 || lfoIndex >= this.lfos.length) return false;
        
        const generator = this.generators[channelIndex];
        if (!generator) return false;
        
        const lfo = this.lfos[lfoIndex];
        const targetKey = `chan-${channelIndex}-${paramName}`;
        
        // Check if parameter has a setter method
        const setterName = `set${paramName.charAt(0).toUpperCase()}${paramName.slice(1)}`;
        
        if (typeof generator[setterName] === 'function') {
            const callback = (value) => {
                generator[setterName](value);
            };
            
            this.unassignLFOFromChannelParam(channelIndex, paramName);
            lfo.addTarget(callback, min, max, bipolar);
            this.lfoTargets.set(targetKey, { lfoIndex, callback });
            return true;
        }
        return false;
    }
    
    unassignLFOFromChannelParam(channelIndex, paramName) {
        const targetKey = `chan-${channelIndex}-${paramName}`;
        const existing = this.lfoTargets.get(targetKey);
        
        if (existing) {
            const lfo = this.lfos[existing.lfoIndex];
            lfo.removeTarget(existing.callback);
            this.lfoTargets.delete(targetKey);
        }
    }
    
    isChannelLFOAssigned(channelIndex, paramName) {
        return this.lfoTargets.has(`chan-${channelIndex}-${paramName}`);
    }
    
    getChannelLFOAssignment(channelIndex, paramName) {
        return this.lfoTargets.get(`chan-${channelIndex}-${paramName}`);
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
     * Get the current state of the entire synthesizer as a serializable object
     * (A "patch")
     */
    getSerializedState() {
        const state = {
            channels: [],
            lfos: [],
            master: {
                volume: this.masterGain ? this.masterGain.gain.value : 0.7
            }
        };

        for (let i = 0; i < 4; i++) {
            const gen = this.generators[i];
            const ch = {
                enabled: this.channelSettings[i].enabled,
                volume: this.channelSettings[i].volume,
                waveform: this.channelSettings[i].waveform,
                frequency: gen && gen.frequency ? gen.frequency : 440,
                effects: []
            };

            // Handle special generator frequencies
            if (gen) {
                if (gen.baseFreq) ch.frequency = gen.baseFreq;
                if (gen.baseFrequency) ch.frequency = gen.baseFrequency;
                if (gen.carrierFreq) ch.frequency = gen.carrierFreq;
                if (gen.filterFreq) ch.frequency = gen.filterFreq;
                
                // Save custom generator params
                if (gen.dutyCycle !== undefined) ch.duty = gen.dutyCycle;
                if (gen.noiseType) ch.noiseType = gen.noiseType;
                if (gen.beatFreq) ch.beatFreq = gen.beatFreq;
                if (gen.modulatorFreq) ch.modulatorFreq = gen.modulatorFreq;
                if (gen.modulationDepth) ch.modIndex = gen.modulationDepth;
                if (gen.algorithm !== undefined) ch.fmAlgo = gen.algorithm;
                
                // Infrasound waveform
                if (this.channelSettings[i].waveform === 'infrasound' && gen.waveform) {
                    ch.infraWaveform = gen.waveform;
                }
                
                // Granular params
                if (gen.density) ch.density = gen.density;
                if (gen.spray) ch.spray = gen.spray;
                if (gen.grainSize) ch.grainSize = gen.grainSize;
            }

            // Save effect chain
            for (let j = 0; j < 3; j++) {
                const effect = this.effectChains[i][j];
                if (effect) {
                    ch.effects.push(effect.getState());
                } else {
                    ch.effects.push({ type: 'none' });
                }
            }

            state.channels.push(ch);
        }

        // Save LFOs
        this.lfos.forEach((lfo, idx) => {
            state.lfos.push({
                rate: lfo.rate,
                depth: lfo.depthValue,
                waveform: lfo.currentWaveform
            });
        });

        // Save LFO assignments
        state.lfoAssignments = [];
        for (let [key, value] of this.lfoTargets) {
            if (key.startsWith('chan-')) {
                const [_, chIdx, paramName] = key.split('-');
                state.lfoAssignments.push({
                    type: 'channel',
                    channel: parseInt(chIdx),
                    param: paramName,
                    lfo: value.lfoIndex
                });
            } else {
                const [chIdx, effIdx, paramName] = key.split('-');
                state.lfoAssignments.push({
                    type: 'effect',
                    channel: parseInt(chIdx),
                    effect: parseInt(effIdx),
                    param: paramName,
                    lfo: value.lfoIndex
                });
            }
        }

        return state;
    }

    /**
     * Load a previously serialized state
     */
    async loadSerializedState(state) {
        if (!state || !state.channels) return;

        // Restore master
        if (state.master && state.master.volume !== undefined) {
            this.setMasterVolume(state.master.volume);
        }

        // Restore LFOs basic settings
        if (state.lfos) {
            state.lfos.forEach((lfoCfg, i) => {
                if (this.lfos[i]) {
                    this.setLFORate(i, lfoCfg.rate);
                    this.setLFODepth(i, lfoCfg.depth);
                    this.setLFOWaveform(i, lfoCfg.waveform);
                }
            });
        }

        // Restore channels
        for (let i = 0; i < 4; i++) {
            const ch = state.channels[i];
            if (!ch) continue;

            // Set basic channel params
            this.channelSettings[i].enabled = ch.enabled;
            this.channelSettings[i].volume = ch.volume;
            this.channelSettings[i].waveform = ch.waveform;

            // Recreate generator
            this.setChannelWaveform(i, ch.waveform);
            this.setChannelVolume(i, ch.volume);
            this.setChannelFrequency(i, ch.frequency);
            
            const gen = this.generators[i];
            if (gen) {
                if (ch.duty !== undefined) this.setChannelDuty(i, ch.duty);
                if (ch.noiseType) this.setChannelNoiseType(i, ch.noiseType);
                if (ch.beatFreq) this.setChannelBinauralBeatFreq(i, ch.beatFreq);
                if (ch.modulatorFreq) this.setChannelFMModulatorFreq(i, ch.modulatorFreq);
                if (ch.modIndex) this.setChannelFMIndex(i, ch.modIndex);
                if (ch.fmAlgo !== undefined) this.setChannelFMAlgorithm(i, ch.fmAlgo);
                if (ch.infraWaveform) this.setChannelInfrasoundWaveform(i, ch.infraWaveform);
                if (ch.density) this.setChannelGranularParam(i, 'density', ch.density);
                if (ch.spray) this.setChannelGranularParam(i, 'spray', ch.spray);
                if (ch.grainSize) this.setChannelGranularParam(i, 'grainSize', ch.grainSize);
            }

            // Restore effects
            if (ch.effects) {
                ch.effects.forEach((eff, j) => {
                    this.setChannelEffect(i, j, eff.type);
                    if (eff.type !== 'none' && eff.params) {
                        for (let pName in eff.params) {
                            this.setEffectParam(i, j, pName, eff.params[pName]);
                        }
                    }
                });
            }

            this.setChannelEnabled(i, ch.enabled);
        }

        // Restore LFO assignments (must be done after effects/generators are created)
        if (state.lfoAssignments) {
            setTimeout(() => {
                state.lfoAssignments.forEach(asm => {
                    if (asm.type === 'channel') {
                        // We need the param range
                        // Frequency range depends on mode, but we can approximate or use defaults
                        let min = 20, max = 2000;
                        if (asm.param === 'volume') { min = 0; max = 1; }
                        if (asm.param === 'duty') { min = 0.1; max = 0.9; }
                        
                        this.assignLFOToChannelParam(asm.lfo, asm.channel, asm.param, min, max, true);
                    } else {
                        const effect = this.effectChains[asm.channel][asm.effect];
                        if (effect) {
                            const defs = effect.getParamDefinitions();
                            const def = defs.find(d => d.name === asm.param);
                            if (def) {
                                this.assignLFOToEffectParam(
                                    asm.lfo, asm.channel, asm.effect, asm.param, 
                                    def.min, def.max, true
                                );
                            }
                        }
                    }
                });
            }, 150);
        }
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
