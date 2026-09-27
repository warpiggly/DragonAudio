import { METER_PORT, MSG, TARGET } from '../shared/constants.js';
import { AudioEngine } from './engine/AudioEngine.js';

// Documento oculto y persistente: aquí vive el AudioContext.
// Solo tiene chrome.runtime → la configuración llega por mensajes.
const METER_INTERVAL_MS = 33;

const engine = new AudioEngine({ onTabEnded: notifyIfIdle });

function notifyIfIdle() {
  if (engine.tabIds.length > 0) return;
  chrome.runtime.sendMessage({ target: TARGET.BACKGROUND, type: MSG.ENGINE_IDLE }).catch(() => {});
}

async function handle(msg) {
  switch (msg.type) {
    case MSG.ENGINE_ADD_TAB:
      if (msg.settings) engine.setSettings(msg.settings);
      await engine.addTab(msg.tabId, msg.streamId);
      return { ok: true, tabs: engine.tabIds };

    case MSG.ENGINE_REMOVE_TAB:
      engine.removeTab(msg.tabId);
      notifyIfIdle();
      return { ok: true, tabs: engine.tabIds };

    case MSG.ENGINE_SETTINGS:
      engine.setSettings(msg.settings);
      return { ok: true };

    case MSG.ENGINE_STATUS:
      return { ok: true, tabs: engine.tabIds };

    default:
      return { ok: false, error: `Mensaje desconocido: ${msg.type}` };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== TARGET.OFFSCREEN) return false;
  handle(msg).then(sendResponse, (e) => {
    console.error('[DragonAudio] offscreen', e);
    sendResponse({ ok: false, error: e.message });
  });
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== METER_PORT) return;
  const timer = setInterval(() => port.postMessage(engine.readLevels()), METER_INTERVAL_MS);
  port.onDisconnect.addListener(() => clearInterval(timer));
});
