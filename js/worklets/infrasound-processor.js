/**
 * Infrasound AudioWorklet Processor
 * 
 * Specialized generator for extremely low frequencies (0.01Hz to 200Hz).
 * Uses a phase-accumulator approach for perfect stability at sub-audio rates.
 * Supports Sine, Triangle, Sawtooth, and Variable Pulse (PWM) waveforms.
 */

class InfrasoundProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            {
                name: "frequency",
                defaultValue: 8.0,
                minValue: 0.001,
                maxValue: 200.0,
                automationRate: "k-rate"
            },
            {
                name: "dutyCycle",
                defaultValue: 0.5,
                minValue: 0.01,
                maxValue: 0.99,
                automationRate: "k-rate"
            },
            {
                name: "detune",
                defaultValue: 0.0,
                automationRate: "k-rate"
            }
        ];
    }

    constructor() {
        super();
        this.phase = 0;
        this.waveform = "sine";
        
        this.port.onmessage = (event) => {
            if (event.data.type === "setWaveform") {
                this.waveform = event.data.waveform;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const numChannels = output.length;
        const numSamples = output[0].length;
        
        const frequency = parameters.frequency[0];
        const dutyCycle = parameters.dutyCycle[0];
        const detune = parameters.detune[0];
        
        const actualFreq = frequency * Math.pow(2, detune / 1200);
        const phaseIncrement = actualFreq / sampleRate;

        for (let i = 0; i < numSamples; i++) {
            let sample = 0;
            switch (this.waveform) {
                case "sine":
                    sample = Math.sin(2 * Math.PI * this.phase);
                    break;
                case "triangle":
                    sample = this.phase < 0.5 ? (4 * this.phase - 1) : (3 - 4 * this.phase);
                    break;
                case "sawtooth":
                    sample = 2 * this.phase - 1;
                    break;
                case "square":
                case "pulse":
                    sample = this.phase < dutyCycle ? 1 : -1;
                    break;
                default:
                    sample = Math.sin(2 * Math.PI * this.phase);
            }
            for (let ch = 0; ch < numChannels; ch++) {
                output[ch][i] = sample;
            }
            this.phase = (this.phase + phaseIncrement) % 1.0;
        }
        return true;
    }
}

registerProcessor("infrasound-processor", InfrasoundProcessor);
