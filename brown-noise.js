// Continuous integrated white noise; a small leak bounds the random walk.
// AudioWorklet runs on the audio thread, independently of the page's timer.
class BrownNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.last = 0;
  }

  process(inputs, outputs) {
    const channels = outputs[0];
    if (!channels?.length) return true;
    const samples = channels[0];
    for (let i = 0; i < samples.length; i++) {
      this.last = (this.last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      samples[i] = this.last * 3.5;
    }
    for (let c = 1; c < channels.length; c++) channels[c].set(samples);
    return true;
  }
}
registerProcessor('brown-noise', BrownNoiseProcessor);
