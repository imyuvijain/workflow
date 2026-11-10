// Continuous noise, generated on the audio thread. No audio files or loops.
class NoiseProcessor extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();
    this.types = ['brown', 'pink', 'white'];
    this.type = this.types.includes(options.processorOptions?.type) ? options.processorOptions.type : 'brown';
    this.mix = this.types.map(type => Number(type === this.type));
    this.fade = 1 - Math.exp(-1 / (sampleRate * 0.025));
    this.brown = 0;
    this.brownLow = 0;
    this.phase = 0;
    this.warmth = 0;
    this.movement = 0;
    this.setBrownSettings(options.processorOptions?.brownSettings);
    this.warmth = this.targetWarmth;
    this.movement = this.targetMovement;
    this.lowpass = this.targetLowpass;

    // Voss–McCartney pink noise: random sources updated at octave intervals,
    // plus a full-rate white source to fill the highest octave.
    this.rows = Float64Array.from({ length: 16 }, () => Math.random() * 2 - 1);
    this.pinkSum = this.rows.reduce((sum, value) => sum + value, 0);
    this.counter = 0;
    this.port.onmessage = ({ data }) => {
      if (this.types.includes(data?.type)) this.type = data.type;
      if (data?.brownSettings) this.setBrownSettings(data.brownSettings);
    };
  }

  setBrownSettings(settings) {
    const percent = value => typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) / 100 : 0;
    this.targetWarmth = percent(settings?.warmth);
    this.targetMovement = percent(settings?.movement);
    // A progressively lower cutoff rounds off the brown noise's upper edge.
    const cutoff = Math.min(sampleRate * 0.45, 16000 * (70 / 16000) ** this.targetWarmth);
    this.targetLowpass = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);
  }

  process(inputs, outputs) {
    const channels = outputs[0];
    if (!channels?.length) return true;
    const samples = channels[0];
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      this.brown = (this.brown + 0.02 * white) / 1.02;
      this.counter = (this.counter + 1) & 0xffff;
      if (this.counter !== 0) {
        const row = 31 - Math.clz32(this.counter & -this.counter);
        const next = Math.random() * 2 - 1;
        this.pinkSum += next - this.rows[row];
        this.rows[row] = next;
      }
      for (let type = 0; type < this.types.length; type++) {
        this.mix[type] += (Number(this.types[type] === this.type) - this.mix[type]) * this.fade;
      }
      this.warmth += (this.targetWarmth - this.warmth) * this.fade;
      this.movement += (this.targetMovement - this.movement) * this.fade;
      this.lowpass += (this.targetLowpass - this.lowpass) * this.fade;
      this.brownLow += this.lowpass * (this.brown - this.brownLow);
      this.phase = (this.phase + 2 * Math.PI / (sampleRate * 12)) % (2 * Math.PI);
      const swell = 1 - this.movement * 0.22 * (1 - Math.sin(this.phase));
      const brown = (this.brown * (1 - this.warmth) + this.brownLow * this.warmth) * swell;
      samples[i] = brown * 3.5 * this.mix[0]
        + (this.pinkSum + white) * 0.085 * this.mix[1]
        + white * 0.35 * this.mix[2];
    }
    for (let channel = 1; channel < channels.length; channel++) channels[channel].set(samples);
    return true;
  }
}
registerProcessor('workflow-noise', NoiseProcessor);
