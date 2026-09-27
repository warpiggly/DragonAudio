// Perilla SVG de 270° (estilo Dragon Audio web).
// Arrastre vertical, rueda, flechas del teclado, doble clic = valor por defecto.
const A0 = -135;
const A1 = 135;
const DRAG_PX = 180;
const NS = 'http://www.w3.org/2000/svg';

const clamp01 = (t) => Math.min(1, Math.max(0, t));

function polar(c, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
}

function arcPath(c, r, from, to) {
  if (Math.abs(to - from) < 0.5) return '';
  const [a, b] = from < to ? [from, to] : [to, from];
  const [x0, y0] = polar(c, r, a);
  const [x1, y1] = polar(c, r, b);
  return `M${x0} ${y0} A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

export function createKnob(host, opts) {
  const {
    label, title = label, min, max, step = 1, value, defaultValue = 0, size = 40,
    format = String, readout: readoutHtml = null, bipolar = false, center = false, ticks = [],
    toTravel = (v) => (v - min) / (max - min),
    fromTravel = (t) => min + t * (max - min),
    zoneOf = null, wheelStep = step, onInput = () => {},
  } = opts;

  const decimals = (String(step).split('.')[1] || '').length;
  const snap = (v) => {
    const s = min + Math.round((Math.min(max, Math.max(min, v)) - min) / step) * step;
    return parseFloat(s.toFixed(decimals));
  };
  const angleOf = (v) => A0 + clamp01(toTravel(v)) * (A1 - A0);

  const c = size / 2;
  const ring = size / 2 - (center ? 5 : 3);
  const bodyR = center ? ring - 11 : ring - 6;

  const root = document.createElement('div');
  root.className = `knob${center ? ' knob--center' : ''}`;
  root.innerHTML = `
    <div class="knob__dial" role="slider" tabindex="0" aria-label="${label}"
         aria-valuemin="${min}" aria-valuemax="${max}" title="${title}"></div>
    ${center ? '' : `<span class="knob__label">${label}</span><output class="knob__value"></output>`}`;
  const dial = root.querySelector('.knob__dial');

  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, 'aria-hidden': 'true' });
  svg.append(svgEl('circle', { class: 'knob__body', cx: c, cy: c, r: bodyR }));
  svg.append(svgEl('circle', { class: 'knob__rim', cx: c, cy: c, r: bodyR }));
  ticks.forEach((tv) => {
    const a = angleOf(tv);
    const [x0, y0] = polar(c, ring + 2.5, a);
    const [x1, y1] = polar(c, ring + 5, a);
    svg.append(svgEl('line', { class: 'knob__tick', x1: x0, y1: y0, x2: x1, y2: y1 }));
  });
  svg.append(svgEl('path', { class: 'knob__track', d: arcPath(c, ring, A0, A1) }));
  const valueArc = svgEl('path', { class: 'knob__arc' });
  svg.append(valueArc);
  const needle = center ? null : svgEl('line', { class: 'knob__needle' });
  if (needle) svg.append(needle);
  dial.append(svg);

  let readout = root.querySelector('.knob__value');
  if (center) {
    readout = document.createElement('div');
    readout.className = 'knob__readout';
    dial.append(readout);
  }

  let current = snap(value);
  const origin = bipolar ? angleOf(0) : A0;

  function render() {
    const a = angleOf(current);
    valueArc.setAttribute('d', arcPath(c, ring, origin, a));
    if (needle) {
      const [x0, y0] = polar(c, bodyR * 0.25, a);
      const [x1, y1] = polar(c, bodyR * 0.85, a);
      Object.entries({ x1: x0, y1: y0, x2: x1, y2: y1 }).forEach(([k, v]) => needle.setAttribute(k, v));
    }
    dial.setAttribute('aria-valuenow', current);
    dial.setAttribute('aria-valuetext', format(current));
    if (center) readout.innerHTML = (readoutHtml ?? format)(current);
    else readout.textContent = format(current);
    if (zoneOf) root.dataset.zone = zoneOf(current);
  }

  function commit(v) {
    const next = snap(v);
    if (next === current) return;
    current = next;
    render();
    onInput(current);
  }

  let drag = null;
  dial.addEventListener('pointerdown', (e) => {
    if (root.classList.contains('is-disabled')) return;
    drag = { y: e.clientY, t: clamp01(toTravel(current)) };
    dial.setPointerCapture(e.pointerId);
    root.classList.add('is-dragging');
  });
  dial.addEventListener('pointermove', (e) => {
    if (!drag) return;
    commit(fromTravel(clamp01(drag.t + (drag.y - e.clientY) / DRAG_PX)));
  });
  const endDrag = () => { drag = null; root.classList.remove('is-dragging'); };
  dial.addEventListener('pointerup', endDrag);
  dial.addEventListener('pointercancel', endDrag);
  dial.addEventListener('wheel', (e) => {
    e.preventDefault();
    commit(current + (e.deltaY < 0 ? wheelStep : -wheelStep));
  }, { passive: false });
  dial.addEventListener('dblclick', () => commit(defaultValue));
  dial.addEventListener('keydown', (e) => {
    const keys = { ArrowUp: wheelStep, ArrowRight: wheelStep, ArrowDown: -wheelStep, ArrowLeft: -wheelStep,
      PageUp: wheelStep * 10, PageDown: -wheelStep * 10 };
    if (e.key in keys) commit(current + keys[e.key]);
    else if (e.key === 'Home') commit(min);
    else if (e.key === 'End') commit(max);
    else return;
    e.preventDefault();
  });

  render();
  host.append(root);

  return {
    set(v) { current = snap(v); render(); },
    get value() { return current; },
    setDisabled(off) { root.classList.toggle('is-disabled', off); },
  };
}
