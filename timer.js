// Store timestamps instead of counting interval ticks: background tabs may throttle them.
export const STORAGE_KEY = 'quiet.study.v1';
export const emptyState = () => ({ totals: {}, sessionMs: 0, startedAt: null });

export function dateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseState(raw) {
  if (!raw) return emptyState();
  const state = JSON.parse(raw);
  if (!state || typeof state.totals !== 'object' || state.totals === null || Array.isArray(state.totals) ||
      !Number.isFinite(state.sessionMs) || state.sessionMs < 0 ||
      (state.startedAt !== null && (!Number.isFinite(state.startedAt) || state.startedAt < 0))) {
    throw new Error('Invalid saved timer');
  }
  const totals = {};
  for (const [key, value] of Object.entries(state.totals)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(value) || value < 0) throw new Error('Invalid saved total');
    totals[key] = value;
  }
  return { totals, sessionMs: state.sessionMs, startedAt: state.startedAt };
}

// Split a running session at local midnights, including 23/25-hour DST days.
export function snapshot(state, now = Date.now()) {
  const result = { ...state, totals: { ...state.totals } };
  if (state.startedAt === null) return result;
  let cursor = state.startedAt;
  const end = Math.max(cursor, now);
  result.sessionMs += end - cursor;
  while (cursor < end) {
    const midnight = new Date(cursor);
    midnight.setHours(24, 0, 0, 0);
    const boundary = Math.min(midnight.getTime(), end);
    const key = dateKey(cursor);
    result.totals[key] = (result.totals[key] || 0) + boundary - cursor;
    cursor = boundary;
  }
  result.startedAt = end;
  return result;
}

export function transition(state, action, now = Date.now()) {
  const next = snapshot(state, now);
  if (action === 'toggle') next.startedAt = state.startedAt === null ? now : null;
  else if (action === 'finish') {
    next.startedAt = null;
    next.sessionMs = 0;
  } else throw new Error('Unknown timer action');
  return next;
}

export function clockText(ms) {
  const seconds = Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}

export function durationText(ms) {
  if (ms > 0 && ms < 60000) return '<1m';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
