import { DEFAULT_SETTINGS, EQ_BANDS, METER_PORT, MSG, RANGE, TARGET } from '../shared/constants.js';
import { loadSettings, saveSettings } from '../shared/settings.js';
import { travelToVolume, volumeToTravel, volumeZone } from '../shared/volume.js';
import { setLang, t, translateDom } from './i18n.js';
import { createFader } from './ui/fader.js';
import { createKnob } from './ui/knob.js';
import { createMeter } from './ui/meter.js';
import { addScrews } from './ui/rack.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const app = $('app');
const ui = {
  power: $('powerBtn'),
  host: $('tabHost'),
  state: $('tabState'),
  volume: $('volumeKnob'),
  mute: $('muteBtn'),
  unity: $('unityBtn'),
  eq: $('eq'),
  eqReset: $('eqReset'),
  fx: $('fx'),
  bypass: $('bypassBtn'),
  auto: $('autoCapture'),
  langSeg: $('langSeg'),
  theme: $('themeBtn'),
  reset: $('resetBtn'),
  notice: $('notice'),
};

// Páginas donde Chrome no deja capturar audio.
const BLOCKED_URL = /^(chrome|edge|brave|opera|about|devtools|view-source|chrome-extension):|^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;
const UI_PREFS_KEY = 'dragonAudio.ui';

let settings = { ...DEFAULT_SETTINGS };
let tab = null;
let capturing = false;
let captureState = 'idle';
let engineAlive = false;
let meterPort = null;
let notice = null;
const controls = {};

const toBackground = (type, payload = {}) =>
  chrome.runtime.sendMessage({ target: TARGET.BACKGROUND, type, ...payload });

// ── Configuración → motor + almacenamiento (una vez por frame) ──
let frame = 0;
function commit(patch) {
  settings = { ...settings, ...patch };
  renderToggles();
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    saveSettings(settings).catch(() => {});
    if (engineAlive) {
      chrome.runtime
        .sendMessage({ target: TARGET.OFFSCREEN, type: MSG.ENGINE_SETTINGS, settings })
        .catch(() => {});
    }
  });
}

// ── Controles ──
const signed = (v, unit = '') => (v > 0 ? `+${v}${unit}` : `${v}${unit}`);

function knobTitle(label, format, value) {
  return t('knob.hint', { label, value: format(value) });
}

function fxKnob(labelKey, opts) {
  const label = t(labelKey);
  const defaultValue = opts.defaultValue ?? 0;
  return createKnob(ui.fx, { ...opts, label, title: knobTitle(label, opts.format, defaultValue) });
}

function buildControls() {
  ui.volume.replaceChildren();
  ui.eq.replaceChildren();
  ui.fx.replaceChildren();

  const volumeFormat = (v) => `${v} %`;
  controls.volume = createKnob(ui.volume, {
    label: t('volume.aria'),
    title: knobTitle(t('volume.aria'), volumeFormat, RANGE.volume.unity),
    min: RANGE.volume.min,
    max: RANGE.volume.max,
    wheelStep: 5,
    value: settings.volume,
    defaultValue: RANGE.volume.unity,
    size: 120,
    center: true,
    ticks: [0, 100, 300, 600],
    toTravel: volumeToTravel,
    fromTravel: travelToVolume,
    zoneOf: volumeZone,
    format: volumeFormat,
    readout: (v) => `<b>${v}</b><small>${t(`zone.${volumeZone(v)}`)}</small>`,
    onInput: (volume) => commit({ volume }),
  });

  controls.eq = EQ_BANDS.map((band, i) =>
    createFader(ui.eq, {
      label: band.label,
      title: t('eq.hint', { label: band.label }),
      min: RANGE.eq.min,
      max: RANGE.eq.max,
      value: settings.eq[i],
      onInput: (gain) => {
        const eq = [...settings.eq];
        eq[i] = gain;
        commit({ eq });
      },
    }));

  controls.pitch = fxKnob('fx.pitch', {
    ...RANGE.pitch,
    value: settings.pitch,
    bipolar: true,
    format: (v) => (v === 0 ? '0 st' : signed(v, ' st')),
    onInput: (pitch) => commit({ pitch }),
  });

  controls.pan = fxKnob('fx.pan', {
    ...RANGE.pan,
    wheelStep: 5,
    value: settings.pan,
    bipolar: true,
    format: (v) => (v === 0 ? t('pan.center') : v < 0 ? `${t('pan.left')} ${-v}` : `${t('pan.right')} ${v}`),
    onInput: (pan) => commit({ pan }),
  });

  controls.reverbMix = fxKnob('fx.reverb', {
    ...RANGE.reverbMix,
    wheelStep: 5,
    value: settings.reverb.mix,
    format: (v) => `${v} %`,
    onInput: (mix) => commit({ reverb: { ...settings.reverb, mix } }),
  });

  controls.reverbDecay = fxKnob('fx.room', {
    ...RANGE.reverbDecay,
    step: 0.1,
    value: settings.reverb.decay,
    defaultValue: DEFAULT_SETTINGS.reverb.decay,
    format: (v) => `${v.toFixed(1)} s`,
    onInput: (decay) => commit({ reverb: { ...settings.reverb, decay } }),
  });
}

function syncControls() {
  controls.volume.set(settings.volume);
  controls.eq.forEach((f, i) => f.set(settings.eq[i]));
  controls.pitch.set(settings.pitch);
  controls.pan.set(settings.pan);
  controls.reverbMix.set(settings.reverb.mix);
  controls.reverbDecay.set(settings.reverb.decay);
  renderToggles();
}

function renderToggles() {
  ui.mute.setAttribute('aria-pressed', settings.muted);
  ui.volume.classList.toggle('is-muted', settings.muted);
  ui.bypass.setAttribute('aria-pressed', !settings.bypass);
  ui.fx.classList.toggle('is-off', settings.bypass);
  ui.eq.classList.toggle('is-off', settings.bypass);
  ui.auto.checked = settings.autoCapture;
}

// ── Tema e idioma ──
function rememberUiPrefs() {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ theme: settings.theme, lang: settings.lang }));
  } catch (_) { /* opcional: solo evita el parpadeo del tema */ }
}

function applyTheme() {
  root.dataset.theme = settings.theme;
  ui.theme.title = t(settings.theme === 'dark' ? 'theme.toLight' : 'theme.toDark');
  ui.theme.setAttribute('aria-label', ui.theme.title);
}

function applyLang() {
  setLang(settings.lang);
  translateDom();
  ui.langSeg.querySelectorAll('[data-lang]').forEach((b) => {
    b.setAttribute('aria-checked', b.dataset.lang === settings.lang);
  });
  applyTheme();
  setCaptureUi(captureState);
  renderNotice();
}

// ── Captura ──
function setCaptureUi(state) {
  captureState = state;
  app.dataset.capture = state;
  ui.power.setAttribute('aria-pressed', state === 'on');
  ui.power.title = t(state === 'on' ? 'power.turnOff' : 'power.turnOn');
  ui.state.textContent = t(`capture.${state}`);
}

function showNotice(key, params = {}, tone = 'error') {
  notice = { key, params, tone };
  renderNotice();
}

function hideNotice() {
  notice = null;
  renderNotice();
}

function renderNotice() {
  ui.notice.hidden = !notice;
  if (!notice) return;
  ui.notice.textContent = t(notice.key, notice.params);
  ui.notice.dataset.tone = notice.tone;
}

function showError(e) {
  const msg = String(e?.message || e);
  if (/active stream/i.test(msg)) showNotice('error.busy');
  else if (/invoked|activeTab|permission/i.test(msg)) showNotice('error.invoke');
  else showNotice('error.generic', { msg });
}

async function refreshStatus() {
  const res = await toBackground(MSG.STATUS).catch(() => null);
  const tabs = res?.tabs ?? [];
  engineAlive = tabs.length > 0;
  capturing = tabs.includes(tab.id);
  setCaptureUi(capturing ? 'on' : 'idle');
}

async function startCapture() {
  setCaptureUi('busy');
  hideNotice();
  try {
    await saveSettings(settings);
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    const res = await toBackground(MSG.CAPTURE_START, { tabId: tab.id, streamId });
    if (!res?.ok) throw new Error(res?.error || 'empty response');
    capturing = true;
    engineAlive = true;
    setCaptureUi('on');
    connectMeter();
  } catch (e) {
    capturing = false;
    setCaptureUi('idle');
    showError(e);
  }
}

async function stopCapture() {
  setCaptureUi('busy');
  const res = await toBackground(MSG.CAPTURE_STOP, { tabId: tab.id }).catch(() => null);
  capturing = false;
  engineAlive = (res?.tabs ?? []).length > 0;
  disconnectMeter();
  setCaptureUi('idle');
}

// ── Vúmetro ──
const meter = createMeter($('meter'));

function connectMeter() {
  if (meterPort) return;
  meterPort = chrome.runtime.connect({ name: METER_PORT });
  meterPort.onMessage.addListener((levels) => meter.push(levels));
  meterPort.onDisconnect.addListener(() => {
    meterPort = null;
    meter.reset();
  });
}

function disconnectMeter() {
  meterPort?.disconnect();
  meterPort = null;
  meter.reset();
}

// ── Eventos ──
ui.power.addEventListener('click', () => (capturing ? stopCapture() : startCapture()));
ui.mute.addEventListener('click', () => commit({ muted: !settings.muted }));
ui.unity.addEventListener('click', () => {
  controls.volume.set(RANGE.volume.unity);
  commit({ volume: RANGE.volume.unity, muted: false });
});
ui.eqReset.addEventListener('click', () => {
  commit({ eq: DEFAULT_SETTINGS.eq.slice() });
  syncControls();
});
ui.bypass.addEventListener('click', () => commit({ bypass: !settings.bypass }));
ui.auto.addEventListener('change', () => commit({ autoCapture: ui.auto.checked }));
ui.theme.addEventListener('click', () => {
  commit({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  applyTheme();
  rememberUiPrefs();
});
ui.langSeg.addEventListener('click', (e) => {
  const lang = e.target.closest('[data-lang]')?.dataset.lang;
  if (!lang || lang === settings.lang) return;
  commit({ lang });
  applyLang();
  buildControls();
  rememberUiPrefs();
});
ui.reset.addEventListener('click', () => {
  const { autoCapture, theme, lang } = settings;
  commit({ ...structuredClone(DEFAULT_SETTINGS), autoCapture, theme, lang });
  syncControls();
});

function hostOf(url) {
  try { return new URL(url).hostname || url; } catch { return '—'; }
}

async function init() {
  addScrews(document.querySelectorAll('[data-rack]'));
  settings = await loadSettings();
  applyLang();
  rememberUiPrefs();
  buildControls();
  renderToggles();

  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  ui.host.textContent = hostOf(tab?.url);

  if (!tab?.id || (tab.url && BLOCKED_URL.test(tab.url))) {
    setCaptureUi('blocked');
    ui.power.disabled = true;
    showNotice('notice.blocked', {}, 'info');
    return;
  }

  await refreshStatus();
  if (capturing) connectMeter();
  else if (settings.autoCapture) await startCapture();
  else showNotice('notice.idle', {}, 'info');
}

init();
