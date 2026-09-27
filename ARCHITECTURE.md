# DragonAudio - Arquitectura Modular

## Estructura de Carpetas

```
audio/
├── AudioManager.js          ← Orquestador central
├── Channel.js               ← Clase para cada canal
├── channels/
│   └── ChannelManager.js    ← Gestor de canales
├── effects/
│   ├── Effect.js            ← Clase base (próximamente)
│   ├── EchoEffect.js        ← Ejemplo de efecto
│   └── effectRegistry.js    ← Registro de efectos
└── utils/
    └── audioHelpers.js      ← Funciones auxiliares
```

## Integración Gradual - Sin Romper Código Existente

### Opción 1: Mantener código actual (RECOMENDADO AHORA)

Tu `popup.js` funciona exactamente igual. Los archivos nuevos se cargan pero no se usan:

```html
<!-- En popup.html, agregar estos scripts ANTES de popup.js -->
<script src="audio/Channel.js"></script>
<script src="audio/channels/ChannelManager.js"></script>
<script src="audio/AudioManager.js"></script>
<script src="popup.js"></script>
```

Tu código sigue funcionando, pero ahora tienes `window.audioManager` disponible para nuevas funciones.

---

### Opción 2: Usar AudioManager en popup.js (FUTURO)

Cuando quieras migrar a la nueva arquitectura, tu popup.js podría hacer:

```javascript
// En lugar de sendCommand('setVolume', value)
// Podrías hacer:
async function sendCommand(action, value) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  
  await chrome.scripting.executeScript({
    target: {tabId: tab.id},
    func: executeAudioControl,
    args: [{action, value}]
  });
}

// Y en executeAudioControl:
function executeAudioControl({action, value}) {
  window.audioManager.init();
  
  switch (action) {
    case 'setVolume':
      window.audioManager.setVolume(value); // Automáticamente usa canal default
      break;
    // ... resto igual
  }
}
```

---

## Ejemplos de Uso de la Nueva Arquitectura

### Crear múltiples canales

```javascript
window.audioManager.init();

// Crear canales
const musicChannel = window.audioManager.createChannel('music', 'Música');
const sfxChannel = window.audioManager.createChannel('sfx', 'Efectos de Sonido');
const voiceChannel = window.audioManager.createChannel('voice', 'Voz');

// Conectar elementos
musicChannel.setVolume(0.8);
sfxChannel.setVolume(0.6);
voiceChannel.setVolume(1.0);
```

### Agregar efectos (próximamente)

```javascript
// Cuando tengas EchoEffect.js implementado
const echoEffect = new EchoEffect(window.audioManager.audioContext, { intensity: 0.5 });
window.audioManager.addEffect('music', 'echo-1', echoEffect);
```

### Control maestro

```javascript
// Volumen maestro afecta todos los canales
window.audioManager.setMasterVolume(70);
```

---

## Migración Paso a Paso

### Fase 1 (AHORA): Solo estructurar
- ✅ Carpetas creadas
- ✅ Código nuevo compatible
- ✅ Código antiguo sigue funcionando

### Fase 2: Agregar efectos base
- Crear `audio/effects/Effect.js` (clase base)
- Crear `audio/effects/EchoEffect.js`
- Crear `audio/effects/EqualizerEffect.js`

### Fase 3: Crear UI para múltiples canales
- Actualizar `popup.html` para mostrar canales
- Actualizar `popup.js` para crear/eliminar canales

### Fase 4: Sistema completo
- Agregar efectos dinámicos a UI
- Guardar configuraciones
- Exportar/importar presets

---

## Compatibilidad

| Función | Estado | Nota |
|---------|--------|------|
| `window.audioController` | Deprecado | Mantén `window.audioManager` |
| `popup.js` actual | Funciona 100% | Sin cambios requeridos |
| Múltiples canales | Nuevo | Listo en ChannelManager |
| Efectos | Próximamente | Necesita Effect.js base |
| UI múltiples canales | Próximamente | Necesita rediseño popup |

---

## Pasos para Activar

1. **Actualizar `popup.html`** - Agregar los 3 scripts nuevos
2. **Probar** - Tu extensión debe funcionar igual
3. **Gradualmente** - Usar `window.audioManager` para nuevas funciones

Tu código antiguo nunca se toca. Los nuevos archivos son compatibles 100%.
