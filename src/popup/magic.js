// Capa de partículas mágicas sobre el fondo del dragón.
//   · chispas doradas que suben con parpadeo (como brasas o magia)
//   · pétalos ámbar que caen con balanceo (como hojas al viento)
// Vive mientras el popup esté abierto; al cerrarse muere con todo el JS.
//
// NO respeta prefers-reduced-motion a propósito: en Windows la opción
// "Efectos de animación" apaga TODAS las animaciones del navegador, y como
// esta decoración se pidió explícitamente para la extensión, no queremos
// que un ajuste del sistema la silencie. La partícula es pequeña, está
// detrás del contenido y no bloquea interacción, así que el riesgo de
// mareo es bajo.

const SPARKLE_COUNT = 18;
const PETAL_COUNT = 6;

export function startMagic(canvas) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = rect.width || 340;
    h = rect.height || 500;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();

  const sparkles = Array.from({ length: SPARKLE_COUNT }, () => newSparkle(w, h, true));
  const petals = Array.from({ length: PETAL_COUNT }, () => newPetal(w, h, true));

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);

    // Chispas en modo aditivo: brillan sobre fondo oscuro y resaltan sobre claro.
    ctx.globalCompositeOperation = 'lighter';
    for (const s of sparkles) {
      updateSparkle(s, dt, w, h);
      drawSparkle(ctx, s);
    }

    // Pétalos en modo normal: forma nítida sobre cualquier fondo.
    ctx.globalCompositeOperation = 'source-over';
    for (const p of petals) {
      updatePetal(p, dt, w, h);
      drawPetal(ctx, p);
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
  window.addEventListener('resize', resize);
}

// ── Chispas ───────────────────────────────────────────────────────────────
function newSparkle(w, h, initial) {
  return {
    x: Math.random() * w,
    y: initial ? Math.random() * h : h + 10,
    vx: (Math.random() - 0.5) * 6,
    vy: -8 - Math.random() * 14,
    phase: Math.random() * Math.PI * 2,
    freq: 1 + Math.random() * 2,
    r: 0.7 + Math.random() * 1.3,
    hue: 40 + Math.random() * 15, // dorado cálido
  };
}

function updateSparkle(s, dt, w, h) {
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.phase += s.freq * dt;
  s.vx += (Math.random() - 0.5) * 10 * dt; // zigzag leve, como humo caliente
  s.vx *= 0.985;
  if (s.y < -8 || s.x < -8 || s.x > w + 8) Object.assign(s, newSparkle(w, h, false));
}

function drawSparkle(ctx, s) {
  const t = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase));
  const r = s.r;
  const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 7);
  halo.addColorStop(0, `hsla(${s.hue}, 95%, 78%, ${t})`);
  halo.addColorStop(0.3, `hsla(${s.hue}, 95%, 60%, ${t * 0.4})`);
  halo.addColorStop(1, `hsla(${s.hue}, 95%, 60%, 0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r * 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsla(${s.hue}, 100%, 90%, ${t})`;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ── Pétalos ───────────────────────────────────────────────────────────────
function newPetal(w, h, initial) {
  return {
    x: Math.random() * w,
    y: initial ? Math.random() * h : -14,
    vx: (Math.random() - 0.5) * 10,
    vy: 12 + Math.random() * 16,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 1.8,
    sway: Math.random() * Math.PI * 2,
    swayF: 0.6 + Math.random() * 0.9,
    size: 3 + Math.random() * 3,
    hue: 20 + Math.random() * 30, // ámbar/dorado
    alpha: 0.4 + Math.random() * 0.35,
  };
}

function updatePetal(p, dt, w, h) {
  p.sway += p.swayF * dt;
  p.x += (p.vx + Math.sin(p.sway) * 15) * dt;
  p.y += p.vy * dt;
  p.rot += p.vrot * dt;
  if (p.y > h + 14) Object.assign(p, newPetal(w, h, false));
}

function drawPetal(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = `hsl(${p.hue}, 72%, 60%)`;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.size * 0.42, p.size, 0, 0, Math.PI * 2);
  ctx.fill();
  // Vena central tenue para que no parezca una pastilla
  ctx.strokeStyle = `hsla(${p.hue}, 60%, 38%, 0.5)`;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(0, -p.size * 0.9);
  ctx.lineTo(0, p.size * 0.9);
  ctx.stroke();
  ctx.restore();
}
