// Variables globales
let isMuted = false;
let previousVolume = 100;

// Referencias a elementos del DOM
const volumeSlider = document.getElementById('volumeSlider');
const panSlider = document.getElementById('panSlider');
const volumeValue = document.getElementById('volumeValue');
const panValue = document.getElementById('panValue');
const muteBtn = document.getElementById('muteBtn');
const resetBtn = document.getElementById('resetBtn');
const status = document.getElementById('status');
const volumeWarning = document.getElementById('volumeWarning');

// Referencias del Ecualizador (5 bandas)
const eqSliders = [
  document.getElementById('eqBand0'),
  document.getElementById('eqBand1'),
  document.getElementById('eqBand2'),
  document.getElementById('eqBand3'),
  document.getElementById('eqBand4')
];
const eqValues = [
  document.getElementById('eqValue0'),
  document.getElementById('eqValue1'),
  document.getElementById('eqValue2'),
  document.getElementById('eqValue3'),
  document.getElementById('eqValue4')
];

// Referencias del Pitch
const pitchSlider = document.getElementById('pitchSlider');
const pitchValue = document.getElementById('pitchValue');
const pitchNote = document.getElementById('pitchNote');

// Referencias del Compresor
const compressorToggle = document.getElementById('compressorToggle');
const compressorControls = document.getElementById('compressorControls');
const compressorThreshold = document.getElementById('compressorThreshold');
const compressorThresholdValue = document.getElementById('compressorThresholdValue');
const compressorRatio = document.getElementById('compressorRatio');
const compressorRatioValue = document.getElementById('compressorRatioValue');

// Notas musicales relativas (asumiendo Do/C como tono original)
const NOTE_NAMES = [
  'Do (C)', 'Do# (C#)', 'Re (D)', 'Re# (D#)', 'Mi (E)', 'Fa (F)',
  'Fa# (F#)', 'Sol (G)', 'Sol# (G#)', 'La (A)', 'La# (A#)', 'Si (B)'
];

// Lista de sitios DRM (debe coincidir con la del executeAudioControl)
const DRM_HOSTS_POPUP = [
  'open.spotify.com',
  'music.youtube.com',
  'www.netflix.com',
  'www.primevideo.com',
  'www.disneyplus.com',
  'play.max.com',
  'www.hbomax.com',
  'music.apple.com',
  'tidal.com',
  'listen.tidal.com',
  'play.deezer.com'
];

const drmWarning = document.getElementById('drmWarning');
const captureBtn = document.getElementById('captureBtn');
const captureStatus = document.getElementById('captureStatus');

// Estado de la captura de audio (tabCapture + offscreen)
let captureActive = false;

// Detectar si la pestaña activa es un sitio DRM y mostrar advertencia
async function detectDRMSite() {
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab || !tab.url) return false;

    const url = new URL(tab.url);
    const isDRM = DRM_HOSTS_POPUP.some(h => url.hostname === h || url.hostname.endsWith('.' + h));

    if (isDRM) {
      drmWarning.classList.add('show');
      // Deshabilitar visualmente los controles que no funcionan en DRM
      panSlider.disabled = true;
      pitchSlider.disabled = true;
      eqSliders.forEach(s => s.disabled = true);
      compressorToggle.disabled = true;
      compressorThreshold.disabled = true;
      compressorRatio.disabled = true;
      // Limitar el slider de volumen a 100% en DRM (no se puede boost)
      volumeSlider.max = 100;
    }
    return isDRM;
  } catch (e) {
    console.error('Error detectando DRM:', e);
    return false;
  }
}

// Umbrales de advertencia para volumen amplificado
const VOLUME_BOOST_THRESHOLD = 100;   // Cuando empieza el boost
const VOLUME_DANGER_THRESHOLD = 300;  // Cuando puede ser peligroso

// === SISTEMA DE PERSISTENCIA DE ESTADO ===
const STATE_KEY = 'dragonAudioState';

// Estado por defecto al iniciar (todo neutro)
const DEFAULT_STATE = {
  volume: 100,
  pan: 0,
  isMuted: false,
  previousVolume: 100,
  eq: [0, 0, 0, 0, 0],
  pitch: 0,
  compressor: { enabled: false, threshold: -24, ratio: 4 }
};

// Guardar parcialmente el estado (merge con lo existente)
async function saveState(updates) {
  try {
    const result = await chrome.storage.local.get(STATE_KEY);
    const current = result[STATE_KEY] || DEFAULT_STATE;
    const newState = { ...current, ...updates };
    await chrome.storage.local.set({ [STATE_KEY]: newState });
  } catch (e) {
    console.error('Error guardando estado:', e);
  }
}

// Cargar estado completo
async function loadState() {
  try {
    const result = await chrome.storage.local.get(STATE_KEY);
    return result[STATE_KEY] || DEFAULT_STATE;
  } catch (e) {
    console.error('Error cargando estado:', e);
    return DEFAULT_STATE;
  }
}

// Borrar estado guardado (al hacer reset)
async function clearState() {
  try {
    await chrome.storage.local.set({ [STATE_KEY]: DEFAULT_STATE });
  } catch (e) {
    console.error('Error borrando estado:', e);
  }
}

// Funciones para actualizar las etiquetas de valores
function updateVolumeDisplay(value) {
  volumeValue.textContent = `${value}%`;

  // Limpiar clases previas
  volumeValue.classList.remove('boost', 'danger');
  volumeWarning.classList.remove('show', 'danger');

  if (value > VOLUME_DANGER_THRESHOLD) {
    // Zona peligrosa: 301-500%
    volumeValue.classList.add('danger');
    volumeWarning.classList.add('show', 'danger');
    volumeWarning.innerHTML = '&#9888; PELIGRO: Volumen extremo. Puede danar tus oidos y los altavoces.';
  } else if (value > VOLUME_BOOST_THRESHOLD) {
    // Zona de boost: 101-300%
    volumeValue.classList.add('boost');
    volumeWarning.classList.add('show');
    volumeWarning.innerHTML = '&#9888; Volumen amplificado. Cuida tus oidos.';
  }
}

function updatePanDisplay(value) {
  if (value < 0) {
    panValue.textContent = `Izquierda (${Math.abs(value)})`;
  } else if (value > 0) {
    panValue.textContent = `Derecha (${value})`;
  } else {
    panValue.textContent = 'Centro (0)';
  }
}

// Actualizar display del valor de una banda del EQ
function updateEQDisplay(bandIndex, value) {
  const sign = value > 0 ? '+' : '';
  eqValues[bandIndex].textContent = `${sign}${value} dB`;
}

// Actualizar display del threshold del compresor
function updateCompressorThresholdDisplay(value) {
  compressorThresholdValue.textContent = `${value} dB`;
}

// Actualizar display del ratio del compresor
function updateCompressorRatioDisplay(value) {
  compressorRatioValue.textContent = `${value} : 1`;
}

// Actualizar display del pitch (semitonos + nota musical)
function updatePitchDisplay(semitones) {
  // Texto descriptivo
  if (semitones === 0) {
    pitchValue.textContent = 'Tono original';
    pitchNote.classList.remove('shifted');
  } else if (semitones === 12) {
    pitchValue.textContent = '+1 octava (mas agudo y rapido)';
    pitchNote.classList.add('shifted');
  } else if (semitones === -12) {
    pitchValue.textContent = '-1 octava (mas grave y lento)';
    pitchNote.classList.add('shifted');
  } else {
    const sign = semitones > 0 ? '+' : '';
    pitchValue.textContent = `${sign}${semitones} semitonos`;
    pitchNote.classList.add('shifted');
  }

  // Nota musical relativa (asumiendo original = Do/C)
  // Modulo 12 manejando negativos correctamente
  const noteIndex = ((semitones % 12) + 12) % 12;
  let noteText = NOTE_NAMES[noteIndex];

  // Indicar octava
  if (semitones >= 12) {
    noteText += ' [+1 oct]';
  } else if (semitones <= -12) {
    noteText += ' [-1 oct]';
  }

  pitchNote.textContent = noteText;
}

// Función para enviar comandos al content script
async function sendCommand(action, value) {
  try {
    // Si la captura tabCapture esta activa, enviar todo al background → offscreen
    // Excepto el pitch, que requiere acceso al elemento (no funciona con MediaStream)
    if (captureActive && action !== 'setPitch') {
      // Para mute, ademas silenciar a nivel de Chrome para evitar doble audio
      if (action === 'mute') {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        await chrome.tabs.update(tab.id, { muted: true });
      } else if (action === 'unmute') {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        await chrome.tabs.update(tab.id, { muted: false });
      }

      await chrome.runtime.sendMessage({
        target: 'background',
        type: 'audioParam',
        action,
        value
      });
      return;
    }

    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

    // Mute/unmute: usar chrome.tabs.update({muted}) - funciona universalmente
    if (action === 'mute') {
      await chrome.tabs.update(tab.id, { muted: true });
      return;
    }
    if (action === 'unmute') {
      await chrome.tabs.update(tab.id, { muted: false });
      try {
        await chrome.scripting.executeScript({
          target: {tabId: tab.id},
          func: executeAudioControl,
          args: [{action: 'setVolume', value}]
        });
      } catch (e) { /* ignorar */ }
      return;
    }

    // Para todo lo demas, ejecutar en la pagina
    await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: executeAudioControl,
      args: [{action, value}]
    });

  } catch (error) {
    console.error('Error al enviar comando:', error);
    status.textContent = 'Error: No se pudo controlar el audio';
  }
}

// === Funciones de captura tabCapture ===

// Iniciar la captura: pide al background que la inicie en el offscreen document
async function startTabCapture() {
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

    captureStatus.textContent = 'Iniciando captura...';
    captureBtn.disabled = true;

    // Obtener streamId desde el popup (contexto con user gesture)
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(id);
        }
      });
    });

    const response = await chrome.runtime.sendMessage({
      target: 'background',
      type: 'startCapture',
      tabId: tab.id,
      streamId
    });

    if (response && response.success) {
      captureActive = true;
      captureBtn.textContent = 'Detener Captura Avanzada';
      captureBtn.style.backgroundColor = '#f44336';
      captureStatus.textContent = 'Captura activa - todos los efectos disponibles';

      // Habilitar todos los controles excepto pitch
      panSlider.disabled = false;
      eqSliders.forEach(s => s.disabled = false);
      compressorToggle.disabled = false;
      compressorThreshold.disabled = false;
      compressorRatio.disabled = false;
      // Pitch no funciona con MediaStream capturado
      pitchSlider.disabled = true;
      // Volumen sin cap (puede hacer boost)
      volumeSlider.max = 500;

      // Re-aplicar el estado actual a la captura
      const state = await loadState();
      applyStateToPage(state);
    } else {
      captureStatus.textContent = 'Error: ' + ((response && response.error) || 'no se pudo iniciar');
    }
  } catch (e) {
    console.error('Error iniciando captura:', e);
    captureStatus.textContent = 'Error: ' + e.message;
  } finally {
    captureBtn.disabled = false;
  }
}

// Detener la captura
async function stopTabCapture() {
  try {
    captureBtn.disabled = true;
    captureStatus.textContent = 'Deteniendo captura...';

    await chrome.runtime.sendMessage({
      target: 'background',
      type: 'stopCapture'
    });

    captureActive = false;
    captureBtn.textContent = 'Activar Captura Avanzada';
    captureBtn.style.backgroundColor = '#2196F3';
    captureStatus.textContent = '';

    // Volver al modo DRM limitado
    panSlider.disabled = true;
    pitchSlider.disabled = true;
    eqSliders.forEach(s => s.disabled = true);
    compressorToggle.disabled = true;
    compressorThreshold.disabled = true;
    compressorRatio.disabled = true;
    volumeSlider.max = 100;
  } catch (e) {
    console.error('Error deteniendo captura:', e);
    captureStatus.textContent = 'Error: ' + e.message;
  } finally {
    captureBtn.disabled = false;
  }
}

// Consultar el estado de captura al abrir el popup
async function getCaptureStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      target: 'background',
      type: 'getCaptureStatus'
    });
    return response || { active: false };
  } catch (e) {
    return { active: false };
  }
}

// Función que se ejecuta en la página para controlar el audio
function executeAudioControl({action, value}) {
  // === DETECCION DE SITIOS CON DRM ===
  // En estos sitios createMediaElementSource silencia el audio (no funciona Web Audio API)
  // Solo se puede controlar volumen y mute directamente en el elemento
  const DRM_HOSTS = [
    'open.spotify.com',
    'music.youtube.com',
    'www.netflix.com',
    'www.primevideo.com',
    'www.disneyplus.com',
    'play.max.com',
    'www.hbomax.com',
    'music.apple.com',
    'tidal.com',
    'listen.tidal.com',
    'play.deezer.com'
  ];

  function isDRMSite() {
    const host = window.location.hostname;
    return DRM_HOSTS.some(drmHost => host === drmHost || host.endsWith('.' + drmHost));
  }

  const isDRM = isDRMSite();

  // === BUSQUEDA ROBUSTA de elementos audio/video ===
  // Busca en documento principal, Shadow DOMs, e iframes accesibles
  function findAllMediaElements() {
    const found = new Set();

    function searchIn(root) {
      try {
        root.querySelectorAll('audio, video').forEach(el => found.add(el));
        // Recorrer todos los elementos para buscar Shadow DOM
        root.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            searchIn(el.shadowRoot);
          }
        });
      } catch (e) { /* ignorar errores de acceso */ }
    }

    searchIn(document);

    // Buscar en iframes accesibles (mismo origen)
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        if (iframe.contentDocument) {
          searchIn(iframe.contentDocument);
        }
      } catch (e) { /* iframe cross-origin, ignorar */ }
    });

    return Array.from(found);
  }

  // === MODO DRM (simple): controlar audio directamente sin AudioContext ===
  if (isDRM) {
    if (!window.audioController || !window.audioController.isDRM) {
      // Si había un controlador completo previo, no podemos arreglarlo aquí
      // (el audio ya está silenciado por createMediaElementSource)
      window.audioController = {
        isDRM: true,
        trackedElements: [],

        trackElements() {
          // Usar busqueda robusta (incluye Shadow DOM e iframes)
          const elements = findAllMediaElements();
          elements.forEach(el => {
            if (!this.trackedElements.includes(el)) {
              this.trackedElements.push(el);
            }
          });
        },

        setVolume(volume) {
          this.trackElements();
          // Cap a 1.0 (no se puede boost en modo DRM, el navegador no lo permite)
          const v = Math.max(0, Math.min(1, volume / 100));
          this.trackedElements.forEach(el => { el.volume = v; });
        },

        mute() {
          this.trackElements();
          this.trackedElements.forEach(el => { el.muted = true; });
        },

        unmute(volume) {
          this.trackElements();
          this.trackedElements.forEach(el => { el.muted = false; });
          if (volume !== undefined) {
            this.setVolume(volume);
          }
        },

        // Metodos no soportados en modo DRM (sin efecto)
        setPan() {},
        setEQ() {},
        setPitch() {},
        resetPitch() {},
        resetEQ() {},
        setCompressorEnabled() {},
        setCompressorThreshold() {},
        setCompressorRatio() {},
        resetCompressor() {},
        ensureRunning() {},
        connectAudioElements() { this.trackElements(); }
      };
    }

    // Ejecutar la accion en modo DRM
    window.audioController.connectAudioElements();
    switch (action) {
      case 'setVolume': window.audioController.setVolume(value); break;
      case 'mute':      window.audioController.mute(); break;
      case 'unmute':    window.audioController.unmute(value); break;
      case 'reset':
        window.audioController.setVolume(100);
        window.audioController.unmute();
        break;
      // setPan, setEQ, setPitch, etc no hacen nada
    }
    return; // Salir, no usar Web Audio API
  }

  // === MODO COMPLETO (Web Audio API) ===
  // Verificar si el controlador existe y su AudioContext es válido
  const needsReinit = !window.audioController ||
                      window.audioController.isDRM ||
                      !window.audioController.audioContext ||
                      window.audioController.audioContext.state === 'closed';

  if (needsReinit) {
    // Si había un controlador anterior, intentar cerrarlo limpiamente
    if (window.audioController && window.audioController.audioContext) {
      try {
        window.audioController.audioContext.close();
      } catch (e) {
        console.log('No se pudo cerrar AudioContext anterior');
      }
    }

    // Inicializar el controlador de audio
    window.audioController = {
      audioContext: null,
      gainNode: null,
      pannerNode: null,
      eqNodes: [],
      compressorNode: null,
      compressorEnabled: false,
      source: null,
      originalElements: [],

      // Configuración del EQ: frecuencias y tipos de filtro
      EQ_CONFIG: [
        { freq: 60,    type: 'lowshelf'  },  // Subgraves
        { freq: 250,   type: 'peaking'   },  // Bajos
        { freq: 1000,  type: 'peaking'   },  // Medios
        { freq: 4000,  type: 'peaking'   },  // Agudos
        { freq: 12000, type: 'highshelf' }   // Brillo
      ],

      init() {
        try {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          this.gainNode = this.audioContext.createGain();
          this.pannerNode = this.audioContext.createStereoPanner();

          // Crear los 5 BiquadFilterNodes del EQ
          this.eqNodes = this.EQ_CONFIG.map(({ freq, type }) => {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = type;
            filter.frequency.value = freq;
            filter.gain.value = 0;
            filter.Q.value = 1;
            return filter;
          });

          // Conectar EQ en cadena: eq0 -> eq1 -> eq2 -> eq3 -> eq4
          for (let i = 0; i < this.eqNodes.length - 1; i++) {
            this.eqNodes[i].connect(this.eqNodes[i + 1]);
          }

          // Crear el compresor (DynamicsCompressorNode nativo)
          this.compressorNode = this.audioContext.createDynamicsCompressor();
          // Valores iniciales que NO comprimen (bypass virtual)
          this.compressorNode.threshold.value = 0;
          this.compressorNode.ratio.value = 1;
          this.compressorNode.knee.value = 30;
          this.compressorNode.attack.value = 0.003;
          this.compressorNode.release.value = 0.25;

          // Conectar: ultimoEQ -> compressor -> gain -> pan -> destination
          this.eqNodes[this.eqNodes.length - 1].connect(this.compressorNode);
          this.compressorNode.connect(this.gainNode);
          this.gainNode.connect(this.pannerNode);
          this.pannerNode.connect(this.audioContext.destination);

          // Encontrar y conectar elementos de audio
          this.connectAudioElements();

        } catch (error) {
          console.error('Error inicializando audio controller:', error);
        }
      },

      connectAudioElements() {
        const audioElements = document.querySelectorAll('audio, video');
        const inputNode = this.eqNodes[0]; // Las fuentes entran al primer nodo del EQ

        audioElements.forEach(element => {
          // Si el elemento ya tiene una fuente registrada, usarla
          if (element._audioSource) {
            try {
              element._audioSource.disconnect();
            } catch (e) {}
            try {
              element._audioSource.connect(inputNode);
              this.originalElements.push({element, source: element._audioSource});
              return;
            } catch (e) {
              console.log('No se pudo reconectar fuente existente:', e);
            }
          }

          // Si no tiene fuente, crear una nueva
          if (!element.hasAttribute('data-audio-controlled')) {
            try {
              const source = this.audioContext.createMediaElementSource(element);
              source.connect(inputNode);
              element.setAttribute('data-audio-controlled', 'true');
              element._audioSource = source;
              this.originalElements.push({element, source});
            } catch (error) {
              console.log('No se pudo conectar elemento:', error);
            }
          }
        });
      },

      ensureRunning() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(e => {
            console.log('No se pudo resumir AudioContext:', e);
          });
        }
      },

      setVolume(volume) {
        this.ensureRunning();
        if (this.gainNode) {
          this.gainNode.gain.value = volume / 100;
        }
      },

      setPan(pan) {
        this.ensureRunning();
        if (this.pannerNode) {
          this.pannerNode.pan.value = pan / 100;
        }
      },

      mute() {
        this.ensureRunning();
        if (this.gainNode) {
          this.gainNode.gain.value = 0;
        }
      },

      unmute(volume) {
        this.ensureRunning();
        if (this.gainNode) {
          this.gainNode.gain.value = volume / 100;
        }
      },

      // Ajustar ganancia de una banda del EQ (en dB)
      setEQ(bandIndex, gainDb) {
        this.ensureRunning();
        if (this.eqNodes[bandIndex]) {
          this.eqNodes[bandIndex].gain.value = gainDb;
        }
      },

      // Cambiar tono via playbackRate (tambien afecta velocidad)
      setPitch(semitones) {
        this.ensureRunning();
        const rate = Math.pow(2, semitones / 12);
        this.originalElements.forEach(({ element }) => {
          // Desactivar preservacion de tono para que el cambio de rate altere el pitch
          element.preservesPitch = false;
          element.mozPreservesPitch = false;
          element.webkitPreservesPitch = false;
          element.playbackRate = rate;
        });
      },

      // Restablecer pitch (rate=1, preservesPitch=true)
      resetPitch() {
        this.originalElements.forEach(({ element }) => {
          element.playbackRate = 1;
          element.preservesPitch = true;
          element.mozPreservesPitch = true;
          element.webkitPreservesPitch = true;
        });
      },

      // Restablecer todo el EQ a 0 dB
      resetEQ() {
        this.eqNodes.forEach(node => {
          node.gain.value = 0;
        });
      },

      // Activar o desactivar compresor (sin reconectar nodos)
      setCompressorEnabled(enabled, threshold, ratio) {
        this.ensureRunning();
        this.compressorEnabled = enabled;
        if (this.compressorNode) {
          if (enabled) {
            this.compressorNode.threshold.value = threshold;
            this.compressorNode.ratio.value = ratio;
          } else {
            // "Apagado": no comprime
            this.compressorNode.threshold.value = 0;
            this.compressorNode.ratio.value = 1;
          }
        }
      },

      // Ajustar threshold del compresor (-100 a 0 dB)
      setCompressorThreshold(value) {
        this.ensureRunning();
        if (this.compressorNode && this.compressorEnabled) {
          this.compressorNode.threshold.value = value;
        }
      },

      // Ajustar ratio del compresor (1 a 20)
      setCompressorRatio(value) {
        this.ensureRunning();
        if (this.compressorNode && this.compressorEnabled) {
          this.compressorNode.ratio.value = value;
        }
      },

      // Restablecer compresor (apagado, valores por defecto)
      resetCompressor() {
        this.compressorEnabled = false;
        if (this.compressorNode) {
          this.compressorNode.threshold.value = 0;
          this.compressorNode.ratio.value = 1;
        }
      }
    };

    window.audioController.init();
  }

  // Asegurar que el AudioContext esté corriendo (importante después de pausa)
  window.audioController.ensureRunning();

  // Reconectar nuevos elementos de audio si aparecen
  window.audioController.connectAudioElements();

  // Ejecutar la acción solicitada
  switch (action) {
    case 'setVolume':
      window.audioController.setVolume(value);
      break;
    case 'setPan':
      window.audioController.setPan(value);
      break;
    case 'mute':
      window.audioController.mute();
      break;
    case 'unmute':
      window.audioController.unmute(value);
      break;
    case 'setEQ':
      // value = { band: 0..4, gain: -12..12 }
      window.audioController.setEQ(value.band, value.gain);
      break;
    case 'setPitch':
      window.audioController.setPitch(value);
      break;
    case 'setCompressorEnabled':
      // value = { enabled: bool, threshold: number, ratio: number }
      window.audioController.setCompressorEnabled(value.enabled, value.threshold, value.ratio);
      break;
    case 'setCompressorThreshold':
      window.audioController.setCompressorThreshold(value);
      break;
    case 'setCompressorRatio':
      window.audioController.setCompressorRatio(value);
      break;
    case 'reset':
      window.audioController.setVolume(100);
      window.audioController.setPan(0);
      window.audioController.resetEQ();
      window.audioController.resetPitch();
      window.audioController.resetCompressor();
      break;
  }
}

// Event listeners
volumeSlider.addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  updateVolumeDisplay(value);

  if (!isMuted) {
    sendCommand('setVolume', value);
    previousVolume = value;
  }
  saveState({ volume: value, previousVolume });
});

panSlider.addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  updatePanDisplay(value);
  sendCommand('setPan', value);
  saveState({ pan: value });
});

// Listeners para las 5 bandas del EQ
eqSliders.forEach((slider, index) => {
  slider.addEventListener('input', async (e) => {
    const gainDb = parseInt(e.target.value);
    updateEQDisplay(index, gainDb);
    sendCommand('setEQ', { band: index, gain: gainDb });

    // Actualizar el array completo del EQ en el estado
    const current = await loadState();
    const newEq = [...current.eq];
    newEq[index] = gainDb;
    saveState({ eq: newEq });
  });
});

// Listener para el pitch
pitchSlider.addEventListener('input', (e) => {
  const semitones = parseInt(e.target.value);
  updatePitchDisplay(semitones);
  sendCommand('setPitch', semitones);
  saveState({ pitch: semitones });
});

// Listeners del Compresor
compressorToggle.addEventListener('change', (e) => {
  const enabled = e.target.checked;
  const threshold = parseInt(compressorThreshold.value);
  const ratio = parseInt(compressorRatio.value);

  // Habilitar/deshabilitar visualmente los controles
  if (enabled) {
    compressorControls.classList.remove('compressor-disabled');
    status.textContent = 'Compresor activado';
  } else {
    compressorControls.classList.add('compressor-disabled');
    status.textContent = 'Compresor desactivado';
  }

  sendCommand('setCompressorEnabled', { enabled, threshold, ratio });
  saveState({ compressor: { enabled, threshold, ratio } });
});

compressorThreshold.addEventListener('input', async (e) => {
  const value = parseInt(e.target.value);
  updateCompressorThresholdDisplay(value);
  sendCommand('setCompressorThreshold', value);

  const current = await loadState();
  saveState({ compressor: { ...current.compressor, threshold: value } });
});

compressorRatio.addEventListener('input', async (e) => {
  const value = parseInt(e.target.value);
  updateCompressorRatioDisplay(value);
  sendCommand('setCompressorRatio', value);

  const current = await loadState();
  saveState({ compressor: { ...current.compressor, ratio: value } });
});

muteBtn.addEventListener('click', () => {
  if (isMuted) {
    // Unmute
    sendCommand('unmute', previousVolume);
    muteBtn.textContent = 'Silenciar';
    volumeSlider.disabled = false;
    isMuted = false;
    status.textContent = 'Audio activado';
  } else {
    // Mute
    previousVolume = parseInt(volumeSlider.value);
    sendCommand('mute');
    muteBtn.textContent = 'Activar Audio';
    volumeSlider.disabled = true;
    isMuted = true;
    status.textContent = 'Audio silenciado';
  }
  saveState({ isMuted, previousVolume });
});

resetBtn.addEventListener('click', () => {
  volumeSlider.value = 100;
  panSlider.value = 0;
  updateVolumeDisplay(100);
  updatePanDisplay(0);

  // Resetear EQ
  eqSliders.forEach((slider, index) => {
    slider.value = 0;
    updateEQDisplay(index, 0);
  });

  // Resetear pitch
  pitchSlider.value = 0;
  updatePitchDisplay(0);

  // Resetear compresor
  compressorToggle.checked = false;
  compressorControls.classList.add('compressor-disabled');
  compressorThreshold.value = -24;
  compressorRatio.value = 4;
  updateCompressorThresholdDisplay(-24);
  updateCompressorRatioDisplay(4);

  sendCommand('reset');

  if (isMuted) {
    muteBtn.click(); // Desactivar mute si está activo
  }

  // Borrar estado guardado
  clearState();

  status.textContent = 'Configuración restablecida';
});

// Aplicar el estado cargado a toda la UI (sliders, displays, toggles)
function applyStateToUI(state) {
  // Volumen
  volumeSlider.value = state.volume;
  updateVolumeDisplay(state.volume);

  // Paneo
  panSlider.value = state.pan;
  updatePanDisplay(state.pan);

  // Mute
  isMuted = state.isMuted;
  previousVolume = state.previousVolume;
  if (isMuted) {
    muteBtn.textContent = 'Activar Audio';
    volumeSlider.disabled = true;
  } else {
    muteBtn.textContent = 'Silenciar';
    volumeSlider.disabled = false;
  }

  // Ecualizador (5 bandas)
  state.eq.forEach((gainDb, index) => {
    eqSliders[index].value = gainDb;
    updateEQDisplay(index, gainDb);
  });

  // Pitch
  pitchSlider.value = state.pitch;
  updatePitchDisplay(state.pitch);

  // Compresor
  compressorToggle.checked = state.compressor.enabled;
  compressorThreshold.value = state.compressor.threshold;
  compressorRatio.value = state.compressor.ratio;
  updateCompressorThresholdDisplay(state.compressor.threshold);
  updateCompressorRatioDisplay(state.compressor.ratio);
  if (state.compressor.enabled) {
    compressorControls.classList.remove('compressor-disabled');
  } else {
    compressorControls.classList.add('compressor-disabled');
  }
}

// Re-aplicar el estado a la pagina (por si se navego o recargo la pestaña)
function applyStateToPage(state) {
  // Volumen y mute
  if (state.isMuted) {
    sendCommand('mute');
  } else {
    sendCommand('setVolume', state.volume);
  }

  // Paneo
  sendCommand('setPan', state.pan);

  // EQ
  state.eq.forEach((gainDb, index) => {
    sendCommand('setEQ', { band: index, gain: gainDb });
  });

  // Pitch
  sendCommand('setPitch', state.pitch);

  // Compresor
  sendCommand('setCompressorEnabled', {
    enabled: state.compressor.enabled,
    threshold: state.compressor.threshold,
    ratio: state.compressor.ratio
  });
}

// Listener del botón de captura (solo visible en sitios DRM)
if (captureBtn) {
  captureBtn.addEventListener('click', () => {
    if (captureActive) {
      stopTabCapture();
    } else {
      startTabCapture();
    }
  });
}

// Inicializar: detectar DRM, captura activa, cargar estado y aplicarlo
(async () => {
  const isDRM = await detectDRMSite();
  const captureStatusResp = await getCaptureStatus();
  const state = await loadState();

  // Si la captura ya esta activa (popup reabierto), reflejar en UI
  if (captureStatusResp.active) {
    captureActive = true;
    captureBtn.textContent = 'Detener Captura Avanzada';
    captureBtn.style.backgroundColor = '#f44336';
    captureStatus.textContent = 'Captura activa - todos los efectos disponibles';

    // Habilitar controles (excepto pitch que no funciona en captura)
    panSlider.disabled = false;
    eqSliders.forEach(s => s.disabled = false);
    compressorToggle.disabled = false;
    compressorThreshold.disabled = false;
    compressorRatio.disabled = false;
    pitchSlider.disabled = true;
    volumeSlider.max = 500;
  } else if (isDRM) {
    // DRM sin captura: limitar volumen a 100
    if (state.volume > 100) {
      state.volume = 100;
    }
  }

  applyStateToUI(state);
  applyStateToPage(state);
})();

