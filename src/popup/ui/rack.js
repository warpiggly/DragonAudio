// Tornillos Phillips en las orejas de cada unidad de rack.
// Cada tornillo queda girado distinto, como apretado a mano.
const CORNERS = ['tl', 'tr', 'bl', 'br'];

export function addScrews(cards) {
  cards.forEach((card) => {
    CORNERS.forEach((corner) => {
      const screw = document.createElement('span');
      screw.className = `screw screw--${corner}`;
      screw.style.setProperty('--rot', `${Math.round(Math.random() * 90)}deg`);
      screw.setAttribute('aria-hidden', 'true');
      card.append(screw);
    });
  });
}
