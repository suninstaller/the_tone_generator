/**
 * UI Module
 * Handles user interface interactions and updates
 */

class UIManager {
    constructor(synthEngine) {
        this.synth = synthEngine;
        this.effectParamTemplates = {};
        this.init();
    }

    init() {
        this.setupPowerButton();
        this.setupChannels();
        this.setupMasterControls();
        this.setupPresets();
        this.setupVisualizer();
    }

    /**
     * Set up the power/start button
     */
    setupPowerButton() {
        const powerBtn = document.getElementById('power-btn');
        
        powerBtn.addEventListener('click', async () => {
            if (!this.synth.isAudioStarted) {
                await this.synth.start();
                powerBtn.textContent = '⏻ STOP AUDIO';
                powerBtn.classList.remove('power-off');
                powerBtn.classList.add('power-on');
            } else {
                this.synth.stop();
                powerBtn.textContent = '⏻ START AUDIO';
                powerBtn.classList.remove('power-on');
                powerBtn.classList.add('power-off');
            }
        });
    }

    /**
     * Set up channel controls
     */
    setupChannels() {
        const channels = document.querySelectorAll('.channel');
        
        channels.forEach((channel, index) => {
            this.setupChannelControls(channel, index);
        });
    }

    /**
     * Set up controls for a single channel
     */
    setupChannelControls(channelEl, channelIndex) {
        // Channel on/off toggle
        const onToggle = channelEl.querySelector('.channel-on');
        onToggle.addEventListener('change', (e) => {
            this.synth.setChannelEnabled(channelIndex, e.target.checked);
            channelEl.classList.toggle('disabled', !e.target.checked);
        });

        // Waveform selector
        const waveformSelect = channelEl.querySelector('.waveform');
        waveformSelect.addEventListener('change', (e) => {
            const waveform = e.target.value;
            this.synth.setChannelWaveform(channelIndex, waveform);
            
            // Show/hide duty cycle control for square wave
            const dutySection = channelEl.querySelector('.square-duty');
            if (waveform === 'square') {
                dutySection.classList.remove('hidden');
            } else {
                dutySection.classList.add('hidden');
            }
            
            // Handle binaural beats special controls
            this.handleBinauralControls(channelEl, channelIndex, waveform);
            
            // Handle FM synth special controls
            this.handleFMControls(channelEl, channelIndex, waveform);
        });

        // Frequency slider
        const freqSlider = channelEl.querySelector('.frequency');
        const freqVal = channelEl.querySelector('.freq-val');
        freqSlider.addEventListener('input', (e) => {
            const freq = parseFloat(e.target.value);
            freqVal.textContent = freq;
            this.synth.setChannelFrequency(channelIndex, freq);
        });

        // Duty cycle slider (for square wave)
        const dutySlider = channelEl.querySelector('.duty');
        const dutyVal = channelEl.querySelector('.duty-val');
        if (dutySlider) {
            dutySlider.addEventListener('input', (e) => {
                const duty = parseFloat(e.target.value);
                dutyVal.textContent = duty;
                this.synth.setChannelDuty(channelIndex, duty / 100);
            });
        }

        // Volume slider
        const volSlider = channelEl.querySelector('.volume');
        volSlider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value) / 100;
            this.synth.setChannelVolume(channelIndex, vol);
        });

        // Effect selectors
        const effectSelectors = channelEl.querySelectorAll('.effect-type');
        effectSelectors.forEach((selector, effectIndex) => {
            selector.addEventListener('change', (e) => {
                const effectType = e.target.value;
                this.synth.setChannelEffect(channelIndex, effectIndex, effectType);
                this.updateEffectParams(channelEl, effectIndex, effectType);
            });
        });
    }

    /**
     * Handle binaural beats specific controls
     */
    handleBinauralControls(channelEl, channelIndex, waveform) {
        // Remove existing binaural controls if any
        const existingBinaural = channelEl.querySelector('.binaural-controls');
        if (existingBinaural) {
            existingBinaural.remove();
        }
        
        if (waveform !== 'binaural') {
            // Restore normal frequency label
            const freqLabel = channelEl.querySelector('.frequency').previousElementSibling;
            if (freqLabel) {
                freqLabel.innerHTML = 'Frequency: <span class="freq-val">200</span> Hz';
            }
            return;
        }
        
        // Change frequency label to "Carrier"
        const freqLabel = channelEl.querySelector('.frequency').previousElementSibling;
        if (freqLabel) {
            freqLabel.innerHTML = 'Carrier: <span class="freq-val">200</span> Hz';
        }
        
        // Create binaural controls container
        const binauralDiv = document.createElement('div');
        binauralDiv.className = 'section binaural-controls';
        
        // Beat frequency slider
        const beatLabel = document.createElement('label');
        beatLabel.innerHTML = 'Beat Frequency: <span class="beat-val">10</span> Hz (Alpha)';
        
        const beatSlider = document.createElement('input');
        beatSlider.type = 'range';
        beatSlider.className = 'beat-frequency';
        beatSlider.min = '1';
        beatSlider.max = '50';
        beatSlider.value = '10';
        beatSlider.step = '0.5';
        
        beatSlider.addEventListener('input', (e) => {
            const beatFreq = parseFloat(e.target.value);
            let brainwave = '';
            if (beatFreq <= 4) brainwave = 'Delta (Sleep)';
            else if (beatFreq <= 8) brainwave = 'Theta (Meditation)';
            else if (beatFreq <= 14) brainwave = 'Alpha (Relaxation)';
            else if (beatFreq <= 30) brainwave = 'Beta (Focus)';
            else brainwave = 'Gamma (Cognition)';
            
            beatLabel.innerHTML = `Beat Frequency: <span class="beat-val">${beatFreq}</span> Hz (${brainwave})`;
            this.synth.setChannelBinauralBeatFreq(channelIndex, beatFreq);
        });
        
        // Brainwave preset buttons
        const presetDiv = document.createElement('div');
        presetDiv.className = 'binaural-presets';
        presetDiv.style.marginTop = '10px';
        
        const presets = [
            { id: 'delta', label: 'δ Sleep', freq: 2 },
            { id: 'theta', label: 'θ Meditate', freq: 6 },
            { id: 'alpha', label: 'α Relax', freq: 10 },
            { id: 'beta', label: 'β Focus', freq: 20 },
            { id: 'gamma', label: 'γ Peak', freq: 40 }
        ];
        
        presets.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn-small';
            btn.textContent = preset.label;
            btn.style.cssText = 'padding: 4px 8px; margin: 2px; border: none; border-radius: 4px; background: #0f3460; color: #eee; cursor: pointer; font-size: 0.75rem;';
            btn.addEventListener('click', () => {
                beatSlider.value = preset.freq;
                beatSlider.dispatchEvent(new Event('input'));
            });
            presetDiv.appendChild(btn);
        });
        
        binauralDiv.appendChild(beatLabel);
        binauralDiv.appendChild(beatSlider);
        binauralDiv.appendChild(presetDiv);
        
        // Insert after frequency section
        const freqSection = channelEl.querySelector('.frequency').parentElement;
        freqSection.insertAdjacentElement('afterend', binauralDiv);
        
        // Initialize binaural with default values
        this.synth.setChannelBinauralBaseFreq(channelIndex, 200);
        this.synth.setChannelBinauralBeatFreq(channelIndex, 10);
    }

    /**
     * Handle FM synthesizer specific controls
     */
    handleFMControls(channelEl, channelIndex, waveform) {
        // Remove existing FM controls if any
        const existingFM = channelEl.querySelector('.fm-controls');
        if (existingFM) {
            existingFM.remove();
        }
        
        if (waveform !== 'fm') {
            // Restore normal frequency label
            const freqLabel = channelEl.querySelector('.frequency').previousElementSibling;
            if (freqLabel && !channelEl.querySelector('.binaural-controls')) {
                freqLabel.innerHTML = 'Frequency: <span class="freq-val">440</span> Hz';
            }
            return;
        }
        
        // Change frequency label to "Carrier"
        const freqLabel = channelEl.querySelector('.frequency').previousElementSibling;
        if (freqLabel) {
            freqLabel.innerHTML = 'Carrier: <span class="freq-val">440</span> Hz';
        }
        
        // Create FM controls container
        const fmDiv = document.createElement('div');
        fmDiv.className = 'section fm-controls';
        
        // Modulator frequency slider
        const modLabel = document.createElement('label');
        modLabel.innerHTML = 'Modulator: <span class="mod-val">110</span> Hz';
        
        const modSlider = document.createElement('input');
        modSlider.type = 'range';
        modSlider.className = 'modulator-freq';
        modSlider.min = '1';
        modSlider.max = '1000';
        modSlider.value = '110';
        modSlider.step = '1';
        
        modSlider.addEventListener('input', (e) => {
            const modFreq = parseFloat(e.target.value);
            modLabel.innerHTML = `Modulator: <span class="mod-val">${modFreq}</span> Hz`;
            this.synth.setChannelFMModulatorFreq(channelIndex, modFreq);
        });
        
        // Modulation index slider
        const indexLabel = document.createElement('label');
        indexLabel.innerHTML = 'Modulation Index: <span class="index-val">100</span>';
        indexLabel.style.marginTop = '10px';
        indexLabel.style.display = 'block';
        
        const indexSlider = document.createElement('input');
        indexSlider.type = 'range';
        indexSlider.className = 'modulation-index';
        indexSlider.min = '0';
        indexSlider.max = '1000';
        indexSlider.value = '100';
        indexSlider.step = '10';
        
        indexSlider.addEventListener('input', (e) => {
            const index = parseFloat(e.target.value);
            indexLabel.innerHTML = `Modulation Index: <span class="index-val">${index}</span>`;
            this.synth.setChannelFMIndex(channelIndex, index);
        });
        
        // Algorithm preset buttons
        const algoDiv = document.createElement('div');
        algoDiv.className = 'fm-algorithms';
        algoDiv.style.marginTop = '10px';
        
        const algorithms = [
            { id: 0, label: '1:1 Classic' },
            { id: 1, label: '1:2 Up' },
            { id: 2, label: '2:1 Down' },
            { id: 3, label: '3:1 Bell' }
        ];
        
        algorithms.forEach(algo => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn-small';
            btn.textContent = algo.label;
            btn.style.cssText = 'padding: 4px 8px; margin: 2px; border: none; border-radius: 4px; background: #0f3460; color: #eee; cursor: pointer; font-size: 0.75rem;';
            btn.addEventListener('click', () => {
                this.synth.setChannelFMAlgorithm(channelIndex, algo.id);
            });
            algoDiv.appendChild(btn);
        });
        
        fmDiv.appendChild(modLabel);
        fmDiv.appendChild(modSlider);
        fmDiv.appendChild(indexLabel);
        fmDiv.appendChild(indexSlider);
        fmDiv.appendChild(algoDiv);
        
        // Insert after frequency section
        const freqSection = channelEl.querySelector('.frequency').parentElement;
        freqSection.insertAdjacentElement('afterend', fmDiv);
        
        // Initialize FM with default values
        this.synth.setChannelFMModulatorFreq(channelIndex, 110);
        this.synth.setChannelFMIndex(channelIndex, 100);
        this.synth.setChannelFMAlgorithm(channelIndex, 0);
    }

    /**
     * Update effect parameter controls based on selected effect type
     */
    updateEffectParams(channelEl, effectIndex, effectType) {
        const effectSlots = channelEl.querySelectorAll('.effect-slot');
        const paramContainer = effectSlots[effectIndex].querySelector('.effect-params');
        const channelIndex = parseInt(channelEl.dataset.channel);
        
        console.log('updateEffectParams called:', { effectType, channelIndex, effectIndex });
        
        // Clear existing params
        paramContainer.innerHTML = '';
        effectSlots[effectIndex].classList.remove('active');
        
        if (effectType === 'none') {
            console.log('Effect type is none, returning');
            return;
        }
        
        effectSlots[effectIndex].classList.add('active');
        
        // Get param definitions from the effect
        const effect = this.synth.getEffectInstance(effectType);
        console.log('Effect instance:', effect);
        
        if (!effect) {
            console.error('Failed to create effect instance for:', effectType);
            paramContainer.innerHTML = '<div style="color: #e94560; padding: 10px; font-size: 0.85rem;">⚠️ Click "START AUDIO" first to use effects</div>';
            effectSlots[effectIndex].classList.remove('active');
            return;
        }
        
        const params = effect.getParamDefinitions();
        
        params.forEach(param => {
            const paramDiv = document.createElement('div');
            paramDiv.className = 'effect-param';
            
            const label = document.createElement('label');
            label.textContent = `${param.label}: `;
            const valueSpan = document.createElement('span');
            valueSpan.className = 'param-value';
            valueSpan.textContent = this.formatParamValue(param.default, param.step);
            label.appendChild(valueSpan);
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = param.min;
            slider.max = param.max;
            slider.step = param.step;
            slider.value = param.default;
            
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                valueSpan.textContent = this.formatParamValue(value, param.step);
                this.synth.setEffectParam(channelIndex, effectIndex, param.name, value);
            });
            
            paramDiv.appendChild(label);
            paramDiv.appendChild(slider);
            paramContainer.appendChild(paramDiv);
        });
    }

    /**
     * Format parameter value for display
     */
    formatParamValue(value, step) {
        const decimals = step < 0.01 ? 4 : (step < 0.1 ? 2 : (step < 1 ? 1 : 0));
        return value.toFixed(decimals);
    }

    /**
     * Set up master controls
     */
    setupMasterControls() {
        const masterVol = document.getElementById('master-volume');
        masterVol.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value) / 100;
            this.synth.setMasterVolume(vol);
        });
    }

    /**
     * Set up preset buttons
     */
    setupPresets() {
        const presetBtns = document.querySelectorAll('.preset-btn');
        
        const presets = {
            drone: () => this.loadDronePreset(),
            bass: () => this.loadBassPreset(),
            lead: () => this.loadLeadPreset(),
            fx: () => this.loadFXPreset(),
            meditate: () => this.loadMeditationPreset(),  // NEW!
            reset: () => this.loadResetPreset()
        };
        
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const presetName = btn.dataset.preset;
                if (presets[presetName]) {
                    presets[presetName]();
                }
            });
        });
    }

    /**
     * Load drone preset - ambient atmospheric sound
     */
    loadDronePreset() {
        const config = [
            { on: true, waveform: 'sine', freq: 110, vol: 50, duty: 50, effects: ['reverb', 'none', 'none'] },
            { on: true, waveform: 'triangle', freq: 111, vol: 40, duty: 50, effects: ['delay', 'none', 'none'] },
            { on: true, waveform: 'sine', freq: 55, vol: 50, duty: 50, effects: ['reverb', 'none', 'none'] },
            { on: false, waveform: 'sawtooth', freq: 220, vol: 30, duty: 50, effects: ['none', 'none', 'none'] }
        ];
        this.loadPreset(config);
        
        // Set effect params for drone
        setTimeout(() => {
            this.synth.setEffectParam(0, 0, 'mix', 0.6);
            this.synth.setEffectParam(0, 0, 'decay', 4);
            this.synth.setEffectParam(1, 0, 'time', 0.5);
            this.synth.setEffectParam(1, 0, 'feedback', 0.5);
            this.synth.setEffectParam(2, 0, 'mix', 0.7);
        }, 100);
    }

    /**
     * Load bass preset - deep bass sound
     */
    loadBassPreset() {
        const config = [
            { on: true, waveform: 'square', freq: 65, vol: 70, duty: 40, effects: ['none', 'none', 'none'] },
            { on: true, waveform: 'sawtooth', freq: 66, vol: 60, duty: 50, effects: ['delay', 'none', 'none'] },
            { on: false, waveform: 'sine', freq: 130, vol: 50, duty: 50, effects: ['none', 'none', 'none'] },
            { on: false, waveform: 'triangle', freq: 55, vol: 50, duty: 50, effects: ['none', 'none', 'none'] }
        ];
        this.loadPreset(config);
    }

    /**
     * Load lead preset - bright lead sound
     */
    loadLeadPreset() {
        const config = [
            { on: true, waveform: 'sawtooth', freq: 440, vol: 60, duty: 50, effects: ['flanger', 'none', 'none'] },
            { on: true, waveform: 'square', freq: 442, vol: 40, duty: 30, effects: ['delay', 'none', 'none'] },
            { on: false, waveform: 'sine', freq: 880, vol: 30, duty: 50, effects: ['none', 'none', 'none'] },
            { on: false, waveform: 'triangle', freq: 220, vol: 40, duty: 50, effects: ['none', 'none', 'none'] }
        ];
        this.loadPreset(config);
        
        setTimeout(() => {
            this.synth.setEffectParam(0, 0, 'rate', 0.3);
            this.synth.setEffectParam(0, 0, 'depth', 0.005);
            this.synth.setEffectParam(0, 0, 'mix', 0.4);
            this.synth.setEffectParam(1, 0, 'time', 0.25);
            this.synth.setEffectParam(1, 0, 'mix', 0.3);
        }, 100);
    }

    /**
     * Load FX preset - experimental sound effects
     */
    loadFXPreset() {
        const config = [
            { on: true, waveform: 'square', freq: 110, vol: 50, duty: 20, effects: ['ringmod', 'delay', 'flanger'] },
            { on: true, waveform: 'sawtooth', freq: 55, vol: 50, duty: 50, effects: ['ringmod', 'reverb', 'none'] },
            { on: true, waveform: 'triangle', freq: 220, vol: 40, duty: 50, effects: ['flanger', 'delay', 'none'] },
            { on: false, waveform: 'sine', freq: 440, vol: 30, duty: 50, effects: ['none', 'none', 'none'] }
        ];
        this.loadPreset(config);
        
        setTimeout(() => {
            this.synth.setEffectParam(0, 0, 'frequency', 100);
            this.synth.setEffectParam(0, 0, 'mix', 0.8);
            this.synth.setEffectParam(0, 1, 'feedback', 0.7);
            this.synth.setEffectParam(1, 0, 'frequency', 55);
            this.synth.setEffectParam(1, 0, 'mix', 0.5);
        }, 100);
    }

    /**
     * Meditation preset - binaural beats for relaxation
     */
    loadMeditationPreset() {
        const config = [
            { on: true, waveform: 'binaural', freq: 200, vol: 60, duty: 50, effects: ['pror', 'none', 'none'] },
            { on: false, waveform: 'sine', freq: 110, vol: 40, duty: 50, effects: ['none', 'none', 'none'] },
            { on: false, waveform: 'noise', freq: 100, vol: 30, duty: 50, effects: ['none', 'none', 'none'] },
            { on: false, waveform: 'sine', freq: 55, vol: 30, duty: 50, effects: ['none', 'none', 'none'] }
        ];
        this.loadPreset(config);
        
        // Set binaural to theta waves (meditation)
        setTimeout(() => {
            this.synth.setChannelBinauralBeatFreq(0, 6); // Theta: 6 Hz
            this.synth.setEffectParam(0, 0, 'mix', 0.5);
            this.synth.setEffectParam(0, 0, 'decay', 4);
            this.synth.setEffectParam(0, 0, 'modulation', 0.5);
            
            // Update UI to show binaural controls
            const channel = document.querySelector('.channel[data-channel="0"]');
            this.handleBinauralControls(channel, 0, 'binaural');
            
            // Set beat frequency slider
            const beatSlider = channel.querySelector('.beat-frequency');
            if (beatSlider) {
                beatSlider.value = 6;
                beatSlider.dispatchEvent(new Event('input'));
            }
        }, 100);
    }

    /**
     * Reset all to default
     */
    loadResetPreset() {
        const config = [
            { on: true, waveform: 'sine', freq: 440, vol: 50, duty: 50, effects: ['none', 'none', 'none'] },
            { on: false, waveform: 'sawtooth', freq: 220, vol: 50, duty: 50, effects: ['none', 'none', 'none'] },
            { on: false, waveform: 'triangle', freq: 110, vol: 50, duty: 50, effects: ['none', 'none', 'none'] },
            { on: false, waveform: 'square', freq: 55, vol: 50, duty: 30, effects: ['none', 'none', 'none'] }
        ];
        this.loadPreset(config);
    }

    /**
     * Apply preset configuration to UI and synth
     */
    loadPreset(config) {
        const channels = document.querySelectorAll('.channel');
        
        config.forEach((chConfig, index) => {
            const channel = channels[index];
            if (!channel) return;
            
            // Update UI controls
            const onToggle = channel.querySelector('.channel-on');
            const waveform = channel.querySelector('.waveform');
            const freq = channel.querySelector('.frequency');
            const freqVal = channel.querySelector('.freq-val');
            const duty = channel.querySelector('.duty');
            const dutyVal = channel.querySelector('.duty-val');
            const vol = channel.querySelector('.volume');
            const effectSelectors = channel.querySelectorAll('.effect-type');
            
            onToggle.checked = chConfig.on;
            waveform.value = chConfig.waveform;
            freq.value = chConfig.freq;
            freqVal.textContent = chConfig.freq;
            if (duty) {
                duty.value = chConfig.duty;
                dutyVal.textContent = chConfig.duty;
            }
            vol.value = chConfig.vol;
            
            // Show/hide duty cycle
            const dutySection = channel.querySelector('.square-duty');
            if (chConfig.waveform === 'square') {
                dutySection.classList.remove('hidden');
            } else {
                dutySection.classList.add('hidden');
            }
            
            // Update channel disabled state
            channel.classList.toggle('disabled', !chConfig.on);
            
            // Apply to synth
            this.synth.setChannelEnabled(index, chConfig.on);
            this.synth.setChannelWaveform(index, chConfig.waveform);
            this.synth.setChannelFrequency(index, chConfig.freq);
            this.synth.setChannelDuty(index, chConfig.duty / 100);
            this.synth.setChannelVolume(index, chConfig.vol / 100);
            
            // Set effects
            chConfig.effects.forEach((effectType, effectIndex) => {
                effectSelectors[effectIndex].value = effectType;
                this.synth.setChannelEffect(index, effectIndex, effectType);
                this.updateEffectParams(channel, effectIndex, effectType);
            });
        });
    }

    /**
     * Set up the audio visualizer
     */
    setupVisualizer() {
        const canvas = document.getElementById('visualizer');
        const ctx = canvas.getContext('2d');
        
        const draw = () => {
            requestAnimationFrame(draw);
            
            const analyser = this.synth.getAnalyser();
            if (!analyser) {
                // Clear canvas if no audio
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                return;
            }
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArray);
            
            // Clear canvas
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw waveform
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#00d9ff';
            ctx.beginPath();
            
            const sliceWidth = canvas.width / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * canvas.height) / 2;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                
                x += sliceWidth;
            }
            
            ctx.stroke();
            
            // Add gradient overlay
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, 'rgba(233, 69, 96, 0.1)');
            gradient.addColorStop(0.5, 'rgba(0, 217, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(233, 69, 96, 0.1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        };
        
        draw();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIManager };
}
