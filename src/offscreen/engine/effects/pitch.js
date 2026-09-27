// Cambio de tono SIN cambiar la velocidad (worklet granular, ver worklets/pitch-shifter.worklet.js).
// Si el worklet no carga, el efecto queda como paso directo.
export const PITCH_WORKLET_URL = new URL('../../worklets/pitch-shifter.worklet.js', import.meta.url).href;
export const PITCH_PROCESSOR = 'dragon-pitch-shifter';

export function createPitch(ctx, workletReady) {
  if (!workletReady) {
    const passthrough = ctx.createGain();
    return { input: passthrough, output: passthrough, update() {} };
  }

  const node = new AudioWorkletNode(ctx, PITCH_PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const semitones = node.parameters.get('semitones');

  return {
    input: node,
    output: node,
    update({ pitch }, bypass) {
      semitones.setValueAtTime(bypass ? 0 : pitch, ctx.currentTime);
    },
  };
}
