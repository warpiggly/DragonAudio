import { RANGE } from './constants.js';

const { max: MAX, unity: UNITY, danger: DANGER } = RANGE.volume;

// 0–100 % ocupa la primera mitad del recorrido; 100–600 % la segunda.
export const volumeToTravel = (v) =>
  v <= UNITY ? (v / UNITY) * 0.5 : 0.5 + ((v - UNITY) / (MAX - UNITY)) * 0.5;

export const travelToVolume = (t) =>
  t <= 0.5 ? t * 2 * UNITY : UNITY + (t - 0.5) * 2 * (MAX - UNITY);

export function volumeZone(v) {
  if (v > DANGER) return 'danger';
  if (v > UNITY) return 'boost';
  if (v === UNITY) return 'unity';
  return 'normal';
}
