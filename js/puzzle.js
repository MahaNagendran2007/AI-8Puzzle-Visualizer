const Puzzle = {
  DEFAULT_INIT: [2,8,3,1,6,4,7,0,5], DEFAULT_GOAL: [1,2,3,8,0,4,7,6,5],
  key: s => s.join(''),
  validate(s, name) {
    if (s.length !== 9 || s.some(v => !Number.isInteger(v) || v < 0 || v > 8)) return `${name}: every cell must be a number from 0 to 8 (0 = blank).`;
    const missing = [0,1,2,3,4,5,6,7,8].filter(n => !s.includes(n));
    if (missing.length) return `${name}: duplicate or missing tiles (missing ${missing.join(', ')}).`;
    return null;
  },
  inversions(s) { const t = s.filter(v => v); let c = 0; for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (t[i] > t[j]) c++; return c; },
  // Compare parity of the permutation that maps the initial tile order to the goal tile order
  solvable(a, b) {
    const pos = {}; b.filter(v => v).forEach((v, i) => pos[v] = i + 1);
    return this.inversions(a.filter(v => v).map(v => pos[v])) % 2 === 0;
  },
  DIRS: [[-1,0,'Up'],[1,0,'Down'],[0,-1,'Left'],[0,1,'Right']],
  moves(s) {
    const z = s.indexOf(0), r = Math.floor(z / 3), c = z % 3, out = [];
    for (const [dr, dc, name] of this.DIRS) {
      const nr = r + dr, nc = c + dc; if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
      const n = s.slice(), j = nr * 3 + nc; n[z] = n[j]; n[j] = 0;
      out.push({ state: n, tile: s[j], dir: name });
    }
    return out;
  },
  random(goal, steps) {
    let cur = goal.slice(), prev = '';
    for (let i = 0; i < steps; i++) {
      const opts = this.moves(cur).filter(m => this.key(m.state) !== prev);
      prev = this.key(cur); cur = opts[Math.floor(Math.random() * opts.length)].state;
    }
    return cur;
  }
};
