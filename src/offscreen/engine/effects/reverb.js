import { ramp } from '../ramp.js';

// Reverb por convolución (portado de Dragon Audio web).
// Impulso = ruido estéreo con caída RT60: e^(−ln1000 · t / decay).
const LN1000 = Math.log(1000);
const DECAY_DEBOUNCE_MS = 150;

function makeImpulse(ctx, decay) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * decay));
  const impulse = ctx.createBuffer(2, length, rate);
  const k = LN1000 / decay;
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp((-k * i) / rate);
    }
  }
  return impulse;
}

// La rama seca nunca baja de 0.5: mezcla 100 % = mitad seca + toda la cola.
const dryLevel = (mix) => 1 - (mix / 100) * 0.5;

export function createReverb(ctx, initialDecay) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const convolver = ctx.createConvolver();

  let decay = initialDecay;
  let decayTimer = null;
  let wetConnected = false;
  convolver.buffer = makeImpulse(ctx, decay);
  wet.gain.value = 0;

  input.connect(dry);
  convolver.connect(wet);
  dry.connect(output);
  wet.connect(output);

  // Con mezcla 0 el convolver se desconecta: no gasta CPU.
  function setWetConnected(on) {
    if (on === wetConnected) return;
    if (on) input.connect(convolver);
    else input.disconnect(convolver);
    wetConnected = on;
  }

  return {
    input,
    output,
    update({ reverb }, bypass) {
      const mix = bypass ? 0 : reverb.mix;
      setWetConnected(mix > 0);
      ramp(ctx, dry.gain, dryLevel(mix));
      ramp(ctx, wet.gain, mix / 100);

      if (reverb.decay !== decay) {
        decay = reverb.decay;
        clearTimeout(decayTimer);
        decayTimer = setTimeout(() => { convolver.buffer = makeImpulse(ctx, decay); }, DECAY_DEBOUNCE_MS);
      }
    },
  };
}
