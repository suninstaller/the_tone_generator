/**
 * MIDI Controller Module
 * Handles Web MIDI API integration for hardware control
 * Optimized for Novation 25SL MKII in standard MIDI mode (no Automap)
 */

class MIDIController {
    /**
     * Create a MIDI controller instance
     * @param {SynthEngine} synthEngine - The synthesizer engine to control
     */
    constructor(synthEngine) {
        this.synth = synthEngine;
        this.midiAccess = null;
        this.input = null;
        this.enabled = false;
        this.devices = [];
        
        // Activity tracking for visual feedback
        this.activityTimers = {};
        
        // Default CC mappings for Novation 25SL MKII
        // These can be customized via setMapping()
        this.defaultMappings = {
            // CC 1: Mod Wheel → Master volume
            1: { type: 'master', param: 'volume' },
            
            // CC 7-10: Channel volumes (channels 1-4)
            7: { type: 'channel', channel: 0, param: 'volume' },
            8: { type: 'channel', channel: 1, param: 'volume' },
            9: { type: 'channel', channel: 2, param: 'volume' },
            10: { type: 'channel', channel: 3, param: 'volume' },
            
            // CC 11-14: Channel frequencies
            11: { type: 'channel', channel: 0, param: 'frequency' },
            12: { type: 'channel', channel: 1, param: 'frequency' },
            13: { type: 'channel', channel: 2, param: 'frequency' },
            14: { type: 'channel', channel: 3, param: 'frequency' },
            
            // CC 16-23: Effect parameters
            16: { type: 'effect', channel: 0, effectIndex: 0, param: 'mix' },
            17: { type: 'effect', channel: 0, effectIndex: 1, param: 'mix' },
            18: { type: 'effect', channel: 1, effectIndex: 0, param: 'mix' },
            19: { type: 'effect', channel: 1, effectIndex: 1, param: 'mix' },
            20: { type: 'effect', channel: 2, effectIndex: 0, param: 'mix' },
            21: { type: 'effect', channel: 2, effectIndex: 1, param: 'mix' },
            22: { type: 'effect', channel: 3, effectIndex: 0, param: 'mix' },
            23: { type: 'effect', channel: 3, effectIndex: 1, param: 'mix' },
            
            // CC 74: Filter/Resonance → Comb filter frequency if active
            74: { type: 'globalEffect', param: 'filter' }
        };
        
        // User can override these
        this.mappings = { ...this.defaultMappings };
        
        // Pitch bend configuration
        this.pitchBendRange = 2; // semitones
        
        // Callbacks for UI updates
        this.onDeviceListChanged = null;
        this.onStatusChanged = null;
        this.onMIDIMessage = null;
        
        // Bind methods
        this.handleMessage = this.handleMessage.bind(this);
    }
    
    /**
     * Initialize MIDI access and list available devices
     * @returns {Promise<Array>} List of available MIDI input devices
     */
    async init() {
        if (!navigator.requestMIDIAccess) {
            throw new Error('Web MIDI API not supported in this browser');
        }
        
        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            this.updateDeviceList();
            
            // Listen for device changes
            this.midiAccess.onstatechange = (event) => {
                this.updateDeviceList();
                if (this.onDeviceListChanged) {
                    this.onDeviceListChanged(this.devices);
                }
                
                // If the connected device was disconnected, clean up
                if (event.port.type === 'input' && event.port.state === 'disconnected') {
                    if (this.input && this.input.id === event.port.id) {
                        this.disconnect();
                    }
                }
            };
            
            return this.devices;
            
        } catch (error) {
            console.error('Failed to access MIDI:', error);
            throw error;
        }
    }
    
    /**
     * Update the list of available MIDI devices
     */
    updateDeviceList() {
        this.devices = [];
        if (!this.midiAccess) return;
        
        for (let input of this.midiAccess.inputs.values()) {
            this.devices.push({
                id: input.id,
                name: input.name || 'Unknown Device',
                manufacturer: input.manufacturer || 'Unknown',
                state: input.state,
                connection: input.connection
            });
        }
    }
    
    /**
     * Get the list of available MIDI devices
     * @returns {Array} List of MIDI input devices
     */
    getDevices() {
        return this.devices;
    }
    
    /**
     * Connect to a specific MIDI device
     * @param {string} deviceId - The MIDI device ID to connect to
     * @returns {boolean} True if connected successfully
     */
    connect(deviceId) {
        if (!this.midiAccess) {
            console.error('MIDI not initialized');
            return false;
        }
        
        // Disconnect from current device if any
        this.disconnect();
        
        // Find the device
        for (let input of this.midiAccess.inputs.values()) {
            if (input.id === deviceId) {
                this.input = input;
                this.input.onmidimessage = this.handleMessage;
                this.enabled = true;
                
                console.log(`Connected to MIDI device: ${input.name}`);
                
                if (this.onStatusChanged) {
                    this.onStatusChanged('connected', input.name);
                }
                
                return true;
            }
        }
        
        console.error('MIDI device not found:', deviceId);
        return false;
    }
    
    /**
     * Connect to the first available Novation device (auto-detect)
     * @returns {boolean} True if connected successfully
     */
    connectToNovation() {
        const novationDevice = this.devices.find(d => 
            d.name.toLowerCase().includes('novation') ||
            d.name.toLowerCase().includes('25sl') ||
            d.name.toLowerCase().includes('sl mkii')
        );
        
        if (novationDevice) {
            return this.connect(novationDevice.id);
        }
        
        // If no Novation device, connect to first available
        if (this.devices.length > 0) {
            return this.connect(this.devices[0].id);
        }
        
        return false;
    }
    
    /**
     * Disconnect from the current MIDI device
     */
    disconnect() {
        if (this.input) {
            this.input.onmidimessage = null;
            this.input = null;
        }
        this.enabled = false;
        
        if (this.onStatusChanged) {
            this.onStatusChanged('disconnected', null);
        }
    }
    
    /**
     * Handle incoming MIDI messages
     * @param {MIDIMessageEvent} event - The MIDI message event
     */
    handleMessage(event) {
        const [status, data1, data2] = event.data;
        
        // Notify UI of activity
        if (this.onMIDIMessage) {
            this.onMIDIMessage(status, data1, data2);
        }
        
        // Parse status byte
        const messageType = status & 0xF0;
        const channel = (status & 0x0F) + 1; // 1-16 (we ignore channel for simplicity)
        
        switch (messageType) {
            case 0x80: // Note Off
                this.handleNoteOff(data1, data2);
                break;
                
            case 0x90: // Note On
                if (data2 === 0) {
                    this.handleNoteOff(data1, data2);
                } else {
                    this.handleNoteOn(data1, data2);
                }
                break;
                
            case 0xB0: // Control Change (CC)
                this.handleCC(data1, data2);
                break;
                
            case 0xE0: // Pitch Bend
                this.handlePitchBend(data1, data2);
                break;
                
            default:
                // Ignore other message types
                break;
        }
    }
    
    /**
     * Handle Note On messages
     * @param {number} note - MIDI note number (0-127)
     * @param {number} velocity - Note velocity (0-127)
     */
    handleNoteOn(note, velocity) {
        // Convert note to frequency
        const frequency = this.midiNoteToFrequency(note);
        const normalizedVelocity = velocity / 127;
        
        // Map notes to channels based on octave
        // C2-C3 (36-48) → Channel 1
        // C3-C4 (48-60) → Channel 2
        // C4-C5 (60-72) → Channel 3
        // C5-C6 (72-84) → Channel 4
        
        let targetChannel = -1;
        if (note >= 36 && note < 48) targetChannel = 0;
        else if (note >= 48 && note < 60) targetChannel = 1;
        else if (note >= 60 && note < 72) targetChannel = 2;
        else if (note >= 72 && note < 84) targetChannel = 3;
        
        if (targetChannel >= 0 && this.synth) {
            // Set frequency and enable channel
            this.synth.setChannelFrequency(targetChannel, frequency);
            this.synth.setChannelEnabled(targetChannel, true);
            
            // Also set velocity as volume (optional, can be disabled)
            // this.synth.setChannelVolume(targetChannel, normalizedVelocity);
            
            // Update UI to reflect changes
            this.updateUIForChannel(targetChannel, frequency, true);
        }
    }
    
    /**
     * Handle Note Off messages
     * @param {number} note - MIDI note number (0-127)
     * @param {number} velocity - Note velocity (0-127)
     */
    handleNoteOff(note, velocity) {
        // Determine which channel to turn off
        let targetChannel = -1;
        if (note >= 36 && note < 48) targetChannel = 0;
        else if (note >= 48 && note < 60) targetChannel = 1;
        else if (note >= 60 && note < 72) targetChannel = 2;
        else if (note >= 72 && note < 84) targetChannel = 3;
        
        if (targetChannel >= 0 && this.synth) {
            this.synth.setChannelEnabled(targetChannel, false);
            this.updateUIForChannel(targetChannel, null, false);
        }
    }
    
    /**
     * Handle Control Change (CC) messages
     * @param {number} ccNumber - CC number (0-127)
     * @param {number} value - CC value (0-127)
     */
    handleCC(ccNumber, value) {
        const mapping = this.mappings[ccNumber];
        if (!mapping) return;
        
        const normalizedValue = value / 127;
        
        switch (mapping.type) {
            case 'master':
                this.handleMasterCC(mapping.param, normalizedValue, value);
                break;
                
            case 'channel':
                this.handleChannelCC(mapping.channel, mapping.param, normalizedValue, value);
                break;
                
            case 'effect':
                this.handleEffectCC(mapping.channel, mapping.effectIndex, mapping.param, normalizedValue);
                break;
                
            case 'globalEffect':
                this.handleGlobalEffectCC(mapping.param, normalizedValue, value);
                break;
        }
    }
    
    /**
     * Handle master-level CC messages
     */
    handleMasterCC(param, normalizedValue, rawValue) {
        if (!this.synth) return;
        
        switch (param) {
            case 'volume':
                this.synth.setMasterVolume(normalizedValue);
                this.updateUIControl('master-volume', Math.round(normalizedValue * 100));
                break;
        }
    }
    
    /**
     * Handle channel-level CC messages
     */
    handleChannelCC(channel, param, normalizedValue, rawValue) {
        if (!this.synth) return;
        
        switch (param) {
            case 'volume':
                this.synth.setChannelVolume(channel, normalizedValue);
                this.updateUIControl(`channel[data-channel="${channel}"] .volume`, Math.round(normalizedValue * 100));
                break;
                
            case 'frequency':
                // Map 0-127 to 20-2000 Hz (logarithmic for better control)
                const minFreq = 20;
                const maxFreq = 2000;
                const freq = minFreq * Math.pow(maxFreq / minFreq, normalizedValue);
                this.synth.setChannelFrequency(channel, freq);
                this.updateUIControl(`channel[data-channel="${channel}"] .frequency`, Math.round(freq));
                break;
        }
    }
    
    /**
     * Handle effect-level CC messages
     */
    handleEffectCC(channel, effectIndex, param, normalizedValue) {
        if (!this.synth) return;
        
        this.synth.setEffectParam(channel, effectIndex, param, normalizedValue);
    }
    
    /**
     * Handle global effect CC messages
     */
    handleGlobalEffectCC(param, normalizedValue, rawValue) {
        // For filter/resonance, apply to any active comb filters
        if (param === 'filter') {
            const freq = 100 + normalizedValue * 7900; // 100-8000 Hz
            
            // Apply to all channels' comb filters if they exist
            for (let channel = 0; channel < 4; channel++) {
                for (let effectIndex = 0; effectIndex < 3; effectIndex++) {
                    try {
                        this.synth.setEffectParam(channel, effectIndex, 'frequency', freq);
                    } catch (e) {
                        // Effect might not exist or doesn't have frequency param
                    }
                }
            }
        }
    }
    
    /**
     * Handle Pitch Bend messages
     * @param {number} lsb - Least significant byte (0-127)
     * @param {number} msb - Most significant byte (0-127)
     */
    handlePitchBend(lsb, msb) {
        // Combine into 14-bit value
        const value = (msb << 7) | lsb;
        const normalized = (value - 8192) / 8192; // -1 to +1
        
        if (!this.synth) return;
        
        // Apply pitch bend to all enabled channels
        // This is a simplified approach - in a real synth you'd track note state
        for (let channel = 0; channel < 4; channel++) {
            if (this.synth.channelSettings[channel].enabled) {
                // Calculate pitch bend factor
                // ±2 semitones = multiply by 2^(bend/12)
                const bendSemitones = normalized * this.pitchBendRange;
                const bendFactor = Math.pow(2, bendSemitones / 12);
                
                // Get current frequency and apply bend
                const currentFreq = this.getCurrentFrequency(channel);
                if (currentFreq) {
                    this.synth.setChannelFrequency(channel, currentFreq * bendFactor);
                }
            }
        }
    }
    
    /**
     * Get the current frequency for a channel (from UI)
     */
    getCurrentFrequency(channel) {
        const slider = document.querySelector(`.channel[data-channel="${channel}"] .frequency`);
        if (slider) {
            return parseFloat(slider.value);
        }
        return null;
    }
    
    /**
     * Update a UI control to reflect MIDI changes
     */
    updateUIControl(selector, value) {
        // Use requestAnimationFrame to avoid blocking MIDI processing
        requestAnimationFrame(() => {
            const element = document.querySelector(selector);
            if (element) {
                element.value = value;
                // Trigger input event to update displays
                element.dispatchEvent(new Event('input'));
            }
        });
    }
    
    /**
     * Update UI for channel state changes
     */
    updateUIForChannel(channel, frequency, enabled) {
        requestAnimationFrame(() => {
            const channelEl = document.querySelector(`.channel[data-channel="${channel}"]`);
            if (!channelEl) return;
            
            const onToggle = channelEl.querySelector('.channel-on');
            if (onToggle) {
                onToggle.checked = enabled;
                onToggle.dispatchEvent(new Event('change'));
            }
            
            if (frequency !== null) {
                const freqSlider = channelEl.querySelector('.frequency');
                if (freqSlider) {
                    freqSlider.value = Math.round(frequency);
                    freqSlider.dispatchEvent(new Event('input'));
                }
            }
        });
    }
    
    /**
     * Set a custom CC mapping
     * @param {number} ccNumber - CC number (0-127)
     * @param {Object} target - Target configuration
     */
    setMapping(ccNumber, target) {
        this.mappings[ccNumber] = target;
    }
    
    /**
     * Remove a CC mapping
     * @param {number} ccNumber - CC number to unmap
     */
    removeMapping(ccNumber) {
        delete this.mappings[ccNumber];
    }
    
    /**
     * Get current mappings
     * @returns {Object} Current CC mappings
     */
    getMappings() {
        return { ...this.mappings };
    }
    
    /**
     * Reset to default mappings
     */
    resetMappings() {
        this.mappings = { ...this.defaultMappings };
    }
    
    /**
     * Convert MIDI note number to frequency
     * @param {number} note - MIDI note number (0-127)
     * @returns {number} Frequency in Hz
     */
    midiNoteToFrequency(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }
    
    /**
     * Check if MIDI is supported
     * @returns {boolean}
     */
    static isSupported() {
        return !!navigator.requestMIDIAccess;
    }
    
    /**
     * Get status of the MIDI controller
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            enabled: this.enabled,
            connected: this.input !== null,
            deviceName: this.input ? this.input.name : null,
            deviceCount: this.devices.length
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MIDIController };
}
