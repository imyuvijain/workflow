import test from 'node:test';
import assert from 'node:assert/strict';
import { BROWN_PRESETS, matchingPreset, normalizeBrownSettings } from '../sound-settings.js';

test('saved brown settings survive JSON storage and recognize templates and custom values', () => {
  for (const [key, preset] of Object.entries(BROWN_PRESETS)) {
    assert.equal(matchingPreset(normalizeBrownSettings(JSON.parse(JSON.stringify(preset)))), key);
  }
  const custom = { warmth: 23, movement: 71 };
  assert.deepEqual(normalizeBrownSettings(JSON.parse(JSON.stringify(custom))), custom);
  assert.equal(matchingPreset(custom), 'custom');
});

test('missing and malformed preferences use Classic; numeric values stay in range', () => {
  for (const invalid of [undefined, null, 'bad', [], { warmth: '50', movement: Infinity }, { warmth: NaN }]) {
    assert.deepEqual(normalizeBrownSettings(invalid), { warmth: 0, movement: 0 });
  }
  assert.deepEqual(normalizeBrownSettings({ warmth: -10, movement: 200 }), { warmth: 0, movement: 100 });
});
