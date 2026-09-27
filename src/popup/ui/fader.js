// Fader vertical bipolar para una banda del EQ (−12…+12 dB, 0 al centro).
export function createFader(host, { label, title = label, min, max, value, defaultValue = 0, onInput = () => {} }) {
  const root = document.createElement('div');
  root.className = 'fader';
  root.innerHTML = `
    <output class="fader__value"></output>
    <div class="fader__track" role="slider" tabindex="0" aria-label="${label} Hz"
         aria-valuemin="${min}" aria-valuemax="${max}" title="${title}">
      <span class="fader__zero"></span>
      <span class="fader__fill"></span>
      <span class="fader__cap"></span>
    </div>
    <span class="fader__label">${label}</span>`;

  const track = root.querySelector('.fader__track');
  const fill = root.querySelector('.fader__fill');
  const cap = root.querySelector('.fader__cap');
  const readout = root.querySelector('.fader__value');

  const toPct = (v) => ((max - v) / (max - min)) * 100;
  let current = value;

  function render() {
    const pos = toPct(current);
    const zero = toPct(0);
    cap.style.top = `${pos}%`;
    fill.style.top = `${Math.min(pos, zero)}%`;
    fill.style.height = `${Math.abs(pos - zero)}%`;
    readout.textContent = current > 0 ? `+${current}` : String(current);
    root.dataset.sign = Math.sign(current);
    track.setAttribute('aria-valuenow', current);
    track.setAttribute('aria-valuetext', `${current} dB`);
  }

  function commit(v) {
    const next = Math.round(Math.min(max, Math.max(min, v)));
    if (next === current) return;
    current = next;
    render();
    onInput(current);
  }

  const fromPointer = (e) => {
    const r = track.getBoundingClientRect();
    commit(max - ((e.clientY - r.top) / r.height) * (max - min));
  };

  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    track.setPointerCapture(e.pointerId);
    fromPointer(e);
  });
  track.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
  track.addEventListener('pointerup', () => { dragging = false; });
  track.addEventListener('pointercancel', () => { dragging = false; });
  track.addEventListener('wheel', (e) => {
    e.preventDefault();
    commit(current + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });
  track.addEventListener('dblclick', () => commit(defaultValue));
  track.addEventListener('keydown', (e) => {
    const keys = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 6, PageDown: -6 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    commit(current + keys[e.key]);
  });

  render();
  host.append(root);

  return {
    set(v) { current = v; render(); },
  };
}
