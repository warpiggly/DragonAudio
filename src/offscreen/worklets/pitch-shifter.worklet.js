// Pitch shifter granular (línea de retardo con dos cabezales).
//
// Dos cabezales leen el audio pasado a velocidad `ratio` = 2^(semitonos/12).
// Su retardo recorre una ventana de WINDOW_SEC y salta al llegar al borde; en
// ese instante su ganancia es 0 (sin²) y el otro cabezal, desfasado media
// ventana, está a tope (cos²). sin² + cos² = 1 → nivel constante.
//
// Tono cambia, velocidad NO. Latencia ≈ media ventana solo con tono ≠ 0;
// en 0 el audio pasa directo (crossfade de 30 ms entre ambos modos).
const WINDOW_SEC = 0.06;
const CROSSFADE_SEC = 0.03;
const BUFFER_SIZE = 1 << 15;
const MASK = BUFFER_SIZE - 1;
const CHANNELS = 2;

class DragonPitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'semitones', defaultValue: 0, minValue: -12, maxValue: 12, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this.buffers = Array.from({ length: CHANNELS }, () => new Float32Array(BUFFER_SIZE));
    this.write = 0;
    this.phase = 0;
    this.window = Math.round(WINDOW_SEC * sampleRate);
    this.mix = 0;
    this.mixStep = 1 / (CROSSFADE_SEC * sampleRate);
  }

  static read(buf, pos) {
    const i = Math.floor(pos);
    const f = pos - i;
    const a = buf[i & MASK];
    return a + (buf[(i + 1) & MASK] - a) * f;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const semitones = parameters.semitones[0];
    const ratio = Math.pow(2, semitones / 12);
    const target = Math.abs(semitones) < 0.01 ? 0 : 1;
    const frames = output[0].length;
    const win = this.window;
    const inc = (1 - ratio) / win;

    for (let n = 0; n < frames; n++) {
      if (this.mix !== target) {
        this.mix = target > this.mix
          ? Math.min(target, this.mix + this.mixStep)
          : Math.max(target, this.mix - this.mixStep);
      }

      let p = this.phase + inc;
      p -= Math.floor(p);
      this.phase = p;
      const q = p < 0.5 ? p + 0.5 : p - 0.5;
      const s = Math.sin(Math.PI * p);
      const ga = s * s;
      const gb = 1 - ga;
      const readA = this.write - (p * win + 1);
      const readB = this.write - (q * win + 1);

      for (let c = 0; c < output.length; c++) {
        const src = input[c] || input[0];
        const x = src ? src[n] : 0;
        const buf = this.buffers[c % CHANNELS];
        buf[this.write] = x;
        const shifted = this.mix > 0
          ? DragonPitchShifter.read(buf, readA) * ga + DragonPitchShifter.read(buf, readB) * gb
          : 0;
        output[c][n] = x * (1 - this.mix) + shifted * this.mix;
      }
      this.write = (this.write + 1) & MASK;
    }
    return true;
  }
}

registerProcessor('dragon-pitch-shifter', DragonPitchShifter);
