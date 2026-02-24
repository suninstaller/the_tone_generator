/**
 * GrainPlayer AudioWorklet Processor
 * 
 * Granular synthesis engine for time stretching.
 * Splits input into small grains and plays them back at different rates
 * using overlap-add for smooth transitions.
 */

class GrainPlayerProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            {
                name: 'speed',
                defaultValue: 1.0,
                minValue: 0.25,
                maxValue: 4.0,
                automationRate: 'k-rate'
            },
            {
                name: 'grainSize',
                defaultValue: 0.1,  // 100ms in seconds
                minValue: 0.02,     // 20ms
                maxValue: 0.5,      // 500ms
                automationRate: 'k-rate'
            },
            {
                name: 'overlap',
                defaultValue: 0.25,
                minValue: 0.1,
                maxValue: 0.75,
                automationRate: 'k-rate'
            },
            {
                name: 'pitchCompensation',
                defaultValue: 1.0,
                minValue: 0.0,
                maxValue: 1.0,
                automationRate: 'k-rate'
            },
            {
                name: 'mix',
                defaultValue: 1.0,
                minValue: 0.0,
                maxValue: 1.0,
                automationRate: 'k-rate'
            },
            {
                name: 'bufferSize',
                defaultValue: 2.0,  // 2 seconds
                minValue: 0.5,
                maxValue: 5.0,
                automationRate: 'k-rate'
            }
        ];
    }

    constructor(options) {
        super();
        
        // Get sample rate from options
        this.sampleRate = options.processorOptions?.sampleRate || 48000;
        
        // Buffer settings (2 seconds default at 48kHz = 96000 samples)
        this.maxBufferSamples = Math.ceil(5.0 * this.sampleRate); // 5 seconds max
        this.bufferSize = Math.ceil(2.0 * this.sampleRate); // Start with 2 seconds
        
        // Circular buffer for input storage
        this.buffer = [new Float32Array(this.maxBufferSamples), new Float32Array(this.maxBufferSamples)];
        this.writeIndex = 0;
        this.bufferReady = false;
        this.bufferFillCount = 0;
        
        // Grain players (4 overlapping grains for smooth sound)
        this.numGrains = 4;
        this.grains = [];
        for (let i = 0; i < this.numGrains; i++) {
            this.grains.push({
                readPosition: 0,
                active: false,
                phase: 0,  // 0 to 1 for window function
                channel: 0 // 0 = left, 1 = right
            });
        }
        
        // Current grain scheduling
        this.nextGrainTime = 0;
        this.grainInterval = 0;
        
        // Pitch compensation delay line (simple resampling buffer)
        this.pitchBufferSize = 4096;
        this.pitchBuffer = [new Float32Array(this.pitchBufferSize), new Float32Array(this.pitchBufferSize)];
        this.pitchWriteIdx = 0;
        this.pitchReadIdx = 0;
        
        // For tracking sample-accurate timing
        this.sampleTime = 0;
        
        // Smooth parameter values
        this.smoothedSpeed = 1.0;
        this.smoothedGrainSize = 0.1;
        this.smoothedOverlap = 0.25;
        this.smoothCoeff = 0.01; // Smoothing coefficient
        
        // Message handling from main thread
        this.port.onmessage = (event) => {
            if (event.data.type === 'reset') {
                this.resetBuffer();
            }
        };
    }
    
    resetBuffer() {
        // Clear buffers
        for (let ch = 0; ch < 2; ch++) {
            this.buffer[ch].fill(0);
            this.pitchBuffer[ch].fill(0);
        }
        this.writeIndex = 0;
        this.bufferReady = false;
        this.bufferFillCount = 0;
        this.pitchWriteIdx = 0;
        this.pitchReadIdx = 0;
        this.sampleTime = 0;
        
        // Reset grains
        for (let grain of this.grains) {
            grain.active = false;
            grain.phase = 0;
        }
        this.nextGrainTime = 0;
    }
    
    /**
     * Hann window function for smooth grain envelope
     * Prevents clicks and creates smooth overlap-add
     */
    hannWindow(phase) {
        // phase: 0 to 1
        return 0.5 * (1 - Math.cos(2 * Math.PI * phase));
    }
    
    /**
     * Cosine window for even smoother results
     */
    cosineWindow(phase) {
        return Math.cos(Math.PI * (phase - 0.5));
    }
    
    /**
     * Linear interpolation for reading from buffer
     */
    readBuffer(channel, position) {
        const intPos = Math.floor(position);
        const frac = position - intPos;
        const idx1 = intPos % this.bufferSize;
        const idx2 = (intPos + 1) % this.bufferSize;
        
        const s1 = this.buffer[channel][idx1];
        const s2 = this.buffer[channel][idx2];
        
        return s1 + frac * (s2 - s1);
    }
    
    /**
     * Write input to circular buffer
     */
    writeToBuffer(input, channel) {
        this.buffer[channel][this.writeIndex] = input;
    }
    
    /**
     * Get current write position in seconds
     */
    getWritePositionSeconds() {
        return this.writeIndex / this.sampleRate;
    }
    
    /**
     * Start a new grain
     */
    triggerGrain(grain, speed, grainSize) {
        grain.active = true;
        grain.phase = 0;
        
        // Calculate grain position based on current write position
        // We read from behind the write head
        const grainSamples = Math.floor(grainSize * this.sampleRate);
        const readOffset = grainSamples; // Start reading one grain size back
        
        // Position grain in buffer
        grain.readPosition = (this.writeIndex - readOffset + this.bufferSize) % this.bufferSize;
        
        // For speed < 1 (slow down), we need to read slower than we write
        // For speed > 1 (speed up), we read faster
        grain.speed = speed;
        grain.size = grainSamples;
    }
    
    /**
     * Process a single grain and return its contribution
     */
    processGrain(grain, channel, speed, pitchComp) {
        if (!grain.active) return 0;
        
        // Read from buffer with interpolation
        const sample = this.readBuffer(channel, grain.readPosition);
        
        // Apply window function
        const windowValue = this.hannWindow(grain.phase);
        
        // Update grain phase (0 to 1)
        // Phase advances based on speed and grain size
        const phaseIncrement = Math.abs(speed) / (grain.size / this.sampleRate) / this.sampleRate;
        grain.phase += phaseIncrement;
        
        // Update read position
        // The key to time stretching: we control read speed independently
        const readIncrement = speed;
        grain.readPosition = (grain.readPosition + readIncrement) % this.bufferSize;
        
        // Check if grain is finished
        if (grain.phase >= 1.0) {
            grain.active = false;
        }
        
        return sample * windowValue;
    }
    
    /**
     * Simple pitch compensation using resampling
     * When we stretch time (speed < 1), pitch drops. We need to pitch up.
     * When we compress time (speed > 1), pitch rises. We need to pitch down.
     */
    applyPitchCompensation(input, channel, speed) {
        if (Math.abs(speed - 1.0) < 0.01) {
            return input; // No compensation needed at unity speed
        }
        
        // Write to pitch buffer
        this.pitchBuffer[channel][this.pitchWriteIdx] = input;
        
        // Calculate read position based on speed
        // If speed = 0.5 (half speed), we need to pitch up by 2x
        // If speed = 2.0 (double speed), we need to pitch down by 0.5x
        const pitchRatio = 1.0 / speed;
        
        // Simple resampling - read at different rate
        let readPos = this.pitchReadIdx;
        if (channel === 0) {
            this.pitchReadIdx += pitchRatio;
        }
        
        // Wrap read index
        while (this.pitchReadIdx >= this.pitchBufferSize) {
            this.pitchReadIdx -= this.pitchBufferSize;
        }
        
        // Linear interpolation read
        const idx1 = Math.floor(readPos) % this.pitchBufferSize;
        const idx2 = (idx1 + 1) % this.pitchBufferSize;
        const frac = readPos - Math.floor(readPos);
        
        const s1 = this.pitchBuffer[channel][idx1];
        const s2 = this.pitchBuffer[channel][idx2];
        
        return s1 + frac * (s2 - s1);
    }
    
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        if (!input || !input[0] || !output || !output[0]) {
            return true;
        }
        
        const numChannels = Math.min(input.length, output.length, 2);
        const numSamples = input[0].length;
        
        // Get parameter values (k-rate, so use first value)
        const targetSpeed = parameters.speed[0];
        const targetGrainSize = parameters.grainSize[0];
        const targetOverlap = parameters.overlap[0];
        const pitchComp = parameters.pitchCompensation[0];
        const mix = parameters.mix[0];
        
        // Smooth parameters
        this.smoothedSpeed += (targetSpeed - this.smoothedSpeed) * this.smoothCoeff;
        this.smoothedGrainSize += (targetGrainSize - this.smoothedGrainSize) * this.smoothCoeff;
        this.smoothedOverlap += (targetOverlap - this.smoothedOverlap) * this.smoothCoeff;
        
        const speed = this.smoothedSpeed;
        const grainSize = this.smoothedGrainSize;
        const overlap = this.smoothedOverlap;
        
        // Calculate grain interval based on overlap
        // Higher overlap = grains trigger more frequently
        const grainSamples = Math.floor(grainSize * this.sampleRate);
        const intervalSamples = Math.floor(grainSamples * (1 - overlap));
        
        // Clamp buffer size based on current settings
        const minBufferNeeded = Math.max(grainSamples * 4, this.sampleRate);
        this.bufferSize = Math.min(Math.ceil(minBufferNeeded * 1.5), this.maxBufferSamples);
        
        // Process each sample
        for (let i = 0; i < numSamples; i++) {
            // Write input to circular buffer for each channel
            for (let ch = 0; ch < numChannels; ch++) {
                if (input[ch]) {
                    this.writeToBuffer(input[ch][i], ch);
                }
            }
            
            // Update write index
            this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
            this.sampleTime++;
            
            // Check if buffer is ready (filled enough)
            if (!this.bufferReady) {
                this.bufferFillCount++;
                if (this.bufferFillCount >= this.bufferSize) {
                    this.bufferReady = true;
                }
            }
            
            // Grain triggering
            if (this.bufferReady && this.sampleTime >= this.nextGrainTime) {
                // Find inactive grain
                for (let g = 0; g < this.numGrains; g++) {
                    if (!this.grains[g].active) {
                        this.triggerGrain(this.grains[g], speed, grainSize);
                        break;
                    }
                }
                this.nextGrainTime = this.sampleTime + intervalSamples;
            }
            
            // Process grains for each channel
            for (let ch = 0; ch < numChannels; ch++) {
                let wetSample = 0;
                let activeGrains = 0;
                
                // Sum all active grains
                for (let g = 0; g < this.numGrains; g++) {
                    if (this.grains[g].active) {
                        // Each grain processes both channels but we offset slightly for stereo
                        const grainSample = this.processGrain(
                            this.grains[g], 
                            ch, 
                            speed,
                            pitchComp
                        );
                        wetSample += grainSample;
                        activeGrains++;
                    }
                }
                
                // Normalize by expected number of overlapping grains
                const expectedGrains = 1 / (1 - overlap);
                if (activeGrains > 0) {
                    wetSample /= Math.sqrt(expectedGrains);
                }
                
                // Apply pitch compensation if enabled
                if (pitchComp > 0 && Math.abs(speed - 1.0) > 0.01) {
                    const compensated = this.applyPitchCompensation(wetSample, ch, speed);
                    wetSample = wetSample * (1 - pitchComp) + compensated * pitchComp;
                }
                
                // Mix wet and dry
                const drySample = input[ch] ? input[ch][i] : 0;
                output[ch][i] = drySample * (1 - mix) + wetSample * mix;
            }
        }
        
        return true;
    }
}

registerProcessor('grain-player', GrainPlayerProcessor);
