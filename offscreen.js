// === Offscreen Document ===
// Vive en un contexto persistente (no se cierra con el popup).
// Captura el audio de la pestaña via tabCapture y lo procesa con Web Audio API.
// Reproduce el audio procesado al destino (altavoces).

let audioContext = null;
let mediaStream = null;
let sourceNode = null;
let gainNode = null;
let panNode = null;
let eqNodes = [];
let compressorNode = null;
let isCaptureActive = false;

// Configuracion de las 5 bandas del EQ (igual que en popup.js)
const EQ_CONFIG = [
  { freq: 60,    type: 'lowshelf'  },  // Subgraves
  { freq: 250,   type: 'peaking'   },  // Bajos
  { freq: 1000,  type: 'peaking'   },  // Medios
  { freq: 4000,  type: 'peaking'   },  // Agudos
  { freq: 12000, type: 'highshelf' }   // Brillo
];

// Iniciar captura: obtiene MediaStream y monta la cadena de Web Audio API
async function startCapture(streamId) {
  // Limpiar captura anterior si existe
  stopCapture();

  // Obtener el MediaStream del tab capturado usando el streamId
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });

  // Crear el AudioContext
  audioContext = new AudioContext();

  // Crear nodos
  sourceNode = audioContext.createMediaStreamSource(mediaStream);
  gainNode = audioContext.createGain();
  panNode = audioContext.createStereoPanner();

  // Crear los 5 BiquadFilterNodes del EQ
  eqNodes = EQ_CONFIG.map(({ freq, type }) => {
    const filter = audioContext.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.gain.value = 0;
    filter.Q.value = 1;
    return filter;
  });

  // Crear compresor (sin comprimir por defecto)
  compressorNode = audioContext.createDynamicsCompressor();
  compressorNode.threshold.value = 0;
  compressorNode.ratio.value = 1;
  compressorNode.knee.value = 30;
  compressorNode.attack.value = 0.003;
  compressorNode.release.value = 0.25;

  // Conectar cadena: source → eq[0..4] → compressor → gain → pan → destination
  sourceNode.connect(eqNodes[0]);
  for (let i = 0; i < eqNodes.length - 1; i++) {
    eqNodes[i].connect(eqNodes[i + 1]);
  }
  eqNodes[eqNodes.length - 1].connect(compressorNode);
  compressorNode.connect(gainNode);
  gainNode.connect(panNode);
  panNode.connect(audioContext.destination);

  isCaptureActive = true;
  console.log('Captura iniciada');
}

// Detener captura y liberar recursos
function stopCapture() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  sourceNode = null;
  gainNode = null;
  panNode = null;
  eqNodes = [];
  compressorNode = null;
  isCaptureActive = false;
}

// Aplicar un parametro de audio al nodo correspondiente
function applyAudioParam(action, value) {
  if (!isCaptureActive) return;

  switch (action) {
    case 'setVolume':
      if (gainNode) {
        gainNode.gain.value = value / 100;
      }
      break;

    case 'setPan':
      if (panNode) {
        panNode.pan.value = value / 100;
      }
      break;

    case 'mute':
      if (gainNode) {
        gainNode.gain.value = 0;
      }
      break;

    case 'unmute':
      if (gainNode) {
        gainNode.gain.value = (value !== undefined ? value : 100) / 100;
      }
      break;

    case 'setEQ':
      // value = { band: 0..4, gain: -12..12 }
      if (eqNodes[value.band]) {
        eqNodes[value.band].gain.value = value.gain;
      }
      break;

    case 'setCompressorEnabled':
      // value = { enabled: bool, threshold: number, ratio: number }
      if (compressorNode) {
        if (value.enabled) {
          compressorNode.threshold.value = value.threshold;
          compressorNode.ratio.value = value.ratio;
        } else {
          // "Apagado": no comprime
          compressorNode.threshold.value = 0;
          compressorNode.ratio.value = 1;
        }
      }
      break;

    case 'setCompressorThreshold':
      if (compressorNode) {
        compressorNode.threshold.value = value;
      }
      break;

    case 'setCompressorRatio':
      if (compressorNode) {
        compressorNode.ratio.value = value;
      }
      break;

    case 'reset':
      // Volumen y pan a defaults
      if (gainNode) gainNode.gain.value = 1;
      if (panNode) panNode.pan.value = 0;
      // EQ a 0 dB
      eqNodes.forEach(n => { n.gain.value = 0; });
      // Compresor apagado
      if (compressorNode) {
        compressorNode.threshold.value = 0;
        compressorNode.ratio.value = 1;
      }
      break;
  }
}

// Escuchar mensajes del background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    return false;
  }

  (async () => {
    try {
      switch (message.type) {
        case 'startCapture':
          await startCapture(message.streamId);
          sendResponse({ success: true });
          break;

        case 'stopCapture':
          stopCapture();
          sendResponse({ success: true });
          break;

        case 'audioParam':
          applyAudioParam(message.action, message.value);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Tipo desconocido' });
      }
    } catch (e) {
      console.error('Error en offscreen:', e);
      sendResponse({ success: false, error: e.message });
    }
  })();

  return true; // Mantener canal abierto para respuesta async
});
