// Textos del popup. Inglés por defecto; español opcional.
const MESSAGES = {
  en: {
    'capture.on': 'Active',
    'capture.idle': 'Inactive',
    'capture.busy': 'Connecting…',
    'capture.blocked': 'Unavailable',
    'power.turnOn': 'Turn on for this tab · Alt+Shift+D',
    'power.turnOff': 'Turn off for this tab · Alt+Shift+D',
    'volume.aria': 'Volume',
    'volume.mute': 'Mute',
    'volume.unity': 'Back to 100 %',
    'zone.normal': 'Normal',
    'zone.unity': 'Original',
    'zone.boost': 'Boosted',
    'zone.danger': 'Danger',
    'eq.title': 'Equalizer',
    'eq.reset': 'Flat EQ',
    'eq.hint': '{label} Hz · double-click: 0 dB',
    'fx.title': 'Effects',
    'fx.bypass': 'Effects on / off',
    'fx.pitch': 'Pitch',
    'fx.pan': 'Pan',
    'fx.reverb': 'Reverb',
    'fx.room': 'Room',
    'knob.hint': '{label} · double-click: {value}',
    'pan.left': 'L',
    'pan.right': 'R',
    'pan.center': 'C',
    'foot.auto': 'Auto',
    'foot.autoHint': 'Turn on automatically when the popup opens',
    'foot.reset': 'Reset',
    'foot.lang': 'Language',
    'theme.toLight': 'Light theme',
    'theme.toDark': 'Dark theme',
    'notice.blocked': 'Chrome does not allow audio capture on this page.',
    'notice.idle': 'Tap ⏻ to turn on Dragon Audio for this tab.',
    'error.busy': 'This tab is already being captured by another extension or by Chrome.',
    'error.invoke': 'Open Dragon Audio from this tab to turn it on.',
    'error.generic': 'Could not turn on: {msg}',
  },
  es: {
    'capture.on': 'Activo',
    'capture.idle': 'Inactivo',
    'capture.busy': 'Conectando…',
    'capture.blocked': 'No disponible',
    'power.turnOn': 'Activar en esta pestaña · Alt+Shift+D',
    'power.turnOff': 'Desactivar en esta pestaña · Alt+Shift+D',
    'volume.aria': 'Volumen',
    'volume.mute': 'Mute',
    'volume.unity': 'Volver a 100 %',
    'zone.normal': 'Normal',
    'zone.unity': 'Original',
    'zone.boost': 'Amplificado',
    'zone.danger': 'Peligro',
    'eq.title': 'Ecualizador',
    'eq.reset': 'EQ plano',
    'eq.hint': '{label} Hz · doble clic: 0 dB',
    'fx.title': 'Efectos',
    'fx.bypass': 'Encender / apagar efectos',
    'fx.pitch': 'Tono',
    'fx.pan': 'Paneo',
    'fx.reverb': 'Reverb',
    'fx.room': 'Sala',
    'knob.hint': '{label} · doble clic: {value}',
    'pan.left': 'I',
    'pan.right': 'D',
    'pan.center': 'C',
    'foot.auto': 'Auto',
    'foot.autoHint': 'Activar solo al abrir el popup',
    'foot.reset': 'Restablecer',
    'foot.lang': 'Idioma',
    'theme.toLight': 'Tema claro',
    'theme.toDark': 'Tema oscuro',
    'notice.blocked': 'Chrome no permite capturar audio en esta página.',
    'notice.idle': 'Toca ⏻ para activar Dragon Audio en esta pestaña.',
    'error.busy': 'Esta pestaña ya está siendo capturada por otra extensión o por Chrome.',
    'error.invoke': 'Abre Dragon Audio desde esta pestaña para activarlo.',
    'error.generic': 'No se pudo activar: {msg}',
  },
};

let lang = 'en';

export function setLang(next) {
  lang = MESSAGES[next] ? next : 'en';
  document.documentElement.lang = lang;
}

export function t(key, params = {}) {
  const text = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
}

// Aplica textos a los nodos marcados: data-i18n (texto), data-i18n-title, data-i18n-aria.
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
