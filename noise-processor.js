// Continuous noise, generated on the audio thread. No audio files or loops.
class NoiseProcessor extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();
    this.types = ['brown', 'pink', 'white'];
    this.type = this.types.includes(options.processorOptions?.type) ? options.processorOptions.type : 'brown';
    this.mix = this.types.map(type => Number(type === this.type));
    this.fade = 1 - Math.exp(-1 / (sampleRate * 0.025));
    this.brown = 0;

    // Voss–McCartney pink noise: random sources updated at octave intervals,
    // plus a full-rate white source to fill the highest octave.
    this.rows = Float64Array.from({ length: 16 }, () => Math.random() * 2 - 1);
    this.pinkSum = this.rows.reduce((sum, value) => sum + value, 0);
    this.counter = 0;
    this.port.onmessage = ({ data }) => {
      if (this.types.includes(data?.type)) this.type = data.type;
    };
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
      samples[i] = this.brown * 3.5 * this.mix[0]
        + (this.pinkSum + white) * 0.085 * this.mix[1]
        + white * 0.35 * this.mix[2];
    }
    for (let channel = 1; channel < channels.length; channel++) channels[channel].set(samples);
    return true;
  }
}
registerProcessor('workflow-noise', NoiseProcessor);
