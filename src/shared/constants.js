// Contrato compartido entre popup, service worker y offscreen.

export const OFFSCREEN_PATH = 'src/offscreen/offscreen.html';
export const STORAGE_KEY = 'dragonAudio.settings';
export const LEGACY_STORAGE_KEY = 'dragonAudioState';

export const TARGET = {
  BACKGROUND: 'background',
  OFFSCREEN: 'offscreen',
};

export const MSG = {
  CAPTURE_START: 'capture:start',
  CAPTURE_STOP: 'capture:stop',
  STATUS: 'status',
  ENGINE_ADD_TAB: 'engine:add-tab',
  ENGINE_REMOVE_TAB: 'engine:remove-tab',
  ENGINE_SETTINGS: 'engine:settings',
  ENGINE_STATUS: 'engine:status',
  ENGINE_IDLE: 'engine:idle',
};

export const METER_PORT = 'meter';

// El EQ de siempre: 5 bandas, ±12 dB, Q = 1.
export const EQ_BANDS = [
  { freq: 60,    type: 'lowshelf',  label: '60' },
  { freq: 250,   type: 'peaking',   label: '250' },
  { freq: 1000,  type: 'peaking',   label: '1K' },
  { freq: 4000,  type: 'peaking',   label: '4K' },
  { freq: 12000, type: 'highshelf', label: '12K' },
];

export const RANGE = {
  volume: { min: 0, max: 600, unity: 100, danger: 300 },
  eq:     { min: -12, max: 12 },
  pitch:  { min: -12, max: 12 },
  pan:    { min: -100, max: 100 },
  reverbMix:   { min: 0, max: 100 },
  reverbDecay: { min: 0.5, max: 5 },
};

export const DEFAULT_SETTINGS = Object.freeze({
  volume: 100,
  muted: false,
  bypass: false,
  eq: [0, 0, 0, 0, 0],
  pitch: 0,
  pan: 0,
  reverb: { mix: 0, decay: 2 },
  autoCapture: true,
  theme: 'dark',
  lang: 'en',
});

export const THEMES = ['dark', 'light'];
export const LANGS = ['en', 'es'];
