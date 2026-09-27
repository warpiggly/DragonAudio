// === Service Worker (background) ===
// Orquesta la captura de audio de pestañas para sitios DRM (Spotify, Netflix, etc.)
// Crea/destruye un offscreen document que mantiene el AudioContext vivo
// incluso cuando el popup se cierra.

let captureTabId = null;        // ID de la pestaña actualmente capturada (null = no hay captura)
const OFFSCREEN_PATH = 'offscreen.html';

chrome.runtime.onInstalled.addListener(() => {
  console.log('DragonAudio instalado');
});

// Asegurar que existe el offscreen document
async function ensureOffscreen() {
  // Verificar si ya existe usando getContexts (API correcta en MV3)
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  });

  if (existing.length === 0) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['USER_MEDIA'],
      justification: 'Procesar audio capturado de la pestaña con Web Audio API'
    });
  }
}

// Cerrar el offscreen document
async function closeOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  });

  if (existing.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

// Manejar mensajes desde el popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Solo responder a mensajes destinados al background
  if (message.target !== 'background') {
    return false;
  }

  (async () => {
    try {
      switch (message.type) {
        case 'startCapture': {
          // El popup ya obtuvo el streamId desde su contexto (user gesture)
          const { tabId, streamId } = message;

          if (!streamId) {
            sendResponse({ success: false, error: 'Falta streamId' });
            break;
          }

          // Asegurar offscreen document
          await ensureOffscreen();

          // Pasar streamId al offscreen para iniciar captura
          const result = await chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'startCapture',
            streamId
          });

          if (result && result.success) {
            captureTabId = tabId;
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: (result && result.error) || 'Error desconocido' });
          }
          break;
        }

        case 'stopCapture': {
          // Detener en offscreen
          await chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'stopCapture'
          }).catch(() => {});

          // Cerrar offscreen para liberar recursos
          await closeOffscreen();
          captureTabId = null;
          sendResponse({ success: true });
          break;
        }

        case 'getCaptureStatus': {
          sendResponse({ active: captureTabId !== null, tabId: captureTabId });
          break;
        }

        case 'audioParam': {
          // Reenviar parametro de audio al offscreen
          if (captureTabId === null) {
            sendResponse({ success: false, error: 'Captura no activa' });
            break;
          }
          await chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'audioParam',
            action: message.action,
            value: message.value
          }).catch(() => {});
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Tipo desconocido' });
      }
    } catch (e) {
      console.error('Error en background:', e);
      sendResponse({ success: false, error: e.message });
    }
  })();

  return true; // Mantener canal abierto para respuesta async
});

// Si la pestaña capturada se cierra, limpiar el estado
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === captureTabId) {
    closeOffscreen().catch(() => {});
    captureTabId = null;
  }
});
