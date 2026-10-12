# Dragon Audio · Manual Completo

> Documentación de referencia end-to-end de la extensión. Escrita para que un
> humano la lea de arriba abajo y entienda cómo encaja todo, y para que una IA
> pueda saltar a una sección específica para localizar un cambio sin leer el
> resto del proyecto.
>
> Mantener este documento al día cuando cambien contratos (`src/shared/`),
> flujos de mensajes (`MSG.*`), la cadena de audio o la estructura del popup.

---

## Tabla de contenido

1. [Qué es Dragon Audio](#1-qué-es-dragon-audio)
2. [Mapa del repositorio](#2-mapa-del-repositorio)
3. [Arquitectura en 3 procesos](#3-arquitectura-en-3-procesos)
4. [Flujos extremo a extremo](#4-flujos-extremo-a-extremo)
5. [Protocolo de mensajes (`MSG.*`)](#5-protocolo-de-mensajes-msg)
6. [Modelo de datos: `settings`](#6-modelo-de-datos-settings)
7. [Cadena de audio y efectos](#7-cadena-de-audio-y-efectos)
8. [Interfaz del popup](#8-interfaz-del-popup)
9. [Sistema de temas (CSS)](#9-sistema-de-temas-css)
10. [Internacionalización (i18n)](#10-internacionalización-i18n)
11. [Presets](#11-presets)
12. [Assets e íconos](#12-assets-e-íconos)
13. [Permisos del `manifest.json`](#13-permisos-del-manifestjson)
14. [Persistencia](#14-persistencia)
15. [Cómo extender](#15-cómo-extender)
16. [Depuración y errores comunes](#16-depuración-y-errores-comunes)
17. [Glosario](#17-glosario)

---

## 1. Qué es Dragon Audio

Dragon Audio es una **extensión de Chrome (Manifest V3)** que captura el audio
de la pestaña activa y lo procesa con la **Web Audio API** para dar al usuario:

| Control | Rango efectivo |
|---|---|
| **Volumen maestro** | `0 – 600 %` (lineal × 6; con limitador suave) |
| **Ecualizador** | 5 bandas (`60`, `250`, `1 K`, `4 K`, `12 K` Hz), `±12 dB`, `Q = 1` |
| **Tono (pitch)** | `±12 semitonos` sin cambiar la velocidad (granular) |
| **Paneo** | `L100 – R100` |
| **Reverb** | Mezcla `0 – 100 %`, cola `0.5 – 5 s` |

**Lo que la hace útil frente a otras:** funciona con pestañas que tienen DRM
(Spotify, YouTube Music, Netflix), porque la captura es a nivel de tab —no de
elemento `<audio>`/`<video>`— mediante `chrome.tabCapture`.

**Lo que la hace particular:** una sola cadena de audio para todas las
pestañas activas, con un documento *offscreen* persistente que sobrevive
cuando el popup se cierra y el service worker se duerme.

---

## 2. Mapa del repositorio

```
DragonAudio/
├── manifest.json                   Declaración MV3 (permisos, popup, atajos)
├── README.md                       Introducción corta y ayuda de instalación
├── _locales/                       Nombre + descripción del Chrome Web Store
│   ├── en/messages.json
│   └── es/messages.json
├── assets/
│   ├── fonts/
│   │   └── cinzel-latin.woff2      Fuente de la UI (local, sin red)
│   ├── icons/
│   │   ├── icon-16.png             Íconos de la extensión (generados a
│   │   ├── icon-32.png             partir del emblema dorado con
│   │   ├── icon-48.png             System.Drawing, ver §12)
│   │   └── icon-128.png
│   └── img/
│       ├── logo.png                           (legacy, sin usar)
│       ├── Dragón dorado sobre montañas       Fondo del popup (ver §9)
│       │   brumosas.png
│       ├── Emblema_dorado_del_dragón_         Logo memphis dorado (tema
│       │   serpentino-removebg-preview.png    oscuro)
│       ├── Logo , Corporate negro.png         Logo memphis negro (tema claro)
│       ├── Estrellas-cambiopagina.png         Estrella negra (nav superior,
│       │                                      tema claro)
│       └── Estrellas-cambiopagina1.png        Estrella crema (nav superior,
│                                              tema oscuro)
├── docs/
│   ├── ARCHITECTURE.md             Resumen rápido de arquitectura
│   └── MANUAL-COMPLETO.md          Este archivo
└── src/
    ├── shared/                     Contrato común entre popup / background /
    │   │                           offscreen (constantes y helpers puros)
    │   ├── constants.js            MSG, TARGET, RANGE, EQ_BANDS, defaults
    │   ├── settings.js             sanitize + load + save (chrome.storage)
    │   └── volume.js               Curva no lineal del volumen (0–100 ocupa
    │                               la mitad del recorrido; 100–600 la otra)
    ├── background/                 Service worker (orquestador, puede dormir)
    │   ├── service-worker.js       Maneja mensajes del popup y el atajo
    │   └── offscreen-client.js     Crea / cierra / consulta el offscreen
    ├── offscreen/                  Documento oculto persistente (el que
    │   │                           realmente procesa audio)
    │   ├── offscreen.html
    │   ├── offscreen.js            Router de mensajes + puerto del vúmetro
    │   ├── engine/
    │   │   ├── AudioEngine.js      Grafo Web Audio + ciclo de vida
    │   │   ├── meter.js            RMS para el vúmetro
    │   │   ├── ramp.js             Rampa ~20 ms para evitar clics
    │   │   └── effects/            Un archivo por efecto (contrato en §7.4)
    │   │       ├── equalizer.js
    │   │       ├── master.js       Volumen + soft-clip + protección graves
    │   │       ├── pan.js
    │   │       ├── pitch.js        AudioWorkletNode (o passthrough)
    │   │       └── reverb.js       Convolver con impulso sintético
    │   └── worklets/
    │       └── pitch-shifter.worklet.js   Procesador granular (sin cambiar
    │                                      velocidad)
    └── popup/                      Interfaz (único consumidor del motor)
        ├── popup.html              Estructura: 3 vistas (mixer/presets/about)
        ├── popup.css               Tema oscuro/claro, cards, perillas, etc.
        ├── popup.js                Entry: carga ajustes, cablea controles
        ├── boot.js                 Aplica tema/idioma antes del CSS
        ├── i18n.js                 Diccionarios en/es + t() + translateDom()
        └── ui/
            ├── knob.js             Perilla SVG con wheel/drag/double-click
            ├── fader.js            Fader vertical del EQ
            ├── meter.js            Pintor del vúmetro con picos
            └── rack.js             Añade los 4 tornillos a cada data-rack
```

---

## 3. Arquitectura en 3 procesos

Dragon Audio se divide en **tres contextos JavaScript** independientes que se
comunican por mensajes:

```
┌──────────────────────┐   mensaje  ┌───────────────────────┐
│       popup.js       │ ─────────▶ │   service-worker.js   │
│  (sólo mientras      │ ◀────────┐ │  (puede dormir)       │
│   está abierto)      │          │ └─────────┬─────────────┘
└──────────┬───────────┘          │           │ crea/cierra
           │ puerto 'meter'       │           ▼
           │ (abierto en vivo)    │ ┌──────────────────────┐
           └─────────────────────▶│ │     offscreen.js      │
                                  └─│   (persistente)       │
                                    │   AudioEngine         │
                                    └──────────────────────┘
```

### 3.1 Popup (`src/popup/`)

- Vive **sólo mientras está abierto**. Si lo cierras, se destruye todo su JS.
- Lee la configuración de `chrome.storage.local` y la refleja en la UI.
- Pide un `streamId` con `chrome.tabCapture.getMediaStreamId(…)` (sólo puede
  hacerlo porque abrir el popup cuenta como "invocar la extensión") y lo
  envía al service worker.
- Mientras está abierto, conecta un `chrome.runtime.Port` llamado `meter` al
  offscreen para pintar el vúmetro a ~30 fps.
- Cada cambio en la UI dispara `commit(patch)`: fusiona en memoria, pinta y
  en el siguiente `requestAnimationFrame` guarda + manda `ENGINE_SETTINGS` al
  offscreen.

### 3.2 Service Worker (`src/background/service-worker.js`)

- **Puede dormirse en cualquier momento**. No guarda estado en memoria:
  pregunta al offscreen cada vez que lo necesita.
- Maneja los mensajes del popup (`CAPTURE_START`, `CAPTURE_STOP`, `STATUS`).
- Maneja el atajo de teclado `Alt+Shift+D` (`chrome.commands.onCommand`) sin
  necesidad de que el popup esté abierto.
- Cierra el offscreen cuando el motor avisa que ya no hay pestañas activas
  (`ENGINE_IDLE`).
- Libera la captura si Chrome cierra una pestaña capturada
  (`chrome.tabs.onRemoved`).

### 3.3 Offscreen (`src/offscreen/`)

- Es un **documento oculto persistente** que Chrome mantiene vivo mientras
  tenga razones declaradas (aquí: `'USER_MEDIA'`).
- Sólo tiene acceso a `chrome.runtime`. La configuración le llega por
  mensajes, no la lee de `chrome.storage` directamente.
- Contiene el único `AudioContext` de toda la extensión, el `AudioEngine` y
  el `Map<tabId, {stream, source}>` con las pestañas activas.
- Es la **fuente de verdad**: si quieres saber qué pestañas están
  capturándose, le preguntas con `ENGINE_STATUS`.

---

## 4. Flujos extremo a extremo

### 4.1 Encender la captura en una pestaña

```
usuario abre popup
   │
   ▼ popup.js · init()
loadSettings() ──▶ chrome.storage.local.get(STORAGE_KEY)
addScrews([data-rack])
buildControls() + buildPresets()
chrome.tabs.query({active, currentWindow}) ─▶ tab
   │
   ▼ si autoCapture = true o el usuario toca ⏻
startCapture()
   │  await saveSettings(settings)
   │  streamId = chrome.tabCapture.getMediaStreamId({targetTabId: tab.id})
   │
   ▼ toBackground(MSG.CAPTURE_START, {tabId, streamId})
service-worker.js · handle()
   │  offscreen.ensure()        ← crea el offscreen si no existe
   │  settings = loadSettings() ← re-lee storage para que entre con los
   │                              valores reales
   │
   ▼ offscreen.send(MSG.ENGINE_ADD_TAB, {tabId, streamId, settings})
offscreen.js · handle()
   │  engine.setSettings(settings)
   │  engine.addTab(tabId, streamId)
   │      ├─ init() → crea AudioContext + grafo si es la 1a vez
   │      ├─ getUserMedia({chromeMediaSource:'tab', chromeMediaSourceId})
   │      ├─ stream → MediaStreamSource → bus (grafo)
   │      └─ track.onended → removeTab() + onTabEnded()
   │
   ▼ respuesta {ok:true, tabs: [...]}
popup.js:
   setCaptureUi('on')
   connectMeter()  ← abre el puerto 'meter'
```

### 4.2 Cambiar un control del popup

```
usuario mueve una perilla
   │
   ▼ ui/knob.js · onInput(value)
popup.js · commit({volume: value})
   ├─ settings = {...settings, patch}
   ├─ renderToggles()
   │   └─ markActivePreset()   ← resalta el preset que cuadre
   └─ en el siguiente rAF:
       ├─ saveSettings(settings)      → chrome.storage.local
       └─ chrome.runtime.sendMessage(
             {target: OFFSCREEN, type: ENGINE_SETTINGS, settings})
          │
          ▼ offscreen · engine.setSettings()
          sanitizeSettings() + chain.forEach(fx => fx.update(settings, bypass))
          Cada efecto aplica una ramp() de ~20 ms a sus `AudioParam`s.
```

### 4.3 Apagar la captura

```
usuario toca ⏻ (o atajo Alt+Shift+D cuando ya está activo)
   │
   ▼ toBackground(MSG.CAPTURE_STOP, {tabId})
service-worker:
   offscreen.send(ENGINE_REMOVE_TAB, {tabId})
      │
      ▼ offscreen:
      engine.removeTab(tabId)
      notifyIfIdle()
         └─ si tabs.length === 0:
              chrome.runtime.sendMessage({target: BACKGROUND, type: ENGINE_IDLE})
                 │
                 ▼ service-worker: closeIfIdle()
                 └─ offscreen.close()  ← libera el AudioContext y el offscreen
popup:
   disconnectMeter()
   setCaptureUi('idle')
```

### 4.4 Atajo global (`Alt+Shift+D`)

Es el único flujo donde el popup NO participa:

```
chrome.commands.onCommand('toggle-capture', tab)
   │
   ▼ service-worker · onCommand listener
   ├─ status() ─▶ offscreen.send(ENGINE_STATUS) → {tabs}
   ├─ si tab.id está en tabs: stopCapture(tab.id)
   └─ si no: streamId = chrome.tabCapture.getMediaStreamId({targetTabId: tab.id})
             startCapture(tab.id, streamId)
```

> `tabCapture.getMediaStreamId` sólo funciona porque el callback de
> `chrome.commands` cuenta como "activación por gesto del usuario".

---

## 5. Protocolo de mensajes (`MSG.*`)

Todos los mensajes son `chrome.runtime.sendMessage({target, type, ...payload})`
y las respuestas son objetos planos. El campo `target` enruta y los listeners
filtran por él.

Definido en `src/shared/constants.js`:

```js
export const TARGET  = { BACKGROUND: 'background', OFFSCREEN: 'offscreen' };
export const MSG = {
  CAPTURE_START:     'capture:start',
  CAPTURE_STOP:      'capture:stop',
  STATUS:            'status',
  ENGINE_ADD_TAB:    'engine:add-tab',
  ENGINE_REMOVE_TAB: 'engine:remove-tab',
  ENGINE_SETTINGS:   'engine:settings',
  ENGINE_STATUS:     'engine:status',
  ENGINE_IDLE:       'engine:idle',
};
```

### 5.1 Hacia `TARGET.BACKGROUND`

| `type`             | Payload                       | Respuesta                   | Quién lo manda |
|--------------------|-------------------------------|-----------------------------|---------------|
| `CAPTURE_START`    | `{tabId, streamId}`           | `{ok, tabs} \| {ok:false,error}` | popup         |
| `CAPTURE_STOP`     | `{tabId}`                     | `{ok, tabs}`                | popup         |
| `STATUS`           | —                             | `{ok, tabs}`                | popup         |
| `ENGINE_IDLE`      | —                             | `{ok}`                      | offscreen     |

### 5.2 Hacia `TARGET.OFFSCREEN`

| `type`             | Payload                                 | Respuesta        | Quién lo manda           |
|--------------------|-----------------------------------------|------------------|--------------------------|
| `ENGINE_ADD_TAB`   | `{tabId, streamId, settings?}`          | `{ok, tabs}`     | service worker           |
| `ENGINE_REMOVE_TAB`| `{tabId}`                               | `{ok, tabs}`     | service worker           |
| `ENGINE_SETTINGS`  | `{settings}`                            | `{ok}`           | popup (debounced x rAF)  |
| `ENGINE_STATUS`    | —                                       | `{ok, tabs}`     | service worker           |

### 5.3 Puerto en vivo `METER_PORT`

- `name = 'meter'`
- Abierto por el popup con `chrome.runtime.connect({name: METER_PORT})`.
- El offscreen escucha en `chrome.runtime.onConnect` y empieza un
  `setInterval(33 ms)` que postea `engine.readLevels()` (array `[L, R]`,
  valores `0–1`).
- Al cerrar el popup, el `onDisconnect` del offscreen limpia el intervalo
  automáticamente.

---

## 6. Modelo de datos: `settings`

Definido en `src/shared/constants.js` (`DEFAULT_SETTINGS`) y validado por
`src/shared/settings.js` (`sanitizeSettings`).

```js
{
  volume: 100,                       // 0 – 600
  muted: false,
  bypass: false,                     // true = EQ + FX en neutro
  eq: [0, 0, 0, 0, 0],               // 5 ganancias, ±12 dB
  pitch: 0,                          // ±12 semitonos
  pan: 0,                            // -100 (I) ↔ +100 (D)
  reverb: { mix: 0, decay: 2 },      // mix 0–100, decay 0.5–5
  autoCapture: true,                 // true = enciende al abrir el popup
  theme: 'dark',                     // 'dark' | 'light'
  lang: 'en',                        // 'en' | 'es'
}
```

### 6.1 `sanitizeSettings(raw)`

- Recorta cada valor a su rango (`clamp`).
- Si una banda del EQ falta, usa `0`.
- Si `theme` o `lang` son inválidos, cae al default.
- Idempotente: `sanitize(sanitize(x)) === sanitize(x)`.

### 6.2 Migración legacy

`loadSettings()` reconoce la clave antigua `dragonAudioState` (campo
`isMuted` en vez de `muted`, etc.), la convierte una sola vez y la borra.

---

## 7. Cadena de audio y efectos

### 7.1 Grafo global

```
pestaña 1 ──► MediaStreamSource ──┐
pestaña 2 ──► MediaStreamSource ──┤
pestaña N ──► MediaStreamSource ──┤
                                  ▼
                                 bus (GainNode)
                                  ▼
                 EQ (5 BiquadFilter en serie)
                                  ▼
                 Pitch (AudioWorkletNode | passthrough)
                                  ▼
                 Pan (StereoPannerNode)
                                  ▼
                 Reverb (dry + convolver con mezcla)
                                  ▼
                 Master (low-shelf → gain → [softclip] → gain)
                                  ├──► ctx.destination (altavoces)
                                  └──► Meter (AnalyserNode RMS)
```

Un solo `AudioContext` y una sola cadena para TODAS las pestañas capturadas.
Montarlo es responsabilidad de `AudioEngine#build()` y se hace al añadir la
primera pestaña.

### 7.2 Ciclo de vida del `AudioEngine`

```js
engine.init()        // (idempotente) crea AudioContext + grafo
engine.addTab(id, streamId)
engine.setSettings(settings)   // aplica rampas a los AudioParam
engine.removeTab(id)
engine.readLevels() // [L, R] para el vúmetro
engine.dispose()    // cierra el AudioContext
```

Si `addTab` se llama con un `tabId` que ya existe, no hace nada.

### 7.3 Rampa anti-clic (`src/offscreen/engine/ramp.js`)

Toda escritura a un `AudioParam` pasa por `ramp(ctx, param, target)` que
hace una rampa lineal de ~20 ms desde el valor actual al objetivo. Evita
"clicks" audibles al cambiar perillas en vivo.

### 7.4 Contrato de un efecto

Todo archivo en `src/offscreen/engine/effects/` exporta una **factoría**:

```js
export function createX(ctx) {
  // ... crea nodos
  return {
    input:  AudioNode,                      // nodo donde se conecta la señal
    output: AudioNode,                      // nodo que sale al siguiente efecto
    update(settings, bypass) { /* ... */ }, // llama ramp() para los parámetros
  };
}
```

- `update` recibe la configuración completa; cada efecto saca lo que
  necesita.
- Si `bypass === true` el efecto se pone en neutro (gain 0, EQ a 0 dB, mix 0,
  etc.).
- El orden en la cadena lo decide `AudioEngine#build()`:
  `[EQ, Pitch, Pan, Reverb, Master]`.

### 7.5 Detalle por efecto

#### `master.js` — volumen + protección

- `volume` lineal (`600 % = ×6`).
- Un **low-shelf en 150 Hz** empieza a recortar graves cuando se sube de
  100 %, hasta `−12 dB` a 600 %. Evita que el bajo saque el altavoz del
  salón.
- Un **WaveShaper con soft-clip** (`tanh` fuera de ±0.7) entra en circuito
  si la señal puede saturar (volumen > 100 %, o EQ con alguna banda positiva).
  Oversample 4× para no aliasar.
- `muted` corta a 0 el `GainNode` principal con rampa (no desconecta nodos,
  evita latencias de reconexión).

#### `equalizer.js` — 5 bandas

- `BiquadFilter` en serie, lectura directa de `EQ_BANDS` en
  `src/shared/constants.js`. `Q = 1` en todas; shelf en los extremos.
- `bypass`: pone todas las ganancias a `0 dB` (no desconecta nada).

#### `pitch.js` — tono sin cambiar velocidad

- Carga el worklet `src/offscreen/worklets/pitch-shifter.worklet.js` en
  `AudioEngine#build()`. Si falla, se devuelve un passthrough.
- Granular: dos cabezales desfasados, ventana de 60 ms, crossfade sin²/cos²
  para disimular las uniones.
- Con `semitones = 0` el worklet pasa la señal directa sin latencia extra.

#### `pan.js` — paneo estéreo

- Un `StereoPannerNode`. `pan` del popup es `-100 a 100`; se divide por 100
  (`-1 a 1`) para `StereoPanner`.

#### `reverb.js` — reverberación por convolución

- Impulso **sintético**: ruido blanco estéreo con caída exponencial RT60.
  Longitud = `sampleRate × decay` samples.
- Al cambiar `decay`, se **regenera con debounce de 150 ms** para evitar
  recomponer el impulso en cada mover de perilla.
- Si `mix === 0` se **desconecta** el convolver del grafo (no gasta CPU).
- La rama seca nunca baja de 0.5 → con `mix = 100` queda 50 % seco + 100 %
  cola, el usuario nunca se "pierde" la fuente.

---

## 8. Interfaz del popup

### 8.1 Esqueleto HTML

El popup tiene **tres vistas** navegables con 3 estrellas arriba:

```
<body>
  <div class="scenery">                   ← Fondo del dragón difuminado
    <div class="scenery__img"></div>
    <div class="scenery__veil"></div>
  </div>

  <main class="app" data-view="mixer">
    <nav class="stars">                   ← 3 estrellas: cambia data-view
      <button data-view="mixer"></button>
      <button data-view="presets"></button>
      <button data-view="about"></button>
    </nav>

    <header class="brand">                ← logo + "DRAGON AUDIO" + ⏻
      <img class="brand__logo brand__logo--dark">
      <img class="brand__logo brand__logo--light">
      …
    </header>

    <div class="tabline">…</div>          ← host + estado capture

    <div class="view view--mixer" data-view-panel="mixer">
      <section class="card hero">…</section>   ← Volumen + mute + 100 + vúmetro
      <section class="card">…EQ…</section>
      <section class="card">…FX…</section>
      <footer class="foot">…Auto/EN·ES/☀☾/Reset…</footer>
    </div>

    <div class="view view--presets" data-view-panel="presets" hidden>
      <section class="card">…grid de presets…</section>
    </div>

    <div class="view view--about" data-view-panel="about" hidden>
      <section class="card card--about">…logo + versión + créditos…</section>
    </div>

    <div class="notice" hidden></div>
  </main>
</body>
```

### 8.2 Cambio de vista

`popup.js` escucha clicks en `.stars` y llama a `switchView(view)`:

- Pone `app.dataset.view = view`.
- Alterna `.is-active` y `aria-selected` en los botones de estrella.
- Alterna el atributo `hidden` en los `[data-view-panel]` según su `data-view-panel`.

El CSS tiene `.view[hidden] { display: none; }` para esconderlos.

### 8.3 Componentes UI (`src/popup/ui/`)

| Archivo    | Qué hace |
|-----------|---------|
| `knob.js`  | Crea una perilla SVG. Soporta drag vertical, wheel, doble clic (resetea), teclado, zonas (`normal/boost/danger`). Expone `.set(value)` y `.el`. Usada para volumen y FX (pitch/pan/reverb mix/reverb decay). |
| `fader.js` | Fader vertical, usado para las 5 bandas del EQ. |
| `meter.js` | Dibuja el vúmetro con picos. `push(levels)` desde el puerto `meter`; `reset()`. |
| `rack.js`  | `addScrews(els)` añade 4 `<span class="screw screw--tl/tr/bl/br">` a cada tarjeta con `data-rack`. Rotación aleatoria para que no parezcan clonados. |

### 8.4 El flujo del vúmetro

```
offscreen · engine.readLevels()   ─── 33 ms ──▶ port.postMessage([L, R])
popup · meterPort.onMessage(levels) → meter.push(levels) → repaint
```

Si el popup se cierra, `port.onDisconnect` en el offscreen limpia el
intervalo. Si el motor se destruye, el popup recibe `onDisconnect` y resetea
el vúmetro.

---

## 9. Sistema de temas (CSS)

Dragon Audio tiene **dos temas**: oscuro (laca y oro) y claro (papel de
arroz). Están declarados como **custom properties** en `:root`.

### 9.1 Dónde se define el tema

En `src/popup/popup.css`:

```css
:root {                       /* tema oscuro, por defecto */
  --bg: #0d0507;
  --accent: #e8c36a;
  --crimson: #c0392b;
  …
}

:root[data-theme='light'] {   /* tema claro */
  --bg: #f3ead8;
  --accent: #8a5a0e;
  …
}
```

Cambiar un color es **tocar en los dos bloques**. Nunca uses literales en
las reglas de componente: siempre `var(--…)`.

### 9.2 Boot sin parpadeo

`src/popup/boot.js` (script clásico en `<head>`, antes del CSS):

```js
const prefs = JSON.parse(localStorage.getItem('dragonAudio.ui') || '{}');
if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
if (prefs.lang)  document.documentElement.lang = prefs.lang;
```

Guarda una copia pequeña del tema/idioma en `localStorage` justo para que el
HTML se pinte con el tema correcto antes de que `chrome.storage` responda
(que es asíncrono).

### 9.3 Fondo "scenery" (dragón sobre montañas)

```html
<div class="scenery">
  <div class="scenery__img"></div>   ← imagen con blur + opacidad
  <div class="scenery__veil"></div>  ← degradado para subir el contraste
</div>
```

- `background-image` apunta a
  `assets/img/Dragón dorado sobre montañas brumosas.png`
  (URL-encoded en el CSS: `Drag%C3%B3n%20…`).
- Oscuro: `opacity: 0.9`, `blur(3px)`, `brightness(0.9)`.
- Claro: `opacity: 0.75`, `blur(4px)`, `brightness(1.1)`.
- El `veil` es un degradado traslúcido muy suave que atenúa, no tapa.

### 9.4 Nav de 3 estrellas

Las estrellas son **`<button>` con `background-image` por CSS**:

- Oscuro → `Estrellas-cambiopagina1.png` (crema).
- Claro → `Estrellas-cambiopagina.png`  (negra).

El swap se hace en `:root[data-theme='light'] .star { background-image: … }`.

Estado activo: `.star.is-active { transform: scale(1.25); filter: drop-shadow(halo) }`
+ animación `star-flash`.

### 9.5 Doble logo

- `<img class="brand__logo--dark">` emblema dorado (tema oscuro).
- `<img class="brand__logo--light">` logo corporate negro (tema claro).
- CSS esconde la variante que no toca:
  `:root[data-theme='light'] .brand__logo--dark { display: none }`.
- Nombre "DRAGON AUDIO" cambia a negro en tema claro
  (`:root[data-theme='light'] .brand__title { color: #0a0a0a }`).
- Mismo tratamiento en la vista Acerca (`.about__logo--dark/--light`).

### 9.6 "Rack" de audio

Cada `.card` tiene:
- Padding especial para dejar sitio a las orejas (`--ear: 14px`).
- `::before` y `::after` → las orejas laterales.
- Fondo con `--mountain` (SVG inline con una silueta de montañas abajo) +
  degradado `--card-a → --card-b`.
- 4 tornillos `.screw--tl/tr/bl/br` añadidos por `rack.js`.

Para que una card nueva reciba tornillos basta con marcarla con `data-rack`
y añadirla antes de `init()`:

```html
<section class="card" data-rack>…</section>
```

---

## 10. Internacionalización (i18n)

### 10.1 Diccionarios

En `src/popup/i18n.js`:

```js
const MESSAGES = {
  en: { 'power.turnOn': 'Turn on …', … },
  es: { 'power.turnOn': 'Activar …',  … },
};
```

### 10.2 API

```js
setLang('es')             // cambia idioma + aplica a <html lang>
t('power.turnOn')         // devuelve la traducción
t('eq.hint', {label:'60'}) // sustituye {label}
translateDom(root = document)  // aplica a todos los nodos marcados
```

### 10.3 Marcar un nodo en HTML

| Atributo | Qué hace |
|---------|---------|
| `data-i18n="key"`         | Reemplaza `textContent` con `t(key)`. |
| `data-i18n-title="key"`   | Setea `title`. |
| `data-i18n-aria="key"`    | Setea `aria-label`. |

Si un control se construye en JS (knob, fader), su label se pasa como
`t(…)` directamente al constructor, no por atributo.

### 10.4 Cambiar idioma en vivo

```js
ui.langSeg.addEventListener('click', (e) => {
  const lang = e.target.closest('[data-lang]')?.dataset.lang;
  commit({ lang });        // guarda la preferencia
  applyLang();             // setLang + translateDom
  buildControls();         // los knobs/faders se re-crean (labels nuevas)
  rememberUiPrefs();       // guarda en localStorage para el próximo boot
});
```

Los textos de los **presets** se traducen con `data-i18n` sin tener que
reconstruirlos (`translateDom` los pilla).

---

## 11. Presets

### 11.1 Definición

En `src/popup/popup.js`, al inicio:

```js
const PRESETS = [
  { id:'flat',   glyph:'平', patch: { volume:100, …, eq:[0,0,0,0,0],  reverb:{mix:0, decay:2} } },
  { id:'vocal',  glyph:'聲', patch: { volume:110, …, eq:[-2,0,3,2,0], reverb:{mix:10,decay:1.5} } },
  { id:'cinema', glyph:'影', patch: { volume:130, …, eq:[3,0,0,1,3],  reverb:{mix:25,decay:3} } },
  { id:'night',  glyph:'夜', patch: { volume:75,  …, eq:[2,1,0,-2,-3],reverb:{mix:5, decay:2} } },
];
```

Cada preset guarda:
- `id`     — se usa como clave i18n (`presets.<id>`, `presets.<id>.desc`).
- `glyph`  — carácter chino decorativo.
- `patch`  — objeto compatible con `settings` que **sobreescribe** campos.

### 11.2 Renderizado

`buildPresets()` crea un `<button class="preset">` por cada entrada con:

```html
<button class="preset" data-preset="flat" aria-pressed="false">
  <span class="preset__glyph">平</span>
  <span class="preset__name" data-i18n="presets.flat"></span>
  <span class="preset__desc" data-i18n="presets.flat.desc"></span>
</button>
```

Después llama a `translateDom(ui.presets)` para poblar las labels y
`markActivePreset()` para resaltar el que coincide con los `settings`
actuales.

### 11.3 Aplicar

`applyPreset(preset)` hace:

```js
commit(structuredClone(preset.patch));  // guarda + manda al motor
syncControls();                         // mueve knobs/faders visualmente
```

### 11.4 Detectar preset activo

`presetMatches(preset)` compara campo a campo (incluyendo `eq[]` y
`reverb.{mix,decay}`). `markActivePreset()` corre dentro de
`renderToggles()`, que se dispara en cada `commit`.

---

## 12. Assets e íconos

### 12.1 Imágenes del popup

Están en `assets/img/`. Las rutas con tildes se **URL-encodean** en CSS/HTML
para evitar sorpresas:

| Nombre en disco | Nombre codificado |
|-----------------|-------------------|
| `Dragón dorado sobre montañas brumosas.png`                 | `Drag%C3%B3n%20dorado%20sobre%20monta%C3%B1as%20brumosas.png` |
| `Emblema_dorado_del_dragón_serpentino-removebg-preview.png` | `Emblema_dorado_del_drag%C3%B3n_serpentino-removebg-preview.png` |
| `Logo , Corporate negro.png`                                | `Logo%20%2C%20Corporate%20negro.png` |

### 12.2 Íconos de la extensión (barra de Chrome)

Se generan a partir del emblema dorado con **PowerShell + System.Drawing**:

```powershell
Add-Type -AssemblyName System.Drawing
$src = "…\assets\img\Emblema_dorado_del_dragón_serpentino-removebg-preview.png"
$dst = "…\assets\icons"
$img = [System.Drawing.Image]::FromFile($src)
foreach ($size in 16, 32, 48, 128) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode     = 'HighQuality'
  $g.PixelOffsetMode   = 'HighQuality'
  $g.CompositingQuality= 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($img, 0, 0, $size, $size)
  $bmp.Save("$dst\icon-$size.png", 'Png')
  $g.Dispose(); $bmp.Dispose()
}
$img.Dispose()
```

Chrome usa esos íconos automáticamente porque `manifest.json` ya los
declara en `icons` y en `action.default_icon`.

---

## 13. Permisos del `manifest.json`

```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "tabCapture", "offscreen", "storage"],
  "background": { "service_worker": "src/background/service-worker.js",
                  "type": "module" },
  "action":     { "default_popup": "src/popup/popup.html", … },
  "commands":   {
    "_execute_action": { "suggested_key": { "default": "Alt+Shift+A" } },
    "toggle-capture":  { "suggested_key": { "default": "Alt+Shift+D" } }
  }
}
```

| Permiso        | Por qué |
|----------------|---------|
| `activeTab`    | Permite `tabCapture.getMediaStreamId({targetTabId})` para la pestaña actual. |
| `tabCapture`   | Captura del audio de la pestaña. |
| `offscreen`    | Crear el documento oculto donde vive el `AudioContext`. |
| `storage`      | Persistir `settings`. |

No se pide `tabs` ni `host_permissions` — con `activeTab` basta para la
pestaña actual.

---

## 14. Persistencia

- **Fuente de verdad**: `chrome.storage.local` bajo la clave
  `STORAGE_KEY = 'dragonAudio.settings'`.
- **Caché UI** (sólo tema + idioma, para evitar parpadeo): `localStorage`
  con la clave `dragonAudio.ui`. La escribe `rememberUiPrefs()`.
- **Legacy**: si existe `dragonAudioState` (versión anterior), `loadSettings`
  la migra una vez y la borra.

El servicio worker **no** persiste nada en memoria: cada vez que arranca
pregunta al offscreen o re-lee storage.

---

## 15. Cómo extender

### 15.1 Añadir un efecto nuevo

1. Crear `src/offscreen/engine/effects/miEfecto.js` siguiendo el contrato
   (`createX(ctx) → {input, output, update}`).
2. Importarlo en `src/offscreen/engine/AudioEngine.js` y añadirlo al array
   `chain` en `#build()` en la posición que corresponda.
3. Añadir el parámetro a `DEFAULT_SETTINGS` y a `RANGE` en
   `src/shared/constants.js`.
4. Añadir el campo a `sanitizeSettings` en `src/shared/settings.js`.
5. En `src/popup/popup.js`, en `buildControls()`, crear un `createKnob` o
   `createFader` con `onInput: (v) => commit({ miEfecto: v })`.
6. Añadir las claves i18n en `src/popup/i18n.js`.
7. (Opcional) Añadir al preset existente los valores por defecto del
   efecto para que `presetMatches` siga funcionando.

### 15.2 Añadir una vista nueva (4a estrella)

1. En `popup.html`:
   - Añadir una `<button class="star" data-view="misc">` dentro de `.stars`.
   - Añadir `<div class="view" data-view-panel="misc" hidden>…</div>`.
2. `switchView()` ya la soporta: usa `data-view` y `data-view-panel`.
3. Añadir la clave `stars.misc` a `i18n.js`.

### 15.3 Añadir un preset nuevo

Un solo cambio en `PRESETS` (en `popup.js`) + dos claves i18n
(`presets.foo`, `presets.foo.desc`). `buildPresets()` lo pinta solo.

### 15.4 Añadir un idioma nuevo

1. En `src/shared/constants.js`, añadir el código a `LANGS` (ej.
   `['en', 'es', 'pt']`).
2. En `src/popup/i18n.js`, añadir la entrada completa a `MESSAGES.pt`.
3. En `popup.html`, añadir el `<button data-lang="pt">PT</button>` al
   `.seg` del footer.
4. En `_locales/`, añadir `pt/messages.json` con `extName` y
   `extDescription` (es lo que Chrome muestra en la tienda y en
   `chrome://extensions`).

---

## 16. Depuración y errores comunes

### 16.1 El popup no responde

- Abrir DevTools del popup: clic derecho sobre el icono de la extensión →
  **Inspeccionar popup**.
- Buscar errores con prefijo `[DragonAudio]`.

### 16.2 El offscreen no se crea

- `chrome://extensions` → **Service worker** → **Inspeccionar**. Mira los
  logs del service worker.
- Si `chrome.offscreen.createDocument` falla, suele ser porque ya existe:
  `offscreen-client.js#ensure()` evita la carrera con un `creating ??=`.

### 16.3 "This tab is already being captured…"

Otra extensión (o Chrome con "Cast") ya tomó el stream. Dragon Audio no
puede abrir dos streams a la misma pestaña a la vez. Mensaje definido en
`error.busy` (i18n).

### 16.4 Páginas bloqueadas

```js
const BLOCKED_URL = /^(chrome|edge|brave|opera|about|devtools|view-source|chrome-extension):|^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;
```

Si la URL de la pestaña matchea, Chrome prohíbe `tabCapture`. El popup
muestra `notice.blocked` y deshabilita ⏻.

### 16.5 El vúmetro no se mueve

- ¿El popup conectó el puerto? Mira
  `chrome.runtime.connect({name:'meter'})` en el panel Network del popup.
- ¿Hay pestaña activa capturándose? Comprueba con `MSG.STATUS` desde la
  consola del popup:
  ```js
  chrome.runtime.sendMessage({target:'background', type:'status'}, console.log);
  ```

### 16.6 Pitch suena distorsionado o no cambia

- Mira el log `[DragonAudio] pitch no disponible` en la consola del
  offscreen. Si aparece, el worklet no cargó y se usa el passthrough.
- Causas típicas: el archivo del worklet se movió, o el navegador no soporta
  `AudioWorkletNode` (todos los Chrome ≥ 66 lo soportan).

### 16.7 Cambios visuales no se aplican

- `chrome://extensions` → **recargar** la extensión (icono circular).
- Si editas CSS/JS del popup, basta con cerrar y volver a abrir el popup.
- Si editas el service worker o el offscreen, hay que recargar la
  extensión completa.

---

## 17. Glosario

| Término | Significado |
|---------|------------|
| **Service worker** | Script de fondo MV3 que puede dormirse. En Chrome equivale a lo que antes era la "background page". |
| **Offscreen document** | Documento HTML oculto que Chrome mantiene vivo por razones declaradas (aquí: `USER_MEDIA`). Permite usar APIs que necesitan un contexto DOM, como `AudioContext`. |
| **`tabCapture`** | API de Chrome para capturar audio/video de una pestaña. Devuelve un `streamId` que luego se abre con `getUserMedia({chromeMediaSource:'tab', chromeMediaSourceId})`. |
| **AudioParam / rampa** | Los `AudioParam` de Web Audio se pueden programar (en vez de asignar); una rampa (`linearRampToValueAtTime`) evita el "pop" que hace un cambio instantáneo. |
| **BiquadFilter** | Filtro de 2 polos / 2 ceros, base del EQ. Shelf en los extremos, peaking en el medio. |
| **AudioWorklet** | Procesador DSP que corre fuera del thread principal. Se registra con `audioWorklet.addModule()` y se usa con `AudioWorkletNode`. |
| **Convolución** | Multiplicar la señal por un impulso de referencia. Un impulso con cola exponencial = reverb. |
| **RT60** | Tiempo que tarda un sonido en caer 60 dB en una sala. Lo que llamamos `decay` del reverb. |
| **Soft-clip** | Saturación "suave": en vez de recortar bruscamente ±1, se usa una curva (`tanh`) que redondea los picos. Suena más amable que el `clip` duro. |
| **Rack** | Metáfora visual: cada tarjeta parece una unidad de rack 1U con sus orejas y tornillos. |
| **Memphis / corporate memphis** | Estilo de ilustración plano con contornos limpios, muy usado en logos corporativos. Lo que usa el logo del dragón. |

---

**Última revisión:** 2026-10-12.
Si tocas una sección cambiando contratos, actualiza también el número de
versión en `manifest.json` (`version` + `MSG` / `TARGET` / `RANGE` en
`src/shared/constants.js`).
