# Dragon Audio · extensión

Versión mini de Dragon Audio para Chrome. Controla el audio de cualquier pestaña —también Spotify, YouTube Music, Netflix y otros sitios con DRM—.

| Control | Rango |
|---|---|
| Volumen | 0 – 600 % (0–100 en la primera mitad del recorrido, 100–600 en la segunda) |
| Ecualizador | 5 bandas: 60 · 250 · 1K · 4K · 12K, ±12 dB |
| Tono | ±12 semitonos, sin cambiar la velocidad |
| Paneo | L100 – R100 |
| Reverb | Mezcla 0–100 %, sala 0.5–5 s |

## Instalar

1. Abre `chrome://extensions` y activa **Modo desarrollador**.
2. Pulsa **Cargar descomprimida** y elige esta carpeta.
3. Fija el icono del dragón en la barra.

## Uso

- **Abre el popup** y se activa solo en esa pestaña. Si quieres activarlo con ⏻, apaga **Auto**.
- **Alt+Shift+D** activa o desactiva Dragon Audio en la pestaña actual sin abrir el popup.
- **Alt+Shift+A** abre el popup.
- Para cambiar los atajos, ve a `chrome://extensions/shortcuts`.
- La configuración se guarda y se aplica a todas las pestañas activas.
- Abajo del popup: idioma **EN / ES** (inglés por defecto) y tema **oscuro / claro**.

## Estructura

```
manifest.json
_locales/          nombre y descripción en Chrome (en, es)
assets/            iconos, logo y fuente Cinzel (local)
src/
  shared/          contrato común: constantes, configuración, curva de volumen
  background/      service worker: orquesta la captura y el documento offscreen
  offscreen/       motor de audio (vive aunque el popup se cierre)
    engine/        AudioEngine + un archivo por efecto
    worklets/      procesadores AudioWorklet (pitch shifter)
  popup/           interfaz
    i18n.js        textos del popup (en, es)
    boot.js        aplica tema/idioma antes del primer pintado
    ui/            componentes: perilla, fader, vúmetro, tornillos del rack
docs/              arquitectura
```

Más detalle en:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — resumen de arquitectura.
- [docs/MANUAL-COMPLETO.md](docs/MANUAL-COMPLETO.md) — referencia end-to-end
  (archivos, mensajes, efectos, UI, temas, i18n, presets, extensión).
