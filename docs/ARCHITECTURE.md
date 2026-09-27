# Arquitectura

## Flujo

```
popup ──(streamId)──▶ service worker ──▶ offscreen (AudioEngine)
  │                                         ▲
  ├── ajustes (cada frame) ─────────────────┘
  └── puerto "meter" ◀── picos L/R (30 fps)
```

1. Abrir el popup cuenta como invocar la extensión. Por eso el popup puede pedir `tabCapture.getMediaStreamId` sin un clic extra.
2. El service worker crea el documento offscreen si no existe y le pasa el `streamId` junto con la configuración guardada.
3. El offscreen abre el stream con `getUserMedia({ chromeMediaSource: 'tab' })` y lo conecta al motor.
4. El offscreen es la fuente de verdad sobre qué pestañas se están capturando. El service worker puede dormirse y perder lo que tenga en memoria.
5. Cuando no queda ninguna pestaña, el offscreen avisa (`engine:idle`) y el service worker lo cierra.

El offscreen solo tiene acceso a `chrome.runtime`. Por eso la configuración le llega por mensajes y no desde `chrome.storage`.

## Cadena de audio

```
pestañas → bus → EQ (5 biquads) → pitch (worklet) → paneo → reverb → master → salida
                                                                          └→ medidor
```

Todas las pestañas capturadas comparten un solo `AudioContext` y una sola cadena.

## Contrato de efecto

Cada efecto está en su propio archivo en `src/offscreen/engine/effects/`:

```js
createX(ctx) → { input: AudioNode, output: AudioNode, update(settings, bypass) }
```

- `update` recibe la configuración completa. Si `bypass` es verdadero, el efecto se pone en neutro.
- Los parámetros se mueven con `ramp()` (unos 20 ms) para evitar clics.
- Un efecto nuevo es un archivo más y una línea en `AudioEngine.#build`.

## Notas por efecto

- **Master:** portado de Dragon Audio web.
  - La ganancia es lineal: 600 % = ×6.
  - El soft-clip deja pasar la señal intacta hasta |x| ≤ 0.7, así que nunca supera ±1.
  - Por encima de 100 % se recortan los graves (low-shelf a 150 Hz, hasta −12 dB).
  - La protección también se activa por debajo de 100 % si el EQ está realzando alguna banda.
- **Pitch:** granular, con dos cabezales de lectura y ventana de 60 ms, crossfade sin²/cos².
  - Cambia el tono sin cambiar la velocidad.
  - Con 0 semitonos el audio pasa directo, sin latencia.
- **Reverb:** convolución con un impulso RT60 sintético.
  - Con mezcla 0 el convolver se desconecta y no consume CPU.
  - Al cambiar la duración, el impulso se regenera con un debounce de 150 ms.

## Interfaz

- **Temas:** todos los colores son variables en `:root` (oscuro) y `:root[data-theme='light']` (claro, papel de arroz). Un color nuevo se define en los dos bloques.
- **Idioma:** `src/popup/i18n.js`. Los textos fijos se marcan en el HTML con `data-i18n`, `data-i18n-title` y `data-i18n-aria`; los dinámicos se piden con `t(key)`. Al cambiar de idioma se reconstruyen los controles.
- `boot.js` lee una copia del tema y del idioma guardada en `localStorage` y la aplica antes del CSS, así no hay parpadeo al abrir.
- **Rack:** cada `.card[data-rack]` tiene orejas laterales (`::before` y `::after`) y 4 tornillos que agrega `ui/rack.js`.

## Límites conocidos

- Chrome no permite capturar páginas `chrome://` ni la Chrome Web Store.
- Si la pestaña se cierra o Chrome corta el stream, la captura se libera sola (`track.ended`).
- El pitch granular es ligero. Si hace falta más calidad, se puede cambiar por SoundTouch (WSOLA) en un worklet.
