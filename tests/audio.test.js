import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { BROWN_PRESETS } from '../sound-settings.js';

async function makeProcessor(type, brownSettings, rate = 48000) {
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
    sampleRate: rate,
    registerProcessor: (name, implementation) => { Processor = implementation; },
    Math: deterministicMath
  });
  return new Processor({ processorOptions: { type, brownSettings } });
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


test('warmth reduces high-frequency energy while preserving the low rumble', async () => {
  const classic = render(await makeProcessor('brown', BROWN_PRESETS.classic));
  const deep = render(await makeProcessor('brown', BROWN_PRESETS.deep));
  const lowRatio = bandPower(deep, 40, 100) / bandPower(classic, 40, 100);
  const highRatio = bandPower(deep, 3200, 6400) / bandPower(classic, 3200, 6400);
  assert.ok(lowRatio > 0.5, `Low rumble was lost: ${lowRatio}`);
  assert.ok(highRatio < 0.1, `High frequencies were not softened: ${highRatio}`);
});

test('movement swells smoothly over twelve seconds without increasing the peak level', async () => {
  const classic = render(await makeProcessor('brown'), 48000 * 12);
  const rolling = render(await makeProcessor('brown', { warmth: 0, movement: 100 }), classic.length);
  for (const [seconds, expected] of [[3, 1], [9, 0.56], [12, 0.78]]) {
    const i = seconds * 48000 - 1;
    assert.ok(Math.abs(rolling[i] / classic[i] - expected) < 0.001);
  }
  assert.ok(rolling.every((value, i) => Math.abs(value) <= Math.abs(classic[i]) + 1e-7));
});

test('live brown customization fades in and leaves pink and white unchanged', async () => {
  for (const type of ['brown', 'pink', 'white']) {
    const changing = await makeProcessor(type);
    const reference = await makeProcessor(type);
    render(changing, 128);
    render(reference, 128);
    changing.port.onmessage({ data: { brownSettings: BROWN_PRESETS.rolling } });
    const next = render(changing, 6000);
    const unchanged = render(reference, 6000);
    if (type === 'brown') {
      assert.ok(Math.abs(next[0] - unchanged[0]) < 0.001);
      assert.notDeepEqual(next.slice(-128), unchanged.slice(-128));
    } else assert.deepEqual(next, unchanged);
  }
});

test('all templates produce finite audio at common sample rates and reject invalid settings', async () => {
  for (const rate of [44100, 48000, 96000]) {
    for (const preset of Object.values(BROWN_PRESETS)) {
      const processor = await makeProcessor('brown', preset, rate);
      assert.ok(render(processor, 2048).every(value => Number.isFinite(value) && Math.abs(value) < 3.5));
      processor.port.onmessage({ data: { brownSettings: { warmth: NaN, movement: Infinity } } });
      assert.ok(render(processor, 2048).every(Number.isFinite));
    }
  }
});
