// ChannelManager.js - Gestiona múltiples canales
class ChannelManager {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.channels = new Map();
    this.activeChannelId = null;
  }

  // Crear un nuevo canal
  createChannel(id, name = `Canal ${id}`) {
    if (this.channels.has(id)) {
      console.warn(`Canal ${id} ya existe`);
      return this.channels.get(id);
    }

    const channel = new Channel(id, name, this.audioContext);
    this.channels.set(id, channel);

    // El primer canal es el activo por defecto
    if (!this.activeChannelId) {
      this.activeChannelId = id;
    }

    return channel;
  }

  // Obtener un canal por ID
  getChannel(id) {
    return this.channels.get(id);
  }

  // Obtener el canal activo
  getActiveChannel() {
    return this.channels.get(this.activeChannelId);
  }

  // Establecer el canal activo
  setActiveChannel(id) {
    if (this.channels.has(id)) {
      this.activeChannelId = id;
      return true;
    }
    return false;
  }

  // Obtener todos los canales
  getAllChannels() {
    return Array.from(this.channels.values());
  }

  // Eliminar un canal
  removeChannel(id) {
    if (this.channels.delete(id)) {
      if (this.activeChannelId === id) {
        // Si eliminamos el canal activo, cambiar al primero disponible
        this.activeChannelId = this.channels.keys().next().value || null;
      }
      return true;
    }
    return false;
  }

  // Conectar elemento de audio a un canal específico (o al activo)
  connectElement(element, channelId = null) {
    const channel = channelId ? this.getChannel(channelId) : this.getActiveChannel();
    if (channel) {
      return channel.connectElement(element);
    }
    return false;
  }

  // Conectar múltiples elementos a un canal
  connectElements(elements, channelId = null) {
    const channel = channelId ? this.getChannel(channelId) : this.getActiveChannel();
    if (!channel) return 0;

    let connected = 0;
    elements.forEach(element => {
      if (channel.connectElement(element)) {
        connected++;
      }
    });
    return connected;
  }
}
