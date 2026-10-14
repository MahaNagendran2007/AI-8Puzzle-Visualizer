const Viz = {
  build(el) { el.innerHTML = ''; el.tiles = {}; for (let n = 0; n < 9; n++) { const d = document.createElement('div'); d.className = 'tile' + (n ? '' : ' blank'); d.textContent = n || ''; el.appendChild(d); el.tiles[n] = d; } },
  draw(el, s, moved) {
    if (!el.tiles) this.build(el);
    s.forEach((v, i) => { const t = el.tiles[v]; t.style.transform = `translate(${(i % 3) * 100}%, ${Math.floor(i / 3) * 100}%)`; t.classList.toggle('moved', v === moved && v !== 0); });
  },
  mini: s => s.map((v, i) => (v || '_') + ((i % 3 === 2 && i < 8) ? ' / ' : ' ')).join('').trim()
};
