// Channel.js - Representa un canal/track de audio
class Channel {
  constructor(id, name, audioContext) {
    this.id = id;
    this.name = name;
    this.audioContext = audioContext;

    // Nodos de audio
    this.gain = audioContext.createGain();
    this.pan = audioContext.createStereoPanner();
    this.input = audioContext.createGain();

    // Conectar: input → gain → pan → destination
    this.input.connect(this.gain);
    this.gain.connect(this.pan);
    this.pan.connect(audioContext.destination);

    // Efectos
    this.effects = [];
    this.effectMap = new Map();

    // Elementos de audio conectados a este canal
    this.elements = [];

    // Estado
    this.isMuted = false;
    this.volumeBeforeMute = 1;
  }

  // Conectar elemento de audio (audio/video) a este canal
  connectElement(element) {
    try {
      const source = this.audioContext.createMediaElementSource(element);
      source.connect(this.input);
      this.elements.push({ element, source });
      element.setAttribute('data-channel', this.id);
      return true;
    } catch (error) {
      console.log(`No se pudo conectar elemento a canal ${this.id}:`, error);
      return false;
    }
  }

  // Agregar efecto al canal
  addEffect(effectId, effectInstance) {
    if (this.effectMap.has(effectId)) {
      console.warn(`Efecto ${effectId} ya existe en el canal ${this.id}`);
      return false;
    }

    this.effects.push(effectInstance);
    this.effectMap.set(effectId, effectInstance);

    // Reconectar la cadena de efectos
    this.rebuildEffectChain();
    return true;
  }

  // Remover efecto
  removeEffect(effectId) {
    if (!this.effectMap.has(effectId)) {
      return false;
    }

    const effect = this.effectMap.get(effectId);
    this.effects = this.effects.filter(e => e !== effect);
    this.effectMap.delete(effectId);

    this.rebuildEffectChain();
    return true;
  }

  // Reconstruir la cadena de efectos
  rebuildEffectChain() {
    if (this.effects.length === 0) {
      // Sin efectos: input → gain → pan
      this.input.disconnect();
      this.input.connect(this.gain);
    } else {
      // Con efectos: input → effect1 → effect2 → ... → gain → pan
      this.input.disconnect();
      this.input.connect(this.effects[0].getInputNode());

      for (let i = 0; i < this.effects.length - 1; i++) {
        this.effects[i].getOutputNode().disconnect();
        this.effects[i].getOutputNode().connect(this.effects[i + 1].getInputNode());
      }

      const lastEffect = this.effects[this.effects.length - 1];
      lastEffect.getOutputNode().disconnect();
      lastEffect.getOutputNode().connect(this.gain);
    }
  }

  // Control de volumen
  setVolume(value) {
    this.gain.gain.value = Math.max(0, Math.min(1, value));
  }

  getVolume() {
    return this.gain.gain.value;
  }

  // Control de paneo
  setPan(value) {
    this.pan.pan.value = Math.max(-1, Math.min(1, value));
  }

  getPan() {
    return this.pan.pan.value;
  }

  // Silenciar/Dessilenciar
  mute() {
    if (!this.isMuted) {
      this.volumeBeforeMute = this.getVolume();
      this.setVolume(0);
      this.isMuted = true;
    }
  }

  unmute() {
    if (this.isMuted) {
      this.setVolume(this.volumeBeforeMute);
      this.isMuted = false;
    }
  }

  toggleMute() {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  // Reset a valores por defecto
  reset() {
    this.setVolume(1);
    this.setPan(0);
    this.unmute();
  }
}
