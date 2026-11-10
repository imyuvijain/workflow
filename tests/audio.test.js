import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('brown noise is continuous, bounded, stereo, and dominated by slow variation', async () => {
  let Processor;
  let seed = 12345;
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const source = await readFile(new URL('../brown-noise.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    AudioWorkletProcessor: class {},
    registerProcessor: (name, implementation) => { Processor = implementation; },
    Math: deterministicMath
  });
  const processor = new Processor();
  const stream = [];
  for (let block = 0; block < 500; block++) {
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    assert.equal(processor.process([], [[left, right]]), true);
    assert.deepEqual(left, right);
    stream.push(...left);
  }
  assert.ok(stream.every(value => Number.isFinite(value) && Math.abs(value) <= 3.5));
  const energy = stream.reduce((sum, value) => sum + value * value, 0);
  const deltaEnergy = stream.slice(1).reduce((sum, value, i) => sum + (value - stream[i]) ** 2, 0);
  const rms = Math.sqrt(energy / stream.length);
  assert.ok(rms > 0.05 && rms < 0.5, `Unexpected signal level: ${rms}`);
  assert.ok(deltaEnergy / energy < 0.1, 'Expected strong low-frequency content');
  assert.notDeepEqual(stream.slice(0, 128), stream.slice(128, 256));
});
