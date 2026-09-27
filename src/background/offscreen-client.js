import { OFFSCREEN_PATH, TARGET } from '../shared/constants.js';

const url = chrome.runtime.getURL(OFFSCREEN_PATH);
let creating = null;

export async function exists() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url],
  });
  return contexts.length > 0;
}

export async function ensure() {
  if (await exists()) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['USER_MEDIA'],
      justification: 'Procesar el audio capturado de la pestaña con Web Audio API',
    })
    .finally(() => { creating = null; });
  await creating;
}

export async function close() {
  if (await exists()) await chrome.offscreen.closeDocument();
}

export function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ target: TARGET.OFFSCREEN, type, ...payload });
}
