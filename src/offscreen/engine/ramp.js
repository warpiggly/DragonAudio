// Rampa corta (~20 ms) para mover parámetros sin clics.
export function ramp(ctx, param, value, tau = 0.02) {
  param.cancelScheduledValues(ctx.currentTime);
  param.setTargetAtTime(value, ctx.currentTime, tau);
}
