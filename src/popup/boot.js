// Script clásico en <head>: aplica tema e idioma antes del primer pintado (sin parpadeo).
// popup.js mantiene esta copia sincronizada con chrome.storage.
try {
  const prefs = JSON.parse(localStorage.getItem('dragonAudio.ui') || '{}');
  if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
  if (prefs.lang) document.documentElement.lang = prefs.lang;
} catch (_) { /* sin almacenamiento local: se usa el tema por defecto */ }
