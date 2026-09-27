import { DEFAULT_SETTINGS, EQ_BANDS, LANGS, LEGACY_STORAGE_KEY, RANGE, STORAGE_KEY, THEMES } from './constants.js';

const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

const clamp = (v, { min, max }, fallback) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

export function sanitizeSettings(raw = {}) {
  const d = DEFAULT_SETTINGS;
  const eq = Array.isArray(raw.eq) ? raw.eq : d.eq;
  return {
    volume: clamp(raw.volume, RANGE.volume, d.volume),
    muted: Boolean(raw.muted),
    bypass: Boolean(raw.bypass),
    eq: EQ_BANDS.map((_, i) => clamp(eq[i], RANGE.eq, 0)),
    pitch: clamp(raw.pitch, RANGE.pitch, d.pitch),
    pan: clamp(raw.pan, RANGE.pan, d.pan),
    reverb: {
      mix: clamp(raw.reverb?.mix, RANGE.reverbMix, d.reverb.mix),
      decay: clamp(raw.reverb?.decay, RANGE.reverbDecay, d.reverb.decay),
    },
    autoCapture: raw.autoCapture ?? d.autoCapture,
    theme: oneOf(raw.theme, THEMES, d.theme),
    lang: oneOf(raw.lang, LANGS, d.lang),
  };
}

// Estado de la versión anterior de la extensión (popup.js v1).
function fromLegacy(old) {
  return {
    volume: old.volume,
    muted: old.isMuted,
    eq: old.eq,
    pitch: old.pitch,
    pan: old.pan,
  };
}

export async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
    if (stored[STORAGE_KEY]) return sanitizeSettings(stored[STORAGE_KEY]);
    if (stored[LEGACY_STORAGE_KEY]) {
      const migrated = sanitizeSettings(fromLegacy(stored[LEGACY_STORAGE_KEY]));
      await chrome.storage.local.set({ [STORAGE_KEY]: migrated });
      await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
      return migrated;
    }
  } catch (e) {
    console.warn('[DragonAudio] no se pudo leer la configuración', e);
  }
  return sanitizeSettings();
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEY]: sanitizeSettings(settings) });
}
