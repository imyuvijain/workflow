import { STORAGE_KEY, emptyState, parseState, snapshot, transition, dateKey, clockText, durationText } from './timer.js';

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
  $('timer-toggle').innerHTML = running ? '<span aria-hidden="true">Ⅱ</span> Pause studying' : '<span aria-hidden="true">▶</span> ' + (current.sessionMs ? 'Resume studying' : 'Start studying');
  $('timer-status').innerHTML = `<i></i> ${running ? 'Time to focus' : current.sessionMs ? 'Taking a breather' : 'Ready when you are'}`;
  $('timer-status').classList.toggle('running', running);
  $('timer-hint').textContent = running ? 'You’re here. That’s a good start.' : current.sessionMs ? 'Take your time. Come back when you’re ready.' : 'A fresh start. Make it yours.';
  $('timer-finish').disabled = savedUnreadable || (!running && current.sessionMs === 0);
  $('date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const today = dateKey(now);
  $('today-hours').textContent = ((current.totals[today] || 0) / 3600000).toFixed(2);

  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
  const formatDate = date => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  $('week-range').textContent = `${formatDate(start)} – ${formatDate(end)}`;
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

async function changeTimer(action) {
  if (savedUnreadable) return;
  const change = () => {
    if (storageHealthy) state = readState();
    if (savedUnreadable) return;
    state = transition(state, action);
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
$('previous-week').addEventListener('click', () => { weekOffset--; render(); });
$('next-week').addEventListener('click', () => { weekOffset = Math.min(0, weekOffset + 1); render(); });
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) { state = readState(); render(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
setInterval(render, 1000);
render();

// A small contour illustration, drawn locally with no image assets or tracking.
for (let line = 0; line < 10; line++) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let d = '';
  for (let x = 0; x <= 320; x += 2) {
    const envelope = Math.sin(Math.PI * x / 320);
    const y = 16 + line * 8 + Math.sin(x / 35 + line * 0.36) * 12 * envelope + Math.sin(x / 18 + line * 0.18) * 4 * envelope;
    d += `${x === 0 ? 'M' : 'L'}${x},${y.toFixed(2)} `;
  }
  path.setAttribute('d', d);
  $('sound-lines').append(path);
}

let context;
let gain;
let noise;
let playing = false;
let volume = 30;
try {
  const stored = localStorage.getItem('quiet.volume');
  if (stored !== null && Number.isFinite(Number(stored))) volume = Math.min(100, Math.max(0, Number(stored)));
} catch { /* Volume preferences are optional. */ }
$('volume').value = volume;
$('volume-value').textContent = `${volume}%`;

function setGain() {
  if (!context || !gain) return;
  gain.gain.setTargetAtTime(playing ? (volume / 100) ** 1.5 * 0.8 : 0, context.currentTime, 0.04);
}

function renderSound() {
  $('sound-toggle').innerHTML = `<span aria-hidden="true">${playing ? 'Ⅱ' : '▶'}</span>`;
  $('sound-toggle').setAttribute('aria-label', playing ? 'Pause brown noise' : 'Play brown noise');
  $('sound-toggle').setAttribute('aria-pressed', String(playing));
  document.querySelector('.sound-panel').classList.toggle('playing', playing);
  $('sound-note').textContent = playing ? (volume === 0 ? 'Playing at zero volume. Turn it up when you’re ready.' : 'A little quiet, whenever you need it.') : 'Press play to find your focus.';
}

$('sound-toggle').addEventListener('click', async () => {
  $('sound-toggle').disabled = true;
  try {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      // Resume within the user gesture, before awaiting module loading (Safari).
      await context.resume();
      await context.audioWorklet.addModule(new URL('./brown-noise.js', import.meta.url));
      noise = new AudioWorkletNode(context, 'brown-noise', { outputChannelCount: [2] });
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
