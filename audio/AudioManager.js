// AudioManager.js - Orquestador central compatible con código existente
class AudioManager {
  constructor() {
    this.audioContext = null;
    this.channelManager = null;
    this.masterGain = null;
    this.initialized = false;

    // Para mantener compatibilidad con el código anterior
    this.gainNode = null;
    this.pannerNode = null;
    this.originalElements = [];
  }

  // Inicializar el gestor de audio
  init() {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Master gain (volumen maestro)
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);

      // Inicializar gestor de canales
      this.channelManager = new ChannelManager(this.audioContext);

      // Crear un canal por defecto (compatibilidad con código anterior)
      this.defaultChannel = this.channelManager.createChannel('default', 'Canal Principal');

      // Para compatibilidad con código antiguo (window.audioController)
      this.gainNode = this.defaultChannel.gain;
      this.pannerNode = this.defaultChannel.pan;

      // Conectar el canal por defecto al master
      this.defaultChannel.pan.connect(this.masterGain);

      this.initialized = true;
      console.log('AudioManager inicializado correctamente');
    } catch (error) {
      console.error('Error inicializando AudioManager:', error);
    }
  }

  // Conectar elementos de audio existentes en la página
  connectAudioElements() {
    if (!this.initialized) this.init();

    const audioElements = document.querySelectorAll('audio, video');
    audioElements.forEach(element => {
      if (!element.hasAttribute('data-audio-controlled')) {
        this.connectElement(element);
        element.setAttribute('data-audio-controlled', 'true');
      }
    });
  }

  // Conectar un elemento específico
  connectElement(element, channelId = 'default') {
    if (!this.initialized) this.init();

    try {
      const channel = this.channelManager.getChannel(channelId);
      if (channel) {
        channel.connectElement(element);
        // Mantener registro para compatibilidad
        this.originalElements.push({ element, channelId });
        return true;
      }
    } catch (error) {
      console.log('Error conectando elemento:', error);
    }
    return false;
  }

  // Métodos para compatibilidad con código anterior
  setVolume(volume, channelId = 'default') {
    if (!this.initialized) this.init();
    const channel = this.channelManager.getChannel(channelId);
    if (channel) {
      channel.setVolume(volume / 100);
    }
  }

  setPan(pan, channelId = 'default') {
    if (!this.initialized) this.init();
    const channel = this.channelManager.getChannel(channelId);
    if (channel) {
      channel.setPan(pan / 100);
    }
  }

  mute(channelId = 'default') {
    if (!this.initialized) this.init();
    const channel = this.channelManager.getChannel(channelId);
    if (channel) {
      channel.mute();
    }
  }

  unmute(volume, channelId = 'default') {
    if (!this.initialized) this.init();
    const channel = this.channelManager.getChannel(channelId);
    if (channel) {
      channel.setVolume(volume / 100);
      channel.unmute();
    }
  }

  reset(channelId = 'default') {
    if (!this.initialized) this.init();
    const channel = this.channelManager.getChannel(channelId);
    if (channel) {
      channel.reset();
    }
  }

  // Métodos nuevos para la arquitectura expandida

  // Crear nuevo canal
  createChannel(id, name) {
    if (!this.initialized) this.init();
    return this.channelManager.createChannel(id, name);
  }

  // Obtener canal
  getChannel(id) {
    return this.channelManager.getChannel(id);
  }

  // Agregar efecto a un canal
  addEffect(channelId, effectId, effectInstance) {
    const channel = this.channelManager.getChannel(channelId);
    if (channel) {
      return channel.addEffect(effectId, effectInstance);
    }
    return false;
  }

  // Remover efecto de un canal
  removeEffect(channelId, effectId) {
    const channel = this.channelManager.getChannel(channelId);
    if (channel) {
      return channel.removeEffect(effectId);
    }
    return false;
  }

  // Obtener todos los canales
  getAllChannels() {
    if (!this.initialized) return [];
    return this.channelManager.getAllChannels();
  }

  // Establecer volumen maestro
  setMasterVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume / 100));
    }
  }

  getMasterVolume() {
    if (this.masterGain) {
      return this.masterGain.gain.value * 100;
    }
    return 100;
  }
}

// Crear instancia global singleton
if (!window.audioManager) {
  window.audioManager = new AudioManager();
}
