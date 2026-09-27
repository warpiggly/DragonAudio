import { RANGE } from '../../../shared/constants.js';
import { ramp } from '../ramp.js';

// Volumen maestro 0–600 % (portado de Dragon Audio web, masterVolume.js).
//  · Ganancia lineal: 200 % = ×2, 600 % = ×6.
//  · Soft-clip de rodilla: |x| ≤ 0.7 pasa intacto; encima se redondea y nunca pasa de ±1.
//  · Sobre 100 % se recortan graves (low-shelf 150 Hz, hasta −12 dB a 600 %).
//  · La protección también entra ≤ 100 % si el EQ está realzando (evita recorte duro).
const MAX_GAIN = RANGE.volume.max / 100;
const KNEE = 0.7;
const CURVE_SAMPLES = 2048;
const LOW_SHELF_FREQ = 150;
const MAX_LOW_CUT_DB = 12;

function softClip(s) {
  const a = Math.abs(s);
  if (a <= KNEE) return s;
  return Math.sign(s) * (KNEE + (1 - KNEE) * Math.tanh((a - KNEE) / (1 - KNEE)));
}

const SOFTCLIP_CURVE = (() => {
  const curve = new Float32Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const u = (i / (CURVE_SAMPLES - 1)) * 2 - 1;
    curve[i] = softClip(MAX_GAIN * u);
  }
  return curve;
})();

function lowCutDb(volume) {
  const { unity, max } = RANGE.volume;
  if (volume <= unity) return 0;
  return -MAX_LOW_CUT_DB * Math.min((volume - unity) / (max - unity), 1);
}

export function createMaster(ctx) {
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = LOW_SHELF_FREQ;
  lowShelf.gain.value = 0;

  const gain = ctx.createGain();
  const preScale = ctx.createGain();
  preScale.gain.value = 1 / MAX_GAIN;
  const shaper = ctx.createWaveShaper();
  shaper.curve = SOFTCLIP_CURVE;
  shaper.oversample = '4x';
  const output = ctx.createGain();

  lowShelf.connect(gain);
  preScale.connect(shaper);
  shaper.connect(output);

  let protectedRoute = null;
  function route(protect) {
    if (protect === protectedRoute) return;
    try { gain.disconnect(); } catch (_) {}
    gain.connect(protect ? preScale : output);
    protectedRoute = protect;
  }

  return {
    input: lowShelf,
    output,
    update({ volume, muted, eq }, bypass) {
      ramp(ctx, gain.gain, muted ? 0 : volume / 100);
      ramp(ctx, lowShelf.gain, lowCutDb(volume));
      const eqBoost = !bypass && eq.some((g) => g > 0);
      route(volume > RANGE.volume.unity || eqBoost);
    },
  };
}
