import { BROWN_PRESETS, normalizeBrownSettings, matchingPreset } from './sound-settings.js';
import { STORAGE_KEY, emptyState, parseState, snapshot, transition, renameSession, dateKey, clockText, durationText } from './timer.js';

const $ = id => document.getElementById(id);
let state = emptyState();
let weekOffset = 0;
let storageHealthy = true;
let savedUnreadable = false;

function warn(message) {
  $('storage-warning').hidden = false;
  $('storage-warning').textContent = message;
}

function readState() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); }
  catch {
    storageHealthy = false;
    warn('Browser storage is unavailable. Your timer works, but study time will not survive a reload.');
    return state;
  }
  try { return parseState(raw); }
  catch {
    savedUnreadable = true;
    warn('Your saved study data could not be read. It has been kept untouched. Please use another browser profile to start a new history.');
    $('timer-toggle').disabled = true;
    return emptyState();
  }
}

state = readState();

function render() {
  const now = new Date();
  const current = snapshot(state, now.getTime());
  const running = state.startedAt !== null;
  const time = clockText(current.sessionMs);
  $('timer').innerHTML = `${time.slice(0, -3)}<span>${time.slice(-3)}</span>`;
  $('timer-toggle').textContent = running ? 'Pause' : current.sessionMs ? 'Resume' : 'Start';
  $('timer-status').textContent = running ? 'Running' : current.sessionMs ? 'Paused' : 'Idle';
  $('timer-status').classList.toggle('running', running);
  $('session-title').disabled = savedUnreadable;
  if (document.activeElement !== $('session-title')) $('session-title').value = state.title;
  $('timer-finish').disabled = savedUnreadable || (!running && current.sessionMs === 0);
  $('date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const today = dateKey(now);
  $('today-hours').textContent = ((current.totals[today] || 0) / 3600000).toFixed(2);

  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
  const formatDate = date => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  $('week-range').textContent = `${formatDate(start)} – ${formatDate(end)}`;
  $('chart').setAttribute('aria-label', `Daily study hours, ${formatDate(start)} to ${formatDate(end)}`);
  $('next-week').disabled = weekOffset === 0;
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date, key: dateKey(date), ms: current.totals[dateKey(date)] || 0 };
  });
  $('week-hours').textContent = `${(days.reduce((sum, day) => sum + day.ms, 0) / 3600000).toFixed(2)} h`;
  document.querySelector('.week-total span').textContent = weekOffset === 0 ? 'Last 7 days' : 'These 7 days';
  const max = Math.max(3600000, ...days.map(day => day.ms));
  const chart = document.createDocumentFragment();
  const rows = document.createDocumentFragment();
  for (const day of days) {
    const column = document.createElement('div');
    column.className = 'chart-day' + (day.key === today ? ' today' : '');
    column.title = `${formatDate(day.date)}: ${(day.ms / 3600000).toFixed(2)} hours (${durationText(day.ms)})`;
    column.setAttribute('aria-hidden', 'true');
    column.innerHTML = `<span class="chart-value">${durationText(day.ms)}</span><div class="chart-bar" style="height:${Math.max(3, day.ms / max * 95)}px"></div><span class="chart-label">${day.key === today ? 'Today' : day.date.toLocaleDateString(undefined, { weekday: 'short' })}</span>`;
    chart.append(column);
    const row = document.createElement('tr');
    const dateCell = document.createElement('th');
    dateCell.scope = 'row';
    dateCell.textContent = day.date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const totalCell = document.createElement('td');
    totalCell.textContent = `${(day.ms / 3600000).toFixed(2)} hours (${durationText(day.ms)})`;
    row.append(dateCell, totalCell);
    rows.append(row);
  }
  $('chart').replaceChildren(chart);
  $('daily-totals').replaceChildren(rows);
}

async function changeTimer(action, title) {
  if (savedUnreadable) return;
  const change = () => {
    if (storageHealthy) state = readState();
    if (savedUnreadable) return;
    state = action === 'title' ? renameSession(state, title) : transition(state, action);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch {
      storageHealthy = false;
      warn('Study time could not be saved. Keep this tab open; reloading may lose your latest session.');
    }
    render();
  };
  // Serialize actions between tabs so they share a single study timer.
  if (navigator.locks) await navigator.locks.request('quiet-study-timer', change);
  else change();
}

$('timer-toggle').addEventListener('click', () => changeTimer('toggle'));
$('timer-finish').addEventListener('click', () => changeTimer('finish'));
$('session-title').addEventListener('input', event => changeTimer('title', event.target.value));
$('session-title').addEventListener('blur', render);
$('previous-week').addEventListener('click', () => { weekOffset--; render(); });
$('next-week').addEventListener('click', () => { weekOffset = Math.min(0, weekOffset + 1); render(); });
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) { state = readState(); render(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
setInterval(render, 1000);
render();

let context;
let gain;
let noise;
let playing = false;
let volume = 30;
const noiseNames = { brown: 'brown', pink: 'pink', white: 'white' };
let noiseType = 'brown';
let brownSettings = normalizeBrownSettings();
try {
  const stored = localStorage.getItem('quiet.volume');
  if (stored !== null && Number.isFinite(Number(stored))) volume = Math.min(100, Math.max(0, Number(stored)));
  const storedType = localStorage.getItem('quiet.noiseType');
  if (Object.hasOwn(noiseNames, storedType)) noiseType = storedType;
} catch { /* Sound preferences are optional. */ }
try { brownSettings = normalizeBrownSettings(JSON.parse(localStorage.getItem('quiet.brownSettings'))); }
catch { /* Missing or unreadable settings use Classic. */ }
$('volume').value = volume;
$('volume-value').textContent = `${volume}%`;
$('noise-type').value = noiseType;

function setGain() {
  if (!context || !gain) return;
  gain.gain.setTargetAtTime(playing ? (volume / 100) ** 1.5 * 0.8 : 0, context.currentTime, 0.04);
}

function renderBrownSettings() {
  const preset = matchingPreset(brownSettings);
  $('brown-template').value = preset;
  $('template-description').textContent = BROWN_PRESETS[preset]?.description || 'Your own warmth and movement settings.';
  for (const setting of ['warmth', 'movement']) {
    $('brown-' + setting).value = brownSettings[setting];
    $(setting + '-value').textContent = `${brownSettings[setting]}%`;
  }
}

function updateBrownSettings(settings) {
  brownSettings = normalizeBrownSettings(settings);
  noise?.port.postMessage({ brownSettings });
  renderBrownSettings();
  try { localStorage.setItem('quiet.brownSettings', JSON.stringify(brownSettings)); } catch { /* Optional preference. */ }
}

$('brown-template').addEventListener('change', event => {
  const preset = BROWN_PRESETS[event.target.value];
  if (preset) updateBrownSettings(preset);
});
for (const setting of ['warmth', 'movement']) {
  $('brown-' + setting).addEventListener('input', event => {
    updateBrownSettings({ ...brownSettings, [setting]: Number(event.target.value) });
  });
}
renderBrownSettings();

function renderSound() {
  $('brown-options').hidden = noiseType !== 'brown';
  $('sound-toggle').textContent = playing ? 'Pause' : 'Play';
  $('sound-toggle').setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${noiseNames[noiseType]} noise`);
  $('sound-toggle').setAttribute('aria-pressed', String(playing));
  $('sound-note').textContent = playing && volume === 0 ? 'Muted (volume is 0%).' : '';
}

$('sound-toggle').addEventListener('click', async () => {
  $('sound-toggle').disabled = true;
  try {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      // Resume within the user gesture, before awaiting module loading (Safari).
      await context.resume();
      await context.audioWorklet.addModule(new URL('./noise-processor.js', import.meta.url));
      noise = new AudioWorkletNode(context, 'workflow-noise', {
        outputChannelCount: [2],
        processorOptions: { type: noiseType, brownSettings }
      });
      const highpass = context.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 25;
      gain = context.createGain();
      gain.gain.value = 0;
      noise.connect(highpass).connect(gain).connect(context.destination);
      context.addEventListener('statechange', () => {
        if (context?.state === 'suspended' || context?.state === 'interrupted') {
          playing = false;
          renderSound();
        }
      });
    }
    if (context.state !== 'running') await context.resume();
    playing = !playing;
    setGain();
    renderSound();
    if (!playing) {
      // Let the fade finish, then stop processing audio while paused.
      await new Promise(resolve => setTimeout(resolve, 180));
      await context.suspend();
    }
  } catch {
    playing = false;
    if (context) await context.close().catch(() => {});
    context = undefined;
    gain = undefined;
    noise = undefined;
    renderSound();
    $('sound-note').textContent = 'Audio couldn’t start. Try again in a current browser over HTTPS.';
  } finally { $('sound-toggle').disabled = false; }
});

$('volume').addEventListener('input', event => {
  volume = Number(event.target.value);
  $('volume-value').textContent = `${volume}%`;
  setGain();
  renderSound();
  try { localStorage.setItem('quiet.volume', String(volume)); } catch { /* Optional preference. */ }
});

$('noise-type').addEventListener('change', event => {
  if (!Object.hasOwn(noiseNames, event.target.value)) return;
  noiseType = event.target.value;
  noise?.port.postMessage({ type: noiseType });
  renderSound();
  try { localStorage.setItem('quiet.noiseType', noiseType); } catch { /* Optional preference. */ }
});
renderSound();
