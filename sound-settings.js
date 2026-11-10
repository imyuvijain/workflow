export const BROWN_PRESETS = Object.freeze({
  classic: { name: 'Classic', description: 'The original, steady low rumble.', warmth: 0, movement: 0 },
  deep: { name: 'Deep', description: 'Darker and bassier, with less hiss.', warmth: 85, movement: 0 },
  soft: { name: 'Soft', description: 'A gently rounded sound for everyday focus.', warmth: 45, movement: 0 },
  rolling: { name: 'Rolling', description: 'A warm rumble with a slow, gentle swell.', warmth: 60, movement: 65 }
});

export function normalizeBrownSettings(value) {
  const percent = value => typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return { warmth: percent(value?.warmth), movement: percent(value?.movement) };
}

export function matchingPreset(settings) {
  return Object.keys(BROWN_PRESETS).find(key => BROWN_PRESETS[key].warmth === settings.warmth && BROWN_PRESETS[key].movement === settings.movement) || 'custom';
}
