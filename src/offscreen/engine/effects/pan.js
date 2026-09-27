import { ramp } from '../ramp.js';

export function createPan(ctx) {
  const panner = ctx.createStereoPanner();
  return {
    input: panner,
    output: panner,
    update({ pan }, bypass) {
      ramp(ctx, panner.pan, bypass ? 0 : pan / 100);
    },
  };
}
