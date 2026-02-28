/**
 * UI Module
 * Handles user interface interactions and updates
 */

class UIManager {
    constructor(synthEngine) {
        this.synth = synthEngine;
        this.effectParamTemplates = {};
        this.isInitialLoad = true;
        this.init();
    }

    init() {
        this.setupPowerButton();
        this.setupChannels();
        this.setupMasterControls();
        this.setupPresets();
        this.setupUserPresets(); // Initialize user presets
        this.setupVisualizer();
        this.setupMIDIControls();
        
        // Load state from local storage after UI is set up
        setTimeout(() => this.loadFromLocalStorage(), 100);
    }

    /**
     * Set up user preset management
     */
    setupUserPresets() {
        const saveBtn = document.getElementById('save-patch-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveUserPatch());
        }
        this.renderUserPresets();
    }

    /**
     * Save the current state as a user patch
     */
    saveUserPatch() {
        const name = prompt('Enter a name for your patch:', `Patch ${new Date().toLocaleTimeString()}`);
        if (!name) return;

        try {
            const state = this.synth.getSerializedState();
            const savedPatches = JSON.parse(localStorage.getItem('tone-generator-user-patches') || '[]');
            
            savedPatches.push({
                name: name,
                date: Date.now(),
                state: state
            });
            
            localStorage.setItem('tone-generator-user-patches', JSON.stringify(savedPatches));
            this.renderUserPresets();
            this.showToast(`Patch "${name}" saved!`, 'success');
        } catch (e) {
            console.error('Failed to save user patch:', e);
            this.showToast('Failed to save patch', 'error');
        }
    }

    /**
     * Render the list of user patches
     */
    renderUserPresets() {
        const listContainer = document.getElementById('user-presets-list');
        if (!listContainer) return;

        try {
            const savedPatches = JSON.parse(localStorage.getItem('tone-generator-user-patches') || '[]');
            
            if (savedPatches.length === 0) {
                listContainer.innerHTML = '<p style="font-size: 0.8em; opacity: 0.5;">No saved patches yet.</p>';
                return;
            }

            listContainer.innerHTML = '';
            savedPatches.forEach((patch, index) => {
                const btn = document.createElement('button');
                btn.className = 'preset-btn user-patch-btn';
                btn.innerHTML = `<span>${patch.name}</span> <small class="delete-patch" data-index="${index}">×</small>`;
                
                btn.addEventListener('click', (e) => {
                    if (e.target.classList.contains('delete-patch')) {
                        e.stopPropagation();
                        this.deleteUserPatch(index);
                    } else {
                        this.loadUserPatch(patch.state);
                    }
                });
                
                listContainer.appendChild(btn);
            });
        } catch (e) {
            console.error('Failed to render user patches:', e);
        }
    }

    /**
     * Load a user patch state
     */
    async loadUserPatch(state) {
        if (!this.synth.isAudioStarted) {
            this.showToast('Please start audio first', 'info');
            // But still update UI preview
            this.updateUIFromState(state);
            this.pendingState = state;
            return;
        }

        this.showToast('Loading patch...', 'info');
        await this.synth.loadSerializedState(state);
        this.updateUIFromState(state);
        
        // Ensure all effect UIs are rebuilt
        const channels = document.querySelectorAll('.channel');
        state.channels.forEach((ch, i) => {
            const channel = channels[i];
            ch.effects.forEach((eff, j) => {
                this.updateEffectParams(channel, j, eff.type);
            });
        });
        
        this.saveToLocalStorage();
    }

    /**
     * Delete a user patch
     */
    deleteUserPatch(index) {
        if (!confirm('Are you sure you want to delete this patch?')) return;

        try {
            const savedPatches = JSON.parse(localStorage.getItem('tone-generator-user-patches') || '[]');
            savedPatches.splice(index, 1);
            localStorage.setItem('tone-generator-user-patches', JSON.stringify(savedPatches));
            this.renderUserPresets();
        } catch (e) {
            console.error('Failed to delete patch:', e);
        }
    }

    /**
     * Save current state to local storage
     */
    saveToLocalStorage() {
        if (this.isInitialLoad) return;
        
        try {
            const state = this.synth.getSerializedState();
            localStorage.setItem('tone-generator-patch', JSON.stringify(state));
            console.log('Patch saved to local storage');
        } catch (e) {
            console.error('Failed to save to local storage:', e);
        }
    }

    /**
     * Load state from local storage
     */
    async loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('tone-generator-patch');
            if (saved) {
                const state = JSON.parse(saved);
                console.log('Loading patch from local storage...');
                
                // We need the audio context to be started for many settings
                // but we can at least update the UI values now
                this.updateUIFromState(state);
                
                // If audio is already started, apply everything
                if (this.synth.isAudioStarted) {
                    await this.synth.loadSerializedState(state);
                } else {
                    // Store state to load when audio starts
                    this.pendingState = state;
                }
            }
        } catch (e) {
            console.warn('No saved patch found or failed to parse:', e);
        } finally {
            this.isInitialLoad = false;
        }
    }

    /**
     * Update UI elements from a state object
     */
    updateUIFromState(state) {
        if (!state || !state.channels) return;
        
        const channels = document.querySelectorAll('.channel');
        
        state.channels.forEach((ch, i) => {
            const channel = channels[i];
            if (!channel) return;
            
            // Channel on/off
            const onToggle = channel.querySelector('.channel-on');
            onToggle.checked = ch.enabled;
            channel.classList.toggle('disabled', !ch.enabled);
            
            // Waveform
            const waveformEl = channel.querySelector('.waveform');
            waveformEl.value = ch.waveform;
            
            // Handle special generator controls (MUST call before frequency/duty to set ranges)
            this.handleBinauralControls(channel, i, ch.waveform);
            this.handleFMControls(channel, i, ch.waveform);
            this.handleInfrasoundControls(channel, i, ch.waveform);
            this.handleNoiseControls(channel, i, ch.waveform);
            this.handleGranularControls(channel, i, ch.waveform);
            
            // Restore special generator settings if they exist
            if (ch.noiseType) {
                const nt = channel.querySelector('.noise-type');
                if (nt) nt.value = ch.noiseType;
            }
            if (ch.beatFreq) {
                const bf = channel.querySelector('.beat-freq');
                const bfv = channel.querySelector('.beat-freq-val');
                if (bf) { bf.value = ch.beatFreq; if (bfv) bfv.textContent = ch.beatFreq; }
            }
            if (ch.modIndex !== undefined) {
                const mi = channel.querySelector('.fm-mod-index');
                const miv = channel.querySelector('.mod-index-val');
                if (mi) { mi.value = ch.modIndex; if (miv) miv.textContent = ch.modIndex; }
            }
            if (ch.fmAlgo !== undefined) {
                const fa = channel.querySelector('.fm-algo');
                if (fa) fa.value = ch.fmAlgo;
            }
            if (ch.infraWaveform) {
                const iw = channel.querySelector('.infrasound-waveform');
                if (iw) iw.value = ch.infraWaveform;
            }
            if (ch.density) {
                const d = channel.querySelector('.density');
                const dv = channel.querySelector('.density-val');
                if (d) { d.value = ch.density; if (dv) dv.textContent = ch.density; }
            }
            
            // Duty cycle
            const dutySection = channel.querySelector('.square-duty');
            if (ch.waveform === 'square') {
                dutySection.classList.remove('hidden');
                const dutyInput = channel.querySelector('.duty');
                const dutyVal = channel.querySelector('.duty-val');
                if (dutyInput && ch.duty !== undefined) {
                    dutyInput.value = ch.duty * 100;
                    dutyVal.textContent = Math.round(ch.duty * 100);
                }
            } else {
                dutySection.classList.add('hidden');
            }
            
            // Frequency
            const freqInput = channel.querySelector('.frequency');
            const freqVal = channel.querySelector('.freq-val');
            freqInput.value = ch.frequency;
            
            // Format display based on range (infrasound needs decimals)
            if (ch.waveform === 'infrasound') {
                freqVal.textContent = parseFloat(ch.frequency).toFixed(2);
            } else {
                freqVal.textContent = Math.round(ch.frequency);
            }
            
            // Volume
            const volInput = channel.querySelector('.volume');
            volInput.value = ch.volume * 100;
            
            // Refresh Mod buttons for channel params
            channel.querySelectorAll('.mod-button').forEach(btn => {
                const label = btn.parentElement;
                const container = label.parentElement;
                const slider = container.querySelector('input[type="range"]');
                if (!slider) return;
                
                let paramName = '';
                if (slider.classList.contains('frequency')) paramName = 'frequency';
                else if (slider.classList.contains('volume')) paramName = 'volume';
                else if (slider.classList.contains('duty')) paramName = 'duty';
                
                if (paramName && this.synth.isChannelLFOAssigned(i, paramName)) {
                    const assignment = this.synth.getChannelLFOAssignment(i, paramName);
                    btn.classList.add('active');
                    btn.textContent = `LFO ${assignment.lfoIndex + 1}`;
                } else {
                    btn.classList.remove('active');
                    btn.textContent = 'Mod';
                }
            });
            
            // Effects
            const effectSelectors = channel.querySelectorAll('.effect-type');
            if (ch.effects) {
                ch.effects.forEach((eff, j) => {
                    if (effectSelectors[j]) {
                        effectSelectors[j].value = eff.type;
                        // Don't call updateEffectParams yet if audio not started
                        // since it needs effect instances
                        if (this.synth.isAudioStarted) {
                            this.updateEffectParams(channel, j, eff.type);
                        }
                    }
                });
            }
        });
        
        // Master volume
        if (state.master) {
            const masterVol = document.getElementById('master-volume');
            if (masterVol) masterVol.value = state.master.volume * 100;
        }
    }

    /**
     * Synchronize all current UI values to the synth engine
     * Useful after starting the audio engine
     */
    syncAllControlsToSynth() {
        console.log('Syncing UI state to audio engine...');
        
        // Master volume
        const masterVol = document.getElementById('master-volume');
        if (masterVol) {
            this.synth.setMasterVolume(parseFloat(masterVol.value) / 100);
        }
        
        // LFOs
        for (let i = 0; i < 3; i++) {
            const rateSlider = document.querySelector(`.lfo-rate[data-lfo="${i}"]`);
            const depthSlider = document.querySelector(`.lfo-depth[data-lfo="${i}"]`);
            const waveSelect = document.querySelector(`.lfo-waveform[data-lfo="${i}"]`);
            
            if (rateSlider) this.synth.setLFORate(i, parseFloat(rateSlider.value));
            if (depthSlider) this.synth.setLFODepth(i, parseFloat(depthSlider.value) / 100);
            if (waveSelect) this.synth.setLFOWaveform(i, waveSelect.value);
        }
        
        // Channels
        const channels = document.querySelectorAll('.channel');
        channels.forEach((channelEl, i) => {
            const onToggle = channelEl.querySelector('.channel-on');
            const waveform = channelEl.querySelector('.waveform');
            const freqSlider = channelEl.querySelector('.frequency');
            const volSlider = channelEl.querySelector('.volume');
            
            if (waveform) this.synth.setChannelWaveform(i, waveform.value);
            if (freqSlider) this.synth.setChannelFrequency(i, parseFloat(freqSlider.value));
            if (volSlider) this.synth.setChannelVolume(i, parseFloat(volSlider.value) / 100);
            
            // Special generator types need their UI built
            if (waveform) {
                const wf = waveform.value;
                this.handleBinauralControls(channelEl, i, wf);
                this.handleFMControls(channelEl, i, wf);
                this.handleInfrasoundControls(channelEl, i, wf);
                this.handleNoiseControls(channelEl, i, wf);
                this.handleGranularControls(channelEl, i, wf);
            }
            
            if (onToggle) this.synth.setChannelEnabled(i, onToggle.checked);
        });
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
                
                // Load pending state if any
                if (this.pendingState) {
                    console.log('Applying pending state...');
                    await this.synth.loadSerializedState(this.pendingState);
                    // Update effect param UI now that instances exist
                    const channels = document.querySelectorAll('.channel');
                    this.pendingState.channels.forEach((ch, i) => {
                        const channel = channels[i];
                        ch.effects.forEach((eff, j) => {
                            this.updateEffectParams(channel, j, eff.type);
                        });
                    });
                    this.pendingState = null;
                } else {
                    // Sync current UI state to engine if no pending state
                    this.syncAllControlsToSynth();
                }
                
                // Restart visualizer loop
                if (typeof this.drawVisualizer === 'function' && !this.visFrameRequest) {
                    this.drawVisualizer();
                }
            } else {
                this.synth.stop();
                powerBtn.textContent = '⏻ START AUDIO';
                powerBtn.classList.remove('power-on');
                powerBtn.classList.add('power-off');
                // The draw loop will stop itself because isAudioStarted is now false
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
            this.saveToLocalStorage();
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
            
            // Handle special generator controls
            this.handleBinauralControls(channelEl, channelIndex, waveform);
            this.handleFMControls(channelEl, channelIndex, waveform);
            this.handleInfrasoundControls(channelEl, channelIndex, waveform);
            this.handleNoiseControls(channelEl, channelIndex, waveform);
            this.handleGranularControls(channelEl, channelIndex, waveform);
            
            this.saveToLocalStorage();
        });

        // Frequency slider
        const freqSlider = channelEl.querySelector('.frequency');
        freqSlider.addEventListener('input', (e) => {
            const freq = parseFloat(e.target.value);
            // Re-query freqVal each time since HTML can change
            const freqVal = channelEl.querySelector('.freq-val');
            // Format display based on range (infrasound needs decimals)
            const waveform = channelEl.querySelector('.waveform').value;
            if (waveform === 'infrasound') {
                freqVal.textContent = freq.toFixed(2);
            } else {
                freqVal.textContent = Math.round(freq);
            }
            this.synth.setChannelFrequency(channelIndex, freq);
            this.saveToLocalStorage();
        });
        
        // MIDI Learn for frequency
        freqSlider.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.initMIDILearn({ type: 'channel', channel: channelIndex, param: 'frequency' }, freqSlider);
        });
        
        // Add Mod button for frequency
        this.addModButtonToControl(freqSlider, channelIndex, 'frequency', {
            label: 'Freq',
            min: parseFloat(freqSlider.min),
            max: parseFloat(freqSlider.max),
            step: parseFloat(freqSlider.step)
        });

        // Duty cycle slider (for square wave)
        const dutySlider = channelEl.querySelector('.duty');
        const dutyVal = channelEl.querySelector('.duty-val');
        if (dutySlider) {
            dutySlider.addEventListener('input', (e) => {
                const duty = parseFloat(e.target.value);
                dutyVal.textContent = duty;
                this.synth.setChannelDuty(channelIndex, duty / 100);
                this.saveToLocalStorage();
            });
            
            // Add Mod button for duty (normalized to 0-1)
            this.addModButtonToControl(dutySlider, channelIndex, 'duty', {
                label: 'Duty',
                min: 0.1,
                max: 0.9,
                step: 0.01,
                isPercent: true
            });
        }

        // Volume slider
        const volSlider = channelEl.querySelector('.volume');
        volSlider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value) / 100;
            this.synth.setChannelVolume(channelIndex, vol);
            this.saveToLocalStorage();
        });
        
        // MIDI Learn for volume
        volSlider.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.initMIDILearn({ type: 'channel', channel: channelIndex, param: 'volume' }, volSlider);
        });
        
        // Add Mod button for volume
        this.addModButtonToControl(volSlider, channelIndex, 'volume', {
            label: 'Vol',
            min: 0,
            max: 1,
            step: 0.01,
            isPercent: true
        });

        // Effect selectors
        const effectSelectors = channelEl.querySelectorAll('.effect-type');
        effectSelectors.forEach((selector, effectIndex) => {
            selector.addEventListener('change', (e) => {
                const effectType = e.target.value;
                this.synth.setChannelEffect(channelIndex, effectIndex, effectType);
                this.updateEffectParams(channelEl, effectIndex, effectType);
                this.saveToLocalStorage();
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
            // Restore normal frequency label (only if not in other special mode)
            const freqSlider = channelEl.querySelector('.frequency');
            const freqLabel = freqSlider.previousElementSibling;
            const isFM = channelEl.querySelector('.fm-controls') !== null;
            const isInfrasound = freqSlider.dataset.infrasound === 'true';
            const isNoise = channelEl.querySelector('.noise-controls') !== null;
            const isGranular = channelEl.querySelector('.granular-controls') !== null;
            
            if (freqLabel && !isFM && !isInfrasound && !isNoise && !isGranular) {
                freqLabel.innerHTML = 'Frequency: <span class="freq-val">440</span> Hz';
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
            // Restore normal frequency label (only if not in other special mode)
            const freqSlider = channelEl.querySelector('.frequency');
            const freqLabel = freqSlider.previousElementSibling;
            const isBinaural = channelEl.querySelector('.binaural-controls') !== null;
            const isInfrasound = freqSlider.dataset.infrasound === 'true';
            const isNoise = channelEl.querySelector('.noise-controls') !== null;
            const isGranular = channelEl.querySelector('.granular-controls') !== null;
            
            if (freqLabel && !isBinaural && !isInfrasound && !isNoise && !isGranular) {
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
     * Handle infrasound specific controls
     */
    handleInfrasoundControls(channelEl, channelIndex, waveform) {
        const freqSlider = channelEl.querySelector('.frequency');
        const freqLabel = freqSlider.previousElementSibling;
        const freqVal = freqLabel.querySelector('.freq-val');
        
        // Remove existing infrasound controls
        const existingInfra = channelEl.querySelector('.infrasound-controls');
        if (existingInfra) {
            existingInfra.remove();
        }
        
        // Remove infrasound flag if not infrasound
        if (waveform !== 'infrasound') {
            if (freqSlider.dataset.infrasound === 'true') {
                // Restore normal range
                freqSlider.min = '20';
                freqSlider.max = '20000';
                freqSlider.step = '1';
                freqSlider.value = '55';
                freqVal.textContent = '55';
                freqLabel.innerHTML = 'Frequency: <span class="freq-val">55</span> Hz';
                freqSlider.removeAttribute('data-infrasound');
                
                // Update synth
                this.synth.setChannelFrequency(channelIndex, 55);
            }
            return;
        }
        
        // Set infrasound mode
        freqSlider.setAttribute('data-infrasound', 'true');
        
        // Change frequency label and range for infrasound (0.5 - 50 Hz)
        freqSlider.min = '0.5';
        freqSlider.max = '50';
        freqSlider.step = '0.5';
        freqSlider.value = '8';
        freqVal.textContent = '8.00';
        freqLabel.innerHTML = 'Frequency: <span class="freq-val">8.00</span> Hz <small>(Infrasound)</small>';
        
        // Update synth
        this.synth.setChannelFrequency(channelIndex, 8);
        
        // Create infrasound waveform selector
        const infraDiv = document.createElement('div');
        infraDiv.className = 'section infrasound-controls';
        
        const waveLabel = document.createElement('label');
        waveLabel.textContent = 'Waveform:';
        
        const waveSelect = document.createElement('select');
        waveSelect.className = 'infrasound-waveform';
        waveSelect.style.cssText = 'width: 100%; padding: 5px; margin-top: 5px; background: #0f3460; color: #eee; border: 1px solid #e94560; border-radius: 4px;';
        
        const waveforms = [
            { id: 'sine', name: 'Sine' },
            { id: 'sawtooth', name: 'Sawtooth' },
            { id: 'triangle', name: 'Triangle' }
        ];
        
        waveforms.forEach(wf => {
            const option = document.createElement('option');
            option.value = wf.id;
            option.textContent = wf.name;
            waveSelect.appendChild(option);
        });
        
        waveSelect.addEventListener('change', (e) => {
            this.synth.setChannelInfrasoundWaveform(channelIndex, e.target.value);
            // Show/hide duty slider
            const dutySection = infraDiv.querySelector('.infra-duty-section');
            if (e.target.value === 'square') {
                dutySection.style.display = 'block';
            } else {
                dutySection.style.display = 'none';
            }
        });
        
        // Duty cycle slider for square wave (PWM)
        const dutySection = document.createElement('div');
        dutySection.className = 'infra-duty-section';
        dutySection.style.display = 'none'; // Hidden by default
        dutySection.style.marginTop = '10px';
        
        const dutyLabel = document.createElement('label');
        dutyLabel.innerHTML = 'Duty: <span class="duty-val">50</span>% <small>(PWM)</small>';
        
        const dutySlider = document.createElement('input');
        dutySlider.type = 'range';
        dutySlider.className = 'infra-duty';
        dutySlider.min = '10';
        dutySlider.max = '90';
        dutySlider.value = '50';
        
        dutySlider.addEventListener('input', (e) => {
            const duty = parseInt(e.target.value);
            dutyLabel.querySelector('.duty-val').textContent = duty;
            this.synth.setChannelInfrasoundDuty(channelIndex, duty / 100);
        });
        
        dutySection.appendChild(dutyLabel);
        dutySection.appendChild(dutySlider);
        
        infraDiv.appendChild(waveLabel);
        infraDiv.appendChild(waveSelect);
        infraDiv.appendChild(dutySection);
        
        // Insert after frequency section
        const freqSection = freqSlider.parentElement;
        freqSection.insertAdjacentElement('afterend', infraDiv);
        
        // Show duty if square is already selected
        if (waveSelect.value === 'square') {
            dutySection.style.display = 'block';
        }
    }

    /**
     * Handle noise generator specific controls
     */
    handleNoiseControls(channelEl, channelIndex, waveform) {
        // Remove existing noise controls if any
        const existingNoise = channelEl.querySelector('.noise-controls');
        if (existingNoise) {
            existingNoise.remove();
        }
        
        // Change frequency label for noise (it's a filter)
        const freqSlider = channelEl.querySelector('.frequency');
        const freqLabel = freqSlider.previousElementSibling;
        
        if (waveform !== 'noise') {
            // Restore normal label if not noise (and not other special modes)
            const isBinaural = channelEl.querySelector('.binaural-controls') !== null;
            const isFM = channelEl.querySelector('.fm-controls') !== null;
            const isInfrasound = freqSlider.dataset.infrasound === 'true';
            const isGranular = channelEl.querySelector('.granular-controls') !== null;
            
            if (!isBinaural && !isFM && !isInfrasound && !isGranular) {
                freqLabel.innerHTML = 'Frequency: <span class="freq-val">440</span> Hz';
            }
            return;
        }
        
        // Change frequency label to "Filter Cutoff"
        freqLabel.innerHTML = 'Filter Cutoff: <span class="freq-val">1000</span> Hz';
        freqSlider.value = 1000;
        
        // Create noise controls container
        const noiseDiv = document.createElement('div');
        noiseDiv.className = 'section noise-controls';
        
        // Noise type selector
        const typeLabel = document.createElement('label');
        typeLabel.textContent = 'Noise Type:';
        
        const typeSelect = document.createElement('select');
        typeSelect.className = 'noise-type';
        typeSelect.style.cssText = 'width: 100%; padding: 5px; margin-top: 5px; background: #0f3460; color: #eee; border: 1px solid #e94560; border-radius: 4px;';
        
        const types = [
            { id: 'white', name: 'White Noise' },
            { id: 'pink', name: 'Pink Noise' },
            { id: 'brown', name: 'Brown Noise' }
        ];
        
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type.id;
            option.textContent = type.name;
            typeSelect.appendChild(option);
        });
        
        typeSelect.addEventListener('change', (e) => {
            this.synth.setChannelNoiseType(channelIndex, e.target.value);
        });
        
        noiseDiv.appendChild(typeLabel);
        noiseDiv.appendChild(typeSelect);
        
        // Insert after frequency section
        const freqSection = freqSlider.parentElement;
        freqSection.insertAdjacentElement('afterend', noiseDiv);
        
        // Initialize noise with default filter
        this.synth.setChannelFrequency(channelIndex, 1000);
    }

    /**
     * Handle granular synthesizer specific controls
     */
    handleGranularControls(channelEl, channelIndex, waveform) {
        // Remove existing granular controls if any
        const existingGranular = channelEl.querySelector('.granular-controls');
        if (existingGranular) {
            existingGranular.remove();
        }
        
        if (waveform !== 'granular') {
            return;
        }
        
        // Create granular controls container
        const granularDiv = document.createElement('div');
        granularDiv.className = 'section granular-controls';
        
        // Density slider (grains per second)
        const densityLabel = document.createElement('label');
        densityLabel.innerHTML = `Density: <span class="density-val">20</span> grains/s`;
        
        const densitySlider = document.createElement('input');
        densitySlider.type = 'range';
        densitySlider.className = 'granular-density';
        densitySlider.min = '1';
        densitySlider.max = '100';
        densitySlider.value = '20';
        
        densitySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            densityLabel.innerHTML = `Density: <span class="density-val">${val}</span> grains/s`;
            this.synth.setChannelGranularParam(channelIndex, 'density', val);
        });
        
        // Spray slider (frequency randomization)
        const sprayLabel = document.createElement('label');
        sprayLabel.innerHTML = `Spray: <span class="spray-val">100</span> Hz`;
        sprayLabel.style.marginTop = '10px';
        sprayLabel.style.display = 'block';
        
        const spraySlider = document.createElement('input');
        spraySlider.type = 'range';
        spraySlider.className = 'granular-spray';
        spraySlider.min = '0';
        spraySlider.max = '1000';
        spraySlider.value = '100';
        
        spraySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            sprayLabel.innerHTML = `Spray: <span class="spray-val">${val}</span> Hz`;
            this.synth.setChannelGranularParam(channelIndex, 'spray', val);
        });
        
        // Grain size slider
        const sizeLabel = document.createElement('label');
        sizeLabel.innerHTML = `Grain Size: <span class="size-val">50</span> ms`;
        sizeLabel.style.marginTop = '10px';
        sizeLabel.style.display = 'block';
        
        const sizeSlider = document.createElement('input');
        sizeSlider.type = 'range';
        sizeSlider.className = 'granular-size';
        sizeSlider.min = '10';
        sizeSlider.max = '200';
        sizeSlider.value = '50';
        
        sizeSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            sizeLabel.innerHTML = `Grain Size: <span class="size-val">${val}</span> ms`;
            this.synth.setChannelGranularParam(channelIndex, 'grainSize', val);
        });
        
        granularDiv.appendChild(densityLabel);
        granularDiv.appendChild(densitySlider);
        granularDiv.appendChild(sprayLabel);
        granularDiv.appendChild(spraySlider);
        granularDiv.appendChild(sizeLabel);
        granularDiv.appendChild(sizeSlider);
        
        // Insert after frequency section
        const freqSection = channelEl.querySelector('.frequency').parentElement;
        freqSection.insertAdjacentElement('afterend', granularDiv);
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
        
        // Get actual current values if the effect is already in the chain
        const actualEffect = this.synth.effectChains[channelIndex][effectIndex];
        
        params.forEach(param => {
            const paramDiv = document.createElement('div');
            paramDiv.className = 'effect-param';
            paramDiv.dataset.paramName = param.name;
            
            // Get current value from the actual effect instance if it exists
            const currentValue = (actualEffect && actualEffect.params && actualEffect.params[param.name] !== undefined)
                ? actualEffect.params[param.name]
                : param.default;
            
            const label = document.createElement('label');
            label.textContent = `${param.label}: `;
            const valueSpan = document.createElement('span');
            valueSpan.className = 'param-value';
            valueSpan.textContent = this.formatParamValue(currentValue, param.step);
            label.appendChild(valueSpan);
            
            // Add Mod button
            const modBtn = document.createElement('button');
            modBtn.className = 'mod-button';
            modBtn.textContent = 'Mod';
            modBtn.title = 'Assign LFO modulation';
            
            // Check if already modulated
            if (this.synth.isLFOAssigned(channelIndex, effectIndex, param.name)) {
                modBtn.classList.add('active');
                const assignment = this.synth.getLFOAssignment(channelIndex, effectIndex, param.name);
                modBtn.textContent = `LFO ${assignment.lfoIndex + 1}`;
            }
            
            modBtn.addEventListener('click', () => {
                this.showModPanel(paramDiv, channelIndex, effectIndex, param, modBtn);
            });
            
            label.appendChild(modBtn);
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = param.min;
            slider.max = param.max;
            slider.step = param.step;
            slider.value = currentValue;
            slider.className = 'param-slider';
            
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                valueSpan.textContent = this.formatParamValue(value, param.step);
                this.synth.setEffectParam(channelIndex, effectIndex, param.name, value);
                this.saveToLocalStorage();
            });
            
            paramDiv.appendChild(label);
            paramDiv.appendChild(slider);
            paramContainer.appendChild(paramDiv);
        });
    }
    
    /**
     * Show modulation assignment panel for an effect parameter
     */
    showModPanel(paramDiv, channelIndex, effectIndex, param, modBtn) {
        // Remove existing mod panels
        document.querySelectorAll('.mod-panel').forEach(p => p.remove());
        
        // Check if already assigned
        const existingAssignment = this.synth.getLFOAssignment(channelIndex, effectIndex, param.name);
        
        const panel = document.createElement('div');
        panel.className = 'mod-panel';
        
        if (existingAssignment) {
            // Show unassign option
            panel.innerHTML = `
                <label>LFO ${existingAssignment.lfoIndex + 1} is modulating this parameter</label>
                <button class="btn-cancel">Unassign</button>
            `;
            panel.querySelector('.btn-cancel').addEventListener('click', () => {
                this.synth.unassignLFOFromEffectParam(channelIndex, effectIndex, param.name);
                modBtn.textContent = 'Mod';
                modBtn.classList.remove('active');
                panel.remove();
            });
        } else {
            // Show assignment options
            const label = document.createElement('label');
            label.textContent = 'Assign LFO:';
            panel.appendChild(label);
            
            const lfoSelect = document.createElement('select');
            lfoSelect.innerHTML = `
                <option value="0">LFO 1</option>
                <option value="1">LFO 2</option>
                <option value="2">LFO 3</option>
            `;
            panel.appendChild(lfoSelect);
            
            const rangeLabel = document.createElement('label');
            rangeLabel.textContent = 'Modulation Range:';
            panel.appendChild(rangeLabel);
            
            const minSlider = document.createElement('input');
            minSlider.type = 'range';
            minSlider.min = param.min;
            minSlider.max = param.max;
            minSlider.value = param.min;
            minSlider.step = param.step;
            panel.appendChild(minSlider);
            
            const minDisplay = document.createElement('div');
            minDisplay.textContent = `Min: ${param.min}`;
            panel.appendChild(minDisplay);
            
            const maxSlider = document.createElement('input');
            maxSlider.type = 'range';
            maxSlider.min = param.min;
            maxSlider.max = param.max;
            maxSlider.value = param.max;
            maxSlider.step = param.step;
            panel.appendChild(maxSlider);
            
            const maxDisplay = document.createElement('div');
            maxDisplay.textContent = `Max: ${param.max}`;
            panel.appendChild(maxDisplay);
            
            minSlider.addEventListener('input', () => {
                minDisplay.textContent = `Min: ${minSlider.value}`;
            });
            
            maxSlider.addEventListener('input', () => {
                maxDisplay.textContent = `Max: ${maxSlider.value}`;
            });
            
            const btnAssign = document.createElement('button');
            btnAssign.className = 'btn-assign';
            btnAssign.textContent = 'Assign';
            btnAssign.addEventListener('click', () => {
                const lfoIndex = parseInt(lfoSelect.value);
                const min = parseFloat(minSlider.value);
                const max = parseFloat(maxSlider.value);
                
                const success = this.synth.assignLFOToEffectParam(
                    lfoIndex, channelIndex, effectIndex, param.name, min, max, true
                );
                
                if (success) {
                    modBtn.textContent = `LFO ${lfoIndex + 1}`;
                    modBtn.classList.add('active');
                }
                
                panel.remove();
            });
            panel.appendChild(btnAssign);
            
            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn-cancel';
            btnCancel.textContent = 'Cancel';
            btnCancel.addEventListener('click', () => panel.remove());
            panel.appendChild(btnCancel);
        }
        
        paramDiv.appendChild(panel);
    }

    /**
     * Add a Mod button to a control slider's label
     */
    addModButtonToControl(slider, channelIndex, paramName, paramDef) {
        const label = slider.previousElementSibling;
        if (!label || label.tagName !== 'LABEL') return;
        
        const modBtn = document.createElement('button');
        modBtn.className = 'mod-button';
        modBtn.textContent = 'Mod';
        modBtn.title = 'Assign LFO modulation';
        
        // Check if already modulated
        if (this.synth.isChannelLFOAssigned(channelIndex, paramName)) {
            modBtn.classList.add('active');
            const assignment = this.synth.getChannelLFOAssignment(channelIndex, paramName);
            modBtn.textContent = `LFO ${assignment.lfoIndex + 1}`;
        }
        
        modBtn.addEventListener('click', () => {
            this.showChannelModPanel(slider.parentElement, channelIndex, paramName, paramDef, modBtn);
        });
        
        label.appendChild(modBtn);
    }
    
    /**
     * Show modulation assignment panel for a channel parameter
     */
    showChannelModPanel(container, channelIndex, paramName, paramDef, modBtn) {
        // Remove existing mod panels
        document.querySelectorAll('.mod-panel').forEach(p => p.remove());
        
        const existingAssignment = this.synth.getChannelLFOAssignment(channelIndex, paramName);
        const panel = document.createElement('div');
        panel.className = 'mod-panel';
        
        // Use current slider values for ranges if possible
        const slider = container.querySelector('input[type="range"]');
        const minVal = slider ? parseFloat(slider.min) : paramDef.min;
        const maxVal = slider ? parseFloat(slider.max) : paramDef.max;
        const stepVal = slider ? parseFloat(slider.step) : paramDef.step;
        
        if (existingAssignment) {
            panel.innerHTML = `
                <label>LFO ${existingAssignment.lfoIndex + 1} is modulating this parameter</label>
                <button class="btn-cancel">Unassign</button>
            `;
            panel.querySelector('.btn-cancel').addEventListener('click', () => {
                this.synth.unassignLFOFromChannelParam(channelIndex, paramName);
                modBtn.textContent = 'Mod';
                modBtn.classList.remove('active');
                panel.remove();
            });
        } else {
            const label = document.createElement('label');
            label.textContent = 'Assign LFO:';
            panel.appendChild(label);
            
            const lfoSelect = document.createElement('select');
            lfoSelect.innerHTML = `
                <option value="0">LFO 1</option>
                <option value="1">LFO 2</option>
                <option value="2">LFO 3</option>
            `;
            panel.appendChild(lfoSelect);
            
            // Min/Max range for modulation
            const minLabel = document.createElement('label');
            minLabel.textContent = 'Min Value:';
            panel.appendChild(minLabel);
            
            const minSlider = document.createElement('input');
            minSlider.type = 'range';
            minSlider.min = minVal;
            minSlider.max = maxVal;
            minSlider.value = minVal;
            minSlider.step = stepVal;
            panel.appendChild(minSlider);
            
            const minDisplay = document.createElement('div');
            minDisplay.textContent = `Min: ${minVal}`;
            panel.appendChild(minDisplay);
            
            const maxLabel = document.createElement('label');
            maxLabel.textContent = 'Max Value:';
            panel.appendChild(maxLabel);
            
            const maxSlider = document.createElement('input');
            maxSlider.type = 'range';
            maxSlider.min = minVal;
            maxSlider.max = maxVal;
            maxSlider.value = maxVal;
            maxSlider.step = stepVal;
            panel.appendChild(maxSlider);
            
            const maxDisplay = document.createElement('div');
            maxDisplay.textContent = `Max: ${maxVal}`;
            panel.appendChild(maxDisplay);
            
            minSlider.addEventListener('input', () => {
                minDisplay.textContent = `Min: ${minSlider.value}`;
            });
            
            maxSlider.addEventListener('input', () => {
                maxDisplay.textContent = `Max: ${maxSlider.value}`;
            });
            
            const btnAssign = document.createElement('button');
            btnAssign.className = 'btn-assign';
            btnAssign.textContent = 'Assign';
            btnAssign.addEventListener('click', () => {
                const lfoIndex = parseInt(lfoSelect.value);
                let min = parseFloat(minSlider.value);
                let max = parseFloat(maxSlider.value);
                
                // For volume and duty, values are 0-100 in UI but 0-1 in engine
                if (paramDef.isPercent) {
                    min /= 100;
                    max /= 100;
                }
                
                const success = this.synth.assignLFOToChannelParam(
                    lfoIndex, channelIndex, paramName, min, max, true
                );
                
                if (success) {
                    modBtn.textContent = `LFO ${lfoIndex + 1}`;
                    modBtn.classList.add('active');
                }
                
                panel.remove();
            });
            panel.appendChild(btnAssign);
            
            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn-cancel';
            btnCancel.textContent = 'Cancel';
            btnCancel.addEventListener('click', () => panel.remove());
            panel.appendChild(btnCancel);
        }
        
        container.appendChild(panel);
    }

    /**
     * Format parameter value for display
     */
    formatParamValue(value, step) {
        if (typeof value !== 'number') return value;
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
            this.saveToLocalStorage();
        });
        
        // Set up LFO controls
        this.setupLFOControls();
    }
    
    /**
     * Set up LFO controls
     */
    setupLFOControls() {
        // LFO Rate controls
        document.querySelectorAll('.lfo-rate').forEach(slider => {
            const lfoIndex = parseInt(slider.dataset.lfo);
            const display = document.querySelector(`.lfo${lfoIndex + 1}-rate-val`);
            
            slider.addEventListener('input', (e) => {
                const rate = parseFloat(e.target.value);
                console.log(`UI: LFO ${lfoIndex} rate changed to ${rate}`);
                if (display) display.textContent = rate.toFixed(1);
                this.synth.setLFORate(lfoIndex, rate);
                this.saveToLocalStorage();
            });
        });
        
        // LFO Depth controls
        document.querySelectorAll('.lfo-depth').forEach(slider => {
            const lfoIndex = parseInt(slider.dataset.lfo);
            const display = document.querySelector(`.lfo${lfoIndex + 1}-depth-val`);
            
            slider.addEventListener('input', (e) => {
                const depth = parseFloat(e.target.value) / 100;
                if (display) display.textContent = Math.round(depth * 100);
                this.synth.setLFODepth(lfoIndex, depth);
                this.saveToLocalStorage();
            });
        });
        
        // LFO Waveform controls
        document.querySelectorAll('.lfo-waveform').forEach(select => {
            const lfoIndex = parseInt(select.dataset.lfo);
            
            select.addEventListener('change', (e) => {
                this.synth.setLFOWaveform(lfoIndex, e.target.value);
                this.saveToLocalStorage();
            });
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
        
        this.saveToLocalStorage();
    }

    /**
     * Set up MIDI controls
     */
    setupMIDIControls() {
        const midiInitBtn = document.getElementById('midi-init-btn');
        const midiSelect = document.getElementById('midi-device-select');
        const midiLed = document.getElementById('midi-led');
        const midiStatusText = document.querySelector('.midi-status-text');
        
        if (!midiInitBtn || !window.midi) return;
        
        // Check for secure context (required for Web MIDI)
        if (!window.isSecureContext) {
            console.warn('Web MIDI requires HTTPS or localhost');
            midiStatusText.textContent = 'MIDI requires HTTPS';
            midiLed.classList.add('error');
        }
        
        const midi = window.midi;
        
        // Initialize button click
        midiInitBtn.addEventListener('click', async () => {
            try {
                midiInitBtn.disabled = true;
                midiInitBtn.textContent = 'Initializing...';
                
                console.log('Requesting MIDI access...');
                const devices = await midi.init();
                console.log('MIDI devices found:', devices);
                
                // Populate device select
                midiSelect.innerHTML = '<option value="">-- Select Device --</option>';
                devices.forEach(device => {
                    console.log('Adding device to list:', device);
                    const option = document.createElement('option');
                    option.value = device.id;
                    option.textContent = `${device.name} (${device.manufacturer})`;
                    midiSelect.appendChild(option);
                });
                
                // Enable select if devices found
                if (devices.length > 0) {
                    midiSelect.disabled = false;
                    midiInitBtn.textContent = 'MIDI Enabled';
                    
                    // Auto-connect if Novation device found
                    const novation = devices.find(d => 
                        d.name.toLowerCase().includes('novation')
                    );
                    if (novation) {
                        midiSelect.value = novation.id;
                        connectToDevice(novation.id);
                    }
                } else {
                    midiInitBtn.textContent = 'No MIDI Devices';
                    midiStatusText.textContent = 'No devices found. Is your controller connected?';
                    midiLed.classList.add('error');
                    console.log('No MIDI input devices found. Check browser console for details.');
                }
                
            } catch (error) {
                console.error('MIDI init failed:', error);
                midiInitBtn.textContent = 'MIDI Error';
                midiStatusText.textContent = error.message || 'Failed to initialize MIDI';
                midiLed.classList.add('error');
            }
        });
        
        // Device selection
        const connectToDevice = (deviceId) => {
            if (!deviceId) {
                midi.disconnect();
                return;
            }
            
            const success = midi.connect(deviceId);
            if (success) {
                const device = midi.getDevices().find(d => d.id === deviceId);
                midiStatusText.textContent = `Connected: ${device ? device.name : 'Unknown'}`;
                midiLed.classList.add('connected');
                midiInitBtn.classList.add('connected');
                midiInitBtn.textContent = 'MIDI Connected';
            }
        };
        
        midiSelect.addEventListener('change', (e) => {
            connectToDevice(e.target.value);
        });
        
        // Set up callbacks for UI updates
        midi.onDeviceListChanged = (devices) => {
            const currentValue = midiSelect.value;
            midiSelect.innerHTML = '<option value="">-- Select Device --</option>';
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = `${device.name} (${device.manufacturer})`;
                midiSelect.appendChild(option);
            });
            // Restore selection if still available
            if (currentValue && devices.find(d => d.id === currentValue)) {
                midiSelect.value = currentValue;
            }
        };
        
        midi.onStatusChanged = (status, deviceName) => {
            if (status === 'disconnected') {
                midiLed.classList.remove('connected');
                midiStatusText.textContent = 'Disconnected';
                midiInitBtn.classList.remove('connected');
                midiInitBtn.textContent = 'Enable MIDI';
                midiSelect.value = '';
            }
        };
        
        // Activity indicators
        const activityCC = document.getElementById('activity-cc');
        const activityNote = document.getElementById('activity-note');
        const activityPitch = document.getElementById('activity-pitch');
        
        const activityTimers = {};
        
        const flashActivity = (element) => {
            if (!element) return;
            element.classList.add('active');
            
            if (activityTimers[element.id]) {
                clearTimeout(activityTimers[element.id]);
            }
            
            activityTimers[element.id] = setTimeout(() => {
                element.classList.remove('active');
            }, 100);
        };
        
        midi.onMIDIMessage = (status, data1, data2) => {
            const messageType = status & 0xF0;
            
            switch (messageType) {
                case 0xB0: // CC
                    flashActivity(activityCC);
                    break;
                case 0x90: // Note On
                case 0x80: // Note Off
                    flashActivity(activityNote);
                    break;
                case 0xE0: // Pitch Bend
                    flashActivity(activityPitch);
                    break;
            }
        };
    }

    /**
     * Set up the audio visualizer with toggle between waveform and spectrum
     */
    setupVisualizer() {
        const canvas = document.getElementById('visualizer');
        const ctx = canvas.getContext('2d');
        const toggleBtn = document.getElementById('vis-toggle');
        
        // Mode: 'waveform' or 'spectrum'
        let mode = 'waveform';
        
        toggleBtn.addEventListener('click', () => {
            mode = mode === 'waveform' ? 'spectrum' : 'waveform';
            toggleBtn.textContent = mode === 'waveform' ? '📊 Spectrum' : '〰️ Waveform';
        });
        
        const drawWaveform = (analyser, dataArray, bufferLength) => {
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
        
        const drawSpectrum = (analyser, dataArray, bufferLength) => {
            const barCount = 64;
            const barWidth = canvas.width / barCount;
            const binStep = Math.floor(bufferLength / barCount);
            
            // Draw spectrum bars
            for (let i = 0; i < barCount; i++) {
                const binIndex = i * binStep;
                const value = dataArray[binIndex];
                const percent = value / 255;
                const barHeight = percent * canvas.height;
                
                // Color based on frequency (low = red, mid = cyan, high = pink)
                const hue = 180 + (i / barCount) * 160; // 180-340 (cyan to pink/red)
                ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
                
                // Draw bar from bottom
                const x = i * barWidth;
                const y = canvas.height - barHeight;
                ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
            }
            
            // Add glow effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#e94560';
        };
        
        this.drawVisualizer = () => {
            // Check if audio is actually started before continuing
            if (!this.synth.isAudioStarted) {
                this.visFrameRequest = null;
                // Final clear
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                return;
            }

            this.visFrameRequest = requestAnimationFrame(this.drawVisualizer);
            
            const analyser = this.synth.getAnalyser();
            if (!analyser) {
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.shadowBlur = 0;
                return;
            }
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            // Clear canvas
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.shadowBlur = 0;
            
            if (mode === 'waveform') {
                analyser.getByteTimeDomainData(dataArray);
                drawWaveform(analyser, dataArray, bufferLength);
            } else {
                analyser.getByteFrequencyData(dataArray);
                drawSpectrum(analyser, dataArray, bufferLength);
            }

            // Update LFO visualization
            this.updateLFOMeters();
        };
        
        this.drawVisualizer();
    }

    /**
     * Update LFO visual indicators
     */
    updateLFOMeters() {
        if (!this.synth.lfos) return;
        
        this.synth.lfos.forEach((lfo, i) => {
            const meter = document.querySelector(`.lfo-meter[data-lfo="${i}"]`);
            if (meter) {
                // Map -1..1 to 0..100%
                const percent = (lfo.currentValue + 1) * 50;
                meter.style.width = `${percent}%`;
            }
        });
    }

    /**
     * Initialize MIDI Learn for a control
     */
    initMIDILearn(target, element) {
        if (!this.synth.midi || !this.synth.midi.enabled) {
            this.showToast('Please connect a MIDI device first', 'error');
            return;
        }

        element.classList.add('midi-learning');
        this.showMIDILearnOverlay(target.param);
        
        this.synth.midi.startLearn(target);
        this.synth.midi.onLearnComplete = (cc, completedTarget) => {
            element.classList.remove('midi-learning');
            element.classList.add('midi-mapped');
            this.hideMIDILearnOverlay();
            this.showToast(`Mapped CC ${cc} to ${completedTarget.param}`, 'success');
            
            // Save mappings to local storage as well
            const mappings = this.synth.midi.getMappings();
            localStorage.setItem('tone-generator-midi-mappings', JSON.stringify(mappings));
            
            setTimeout(() => element.classList.remove('midi-mapped'), 2000);
        };
    }

    showMIDILearnOverlay(paramName) {
        let overlay = document.getElementById('midi-learn-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'midi-learn-overlay';
            overlay.innerHTML = `
                <div class="midi-learn-content">
                    <div class="midi-icon">🎹</div>
                    <h3>MIDI LEARN</h3>
                    <p>Move a knob or slider to map <span class="param-name"></span></p>
                    <button id="cancel-midi-learn">Cancel</button>
                </div>
            `;
            document.body.appendChild(overlay);
            
            document.getElementById('cancel-midi-learn').addEventListener('click', () => {
                this.synth.midi.stopLearn();
                this.hideMIDILearnOverlay();
                document.querySelectorAll('.midi-learning').forEach(el => el.classList.remove('midi-learning'));
            });
        }
        
        overlay.querySelector('.param-name').textContent = paramName;
        overlay.classList.add('active');
    }

    hideMIDILearnOverlay() {
        const overlay = document.getElementById('midi-learn-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIManager };
}
