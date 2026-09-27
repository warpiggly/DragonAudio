import { MSG, TARGET } from '../shared/constants.js';
import { loadSettings } from '../shared/settings.js';
import * as offscreen from './offscreen-client.js';

// Orquesta la captura. El estado real (qué pestañas se capturan) vive en el
// offscreen: el service worker puede dormirse y perder variables en memoria.

async function status() {
  if (!(await offscreen.exists())) return { ok: true, tabs: [] };
  return offscreen.send(MSG.ENGINE_STATUS);
}

async function startCapture(tabId, streamId) {
  await offscreen.ensure();
  const settings = await loadSettings();
  return offscreen.send(MSG.ENGINE_ADD_TAB, { tabId, streamId, settings });
}

async function stopCapture(tabId) {
  if (!(await offscreen.exists())) return { ok: true, tabs: [] };
  return offscreen.send(MSG.ENGINE_REMOVE_TAB, { tabId });
}

async function closeIfIdle() {
  const { tabs = [] } = await status();
  if (tabs.length === 0) await offscreen.close();
  return { ok: true };
}

async function handle(msg) {
  switch (msg.type) {
    case MSG.CAPTURE_START: return startCapture(msg.tabId, msg.streamId);
    case MSG.CAPTURE_STOP:  return stopCapture(msg.tabId);
    case MSG.STATUS:        return status();
    case MSG.ENGINE_IDLE:   return closeIfIdle();
    default: return { ok: false, error: `Mensaje desconocido: ${msg.type}` };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== TARGET.BACKGROUND) return false;
  handle(msg).then(sendResponse, (e) => {
    console.error('[DragonAudio] background', e);
    sendResponse({ ok: false, error: e.message });
  });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  stopCapture(tabId).catch(() => {});
});

// Atajo de teclado (Alt+Shift+D): activa/desactiva sin abrir el popup.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-capture' || !tab?.id) return;
  try {
    const { tabs = [] } = await status();
    if (tabs.includes(tab.id)) {
      await stopCapture(tab.id);
      return;
    }
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    await startCapture(tab.id, streamId);
  } catch (e) {
    console.warn('[DragonAudio] atajo', e);
  }
});
