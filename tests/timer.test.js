import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, dateKey, parseState, snapshot, transition, clockText } from '../timer.js';

process.env.TZ = 'America/Toronto';
const at = value => new Date(value).getTime();

test('pause excludes breaks; finish preserves daily hours and starts a fresh session', () => {
  let state = transition(emptyState(), 'toggle', at('2026-11-10T09:00:00-05:00'));
  state = transition(state, 'toggle', at('2026-11-10T10:30:00-05:00'));
  assert.equal(state.sessionMs, 90 * 60000);
  state = transition(state, 'toggle', at('2026-11-10T11:00:00-05:00'));
  state = transition(state, 'finish', at('2026-11-10T11:30:00-05:00'));
  assert.equal(state.totals['2026-11-10'], 2 * 3600000);
  assert.equal(state.sessionMs, 0);
  assert.equal(state.startedAt, null);
});

test('a reload and a background tab preserve elapsed time without double counting', () => {
  const start = at('2026-11-10T10:00:00-05:00');
  const saved = JSON.stringify(transition(emptyState(), 'toggle', start));
  const loaded = parseState(saved);
  snapshot(loaded, start + 60000);
  snapshot(loaded, start + 60000);
  const stopped = transition(loaded, 'finish', start + 2 * 3600000);
  assert.equal(stopped.totals['2026-11-10'], 2 * 3600000);
  assert.equal(loaded.totals['2026-11-10'], undefined);
});

test('overnight sessions belong to the correct local day', () => {
  const state = transition(emptyState(), 'toggle', at('2026-11-10T23:30:00-05:00'));
  const result = transition(state, 'finish', at('2026-11-11T01:15:00-05:00'));
  assert.deepEqual(result.totals, { '2026-11-10': 30 * 60000, '2026-11-11': 75 * 60000 });
});

test('a spring daylight-saving day contains 23 hours', () => {
  const state = transition(emptyState(), 'toggle', at('2026-03-08T00:00:00-05:00'));
  const result = transition(state, 'finish', at('2026-03-09T00:00:00-04:00'));
  assert.deepEqual(result.totals, { '2026-03-08': 23 * 3600000 });
});

test('a fall daylight-saving day contains 25 hours', () => {
  const state = transition(emptyState(), 'toggle', at('2026-11-01T00:00:00-04:00'));
  const result = transition(state, 'finish', at('2026-11-02T00:00:00-05:00'));
  assert.deepEqual(result.totals, { '2026-11-01': 25 * 3600000 });
});

test('daily totals use local dates rather than UTC dates', () => {
  assert.equal(dateKey(at('2026-11-11T02:00:00Z')), '2026-11-10');
});

test('malformed or negative stored data is rejected', () => {
  for (const raw of ['garbage', 'null', '{}', '{"totals":{},"sessionMs":-1,"startedAt":null}', '{"totals":{"2026-11-10":-1},"sessionMs":0,"startedAt":null}']) {
    assert.throws(() => parseState(raw));
  }
  assert.deepEqual(parseState(null), emptyState());
});

test('a clock correction cannot subtract recorded time', () => {
  const state = transition(emptyState(), 'toggle', 5000);
  assert.equal(snapshot(state, 4000).sessionMs, 0);
});

test('long sessions do not wrap at 24 hours', () => {
  assert.equal(clockText(25 * 3600000 + 61000), '25:01:01');
});
