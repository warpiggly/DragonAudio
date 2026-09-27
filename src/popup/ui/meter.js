// Vúmetro L/R con balística (subida rápida, caída lenta, pico retenido).
const FLOOR_DB = -48;
const FALL_PER_SEC = 1.6;
const PEAK_HOLD_MS = 900;

const toFraction = (amp) => {
  if (amp <= 0) return 0;
  const db = 20 * Math.log10(amp);
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
};

export function createMeter(host) {
  const root = document.createElement('div');
  root.className = 'meter';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = ['L', 'R'].map((ch) => `
    <div class="meter__row">
      <span class="meter__ch">${ch}</span>
      <div class="meter__bar"><span class="meter__fill"></span><span class="meter__peak"></span></div>
    </div>`).join('');
  host.append(root);

  const fills = [...root.querySelectorAll('.meter__fill')];
  const peaks = [...root.querySelectorAll('.meter__peak')];
  const level = [0, 0];
  const peak = [0, 0];
  const peakAt = [0, 0];
  let target = [0, 0];
  let last = performance.now();
  let frame = 0;

  function tick(now) {
    const dt = (now - last) / 1000;
    last = now;
    for (let i = 0; i < 2; i++) {
      const t = toFraction(target[i]);
      level[i] = t > level[i] ? t : Math.max(t, level[i] - FALL_PER_SEC * dt);
      if (level[i] >= peak[i]) { peak[i] = level[i]; peakAt[i] = now; }
      else if (now - peakAt[i] > PEAK_HOLD_MS) peak[i] = Math.max(level[i], peak[i] - FALL_PER_SEC * dt);
      fills[i].style.transform = `scaleX(${level[i]})`;
      peaks[i].style.left = `${peak[i] * 100}%`;
      peaks[i].style.opacity = peak[i] > 0.01 ? 1 : 0;
    }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  return {
    push(levels) { target = levels; },
    reset() { target = [0, 0]; },
    stop() { cancelAnimationFrame(frame); },
  };
}
