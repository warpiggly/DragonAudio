import { EQ_BANDS } from '../../../shared/constants.js';
import { ramp } from '../ramp.js';

export function createEqualizer(ctx) {
  const filters = EQ_BANDS.map(({ freq, type }) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 1;
    f.gain.value = 0;
    return f;
  });
  filters.reduce((a, b) => (a.connect(b), b));

  return {
    input: filters[0],
    output: filters[filters.length - 1],
    update({ eq }, bypass) {
      filters.forEach((f, i) => ramp(ctx, f.gain, bypass ? 0 : eq[i]));
    },
  };
}
