import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function makeProcessor(type) {
  let Processor;
  let seed = 12345;
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const source = await readFile(new URL('../noise-processor.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    AudioWorkletProcessor: class { constructor() { this.port = {}; } },
    sampleRate: 48000,
    registerProcessor: (name, implementation) => { Processor = implementation; },
    Math: deterministicMath
  });
  return new Processor({ processorOptions: { type } });
}

function render(processor, length = 65536) {
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  assert.equal(processor.process([], [[left, right]]), true);
  assert.deepEqual(left, right);
  return left;
}

// Average a Hann-windowed periodogram at 32 frequencies across a band.
function bandPower(samples, from, to) {
  let sum = 0;
  for (let step = 0; step < 32; step++) {
    const hz = from + (to - from) * (step + 0.5) / 32;
    const coefficient = 2 * Math.cos(2 * Math.PI * hz / 48000);
    let previous = 0;
    let older = 0;
    for (let i = 0; i < samples.length; i++) {
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (samples.length - 1));
      const current = samples[i] * window + coefficient * previous - older;
      older = previous;
      previous = current;
    }
    sum += previous ** 2 + older ** 2 - coefficient * previous * older;
  }
  return sum / 32;
}

for (const [type, minRatio, maxRatio] of [['white', 0.4, 2.5], ['pink', 2.5, 20], ['brown', 25, 140]]) {
  test(`${type} noise is continuous stereo with the expected frequency balance`, async () => {
    const processor = await makeProcessor(type);
    const samples = render(processor);
    assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) < 3.5));
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value ** 2, 0) / samples.length);
    assert.ok(rms > 0.05 && rms < 0.5, `Unexpected signal level: ${rms}`);
    const ratio = bandPower(samples, 400, 800) / bandPower(samples, 3200, 6400);
    assert.ok(ratio > minRatio && ratio < maxRatio, `Unexpected low/high power ratio: ${ratio}`);
    assert.notDeepEqual(samples.slice(0, 128), samples.slice(128, 256));
  });
}

test('changing noise type crossfades without restarting the stream', async () => {
  const changing = await makeProcessor('brown');
  const reference = await makeProcessor('brown');
  render(changing, 128);
  render(reference, 128);
  changing.port.onmessage({ data: { type: 'pink' } });
  const next = render(changing, 6000);
  const unchanged = render(reference, 6000);
  assert.ok(Math.abs(next[0] - unchanged[0]) < 0.005);
  assert.ok(changing.mix[1] > 0.99);
  assert.ok(changing.mix[0] < 0.01);
  changing.port.onmessage({ data: { type: 'invalid' } });
  assert.equal(changing.type, 'pink');
});
