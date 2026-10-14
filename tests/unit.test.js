// Run: node tests/unit.test.js   (no dependencies)
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = ['puzzle', 'statistics', 'iddls'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.Puzzle=Puzzle;this.iddls=iddls;', ctx);
const { Puzzle, iddls } = ctx;
const G = Puzzle.DEFAULT_GOAL, I = Puzzle.DEFAULT_INIT;
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message); } };
const events = (a, b, m) => [...iddls(a, b, m)];
const last = ev => ev[ev.length - 1];
const validPath = (sol, goal) => sol.every((s, i) => i === 0 || Puzzle.moves(sol[i - 1]).some(m => Puzzle.key(m.state) === Puzzle.key(s))) && Puzzle.key(sol[sol.length - 1]) === Puzzle.key(goal);
// Independent reference counter: plain recursive DLS written separately from iddls.js
function reference(start, goal, maxD) {
  let gen = 0, exp = 0, iters = 0; const gk = Puzzle.key(goal);
  for (let L = 0; L <= maxD; L++) {
    iters++; gen++; const onPath = new Set([Puzzle.key(start)]);
    const rec = (s, d) => {
      if (Puzzle.key(s) === gk) return true; if (d === L) return false;
      exp++; const succ = Puzzle.moves(s).filter(m => !onPath.has(Puzzle.key(m.state))); gen += succ.length;
      for (const m of succ) { const k = Puzzle.key(m.state); onPath.add(k); if (rec(m.state, d + 1)) return true; onPath.delete(k); } return false;
    };
    if (rec(start, 0)) return { gen, exp, iters, depth: L };
  } return null;
}
// BFS used ONLY by the test to check optimal length (never by the app)
function bfsLen(a, b) { const gk = Puzzle.key(b); let fr = [a], seen = new Set([Puzzle.key(a)]), d = 0; while (fr.length) { if (fr.some(s => Puzzle.key(s) === gk)) return d; const nx = []; for (const s of fr) for (const m of Puzzle.moves(s)) { const k = Puzzle.key(m.state); if (!seen.has(k)) { seen.add(k); nx.push(m.state); } } fr = nx; d++; } return -1; }

t('solved: start equals goal -> 0 moves', () => { const d = last(events(G, G, 5)); assert(d.found && d.sol.length === 1 && d.moves.length === 0 && d.iters === 1); });
t('one move away -> depth 1', () => { const g = Puzzle.moves(I)[0].state, d = last(events(I, g, 5)); assert(d.found && d.sol.length - 1 === 1 && validPath(d.sol, g)); });
t('default puzzle: 5 moves, valid path, ends at goal', () => { const d = last(events(I, G, 20)); assert(d.found && d.sol.length - 1 === 5 && validPath(d.sol, G) && Puzzle.key(d.sol[0]) === Puzzle.key(I)); });
t('solution length equals BFS-optimal length (test-only BFS)', () => { for (let i = 0; i < 25; i++) { const s = Puzzle.random(G, 12), d = last(events(s, G, 20)); assert(d.found && d.sol.length - 1 === bfsLen(s, G), 'mismatch'); } });
t('depth limit starts at 0 and rises by exactly 1, each iteration restarts at initial state', () => {
  const ev = events(I, G, 20), starts = ev.filter(e => e.t === 'iter').map(e => e.limit);
  assert.deepStrictEqual(starts, [0, 1, 2, 3, 4, 5]);
  ev.forEach((e, i) => { if (e.t === 'iter') { const nx = ev[i + 1]; assert(nx.t === 'iterEnd' || (nx.t === 'expand' && nx.depth === 0 && Puzzle.key(nx.state) === Puzzle.key(I))); } });
});
t('no expansion exceeds its depth limit; paths never repeat a state', () => {
  for (const e of events(I, G, 20)) if (e.t === 'expand') { assert(e.depth < e.limit); assert(new Set(e.path.map(Puzzle.key)).size === e.path.length); assert(e.path.length === e.depth + 1); }
});
t('no successor repeats a state on the current path', () => { for (const e of events(I, G, 20)) if (e.t === 'expand') { const ks = new Set(e.path.map(Puzzle.key)); e.succ.forEach(s => assert(!ks.has(Puzzle.key(s)))); } });
t('depth limit too small -> not found, no optimality claim data', () => { const d = last(events(I, G, 3)); assert(d.found === false && d.limit === 3 && d.iters === 4); });
t('unsolvable pairs rejected by parity check', () => { assert(!Puzzle.solvable([1,2,3,4,5,6,8,7,0], [1,2,3,4,5,6,7,8,0])); assert(!Puzzle.solvable([2,1,3,4,5,6,7,8,0], [1,2,3,4,5,6,7,8,0])); });
t('solvable pairs accepted (both blank positions)', () => { assert(Puzzle.solvable(I, G)); assert(Puzzle.solvable(G, I)); assert(Puzzle.solvable([1,2,3,4,5,6,7,8,0], [0,1,2,3,4,5,6,7,8]) === bfsLen([1,2,3,4,5,6,7,8,0], [0,1,2,3,4,5,6,7,8]) >= 0); });
t('parity check agrees with exhaustive reachability on 60 random pairs', () => {
  const rnd = () => { const a = [0,1,2,3,4,5,6,7,8]; for (let i = 8; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  for (let i = 0; i < 60; i++) { const a = rnd(), b = rnd(); const reach = (() => { const bk = Puzzle.key(b), seen = new Set([Puzzle.key(a)]); let fr = [a]; while (fr.length) { const nx = []; for (const s of fr) { if (Puzzle.key(s) === bk) return true; for (const m of Puzzle.moves(s)) { const k = Puzzle.key(m.state); if (!seen.has(k)) { seen.add(k); nx.push(m.state); } } } fr = nx; } return false; })(); assert.strictEqual(Puzzle.solvable(a, b), reach); }
});
t('validation rejects duplicates, missing, out-of-range, NaN, wrong length', () => {
  assert(Puzzle.validate([1,1,3,4,5,6,7,8,0], 'x')); assert(Puzzle.validate([1,2,3,4,5,6,7,8,9], 'x')); assert(Puzzle.validate([1,2,3,4,5,6,7,8], 'x'));
  assert(Puzzle.validate([1,2,3,4,5,6,7,8,NaN], 'x')); assert(Puzzle.validate([0,0,3,4,5,6,7,8,1], 'x')); assert(Puzzle.validate(G, 'x') === null);
});
t('random generation: 3 difficulties x 300 puzzles solvable w.r.t. default AND a custom goal, and solved by IDDLS within scramble length', () => {
  const goals = [G, [1,2,3,4,5,6,7,8,0], [3,1,2,6,0,4,7,8,5]];
  for (const g of goals) for (const n of [6, 12, 16]) for (let i = 0; i < 100; i++) { const s = Puzzle.random(g, n); assert(Puzzle.validate(s, 's') === null && Puzzle.solvable(s, g)); if (i < 5) assert(last(events(s, g, n)).found); }
});
t('statistics match independent reference implementation', () => {
  for (const s of [I, Puzzle.random(G, 8), Puzzle.random(G, 10), Puzzle.random(G, 12)]) { const d = last(events(s, G, 20)), r = reference(s, G, 20); assert.deepStrictEqual([d.gen, d.exp, d.iters, d.sol.length - 1], [r.gen, r.exp, r.iters, r.depth]); }
});
t('per-iteration stats sum to totals; running counters never decrease', () => {
  const ev = events(I, G, 20), ends = ev.filter(e => e.t === 'iterEnd'), d = last(ev);
  assert.strictEqual(ends.reduce((a, e) => a + e.itGen, 0), d.gen); assert.strictEqual(ends.reduce((a, e) => a + e.itExp, 0), d.exp);
  let g = 0, x = 0; ev.forEach(e => { assert(e.gen >= g && e.exp >= x); g = e.gen; x = e.exp; });
  assert.strictEqual(d.exp, ev.filter(e => e.t === 'expand').length);
  assert.strictEqual(d.maxD, d.sol.length - 1); // max depth reached = solution depth for a successful final iteration
});
t('final iteration result is Goal Found; earlier ones are Cutoff', () => { const r = events(I, G, 20).filter(e => e.t === 'iterEnd').map(e => e.result); assert.strictEqual(r.pop(), 'Goal Found'); assert(r.every(x => x === 'Cutoff')); });
t('max depth 0 and unequal states -> not found after 1 iteration', () => { const d = last(events(I, G, 0)); assert(!d.found && d.iters === 1); });
t('performance: 16-move scrambles, 20 puzzles', () => { const t0 = Date.now(); for (let i = 0; i < 20; i++) assert(last(events(Puzzle.random(G, 16), G, 20)).found); console.log('   total ms:', Date.now() - t0); });
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
