const $ = id => document.getElementById(id);
const CAP = 60000, DROP = 20000; // bounded event history
let rows = [], seq = 0, dropped = false, gen = null, events = [], idx = -1, timer = null, playing = false, solIdx = 0, tGen = 0, goalS, initS;
const cur = () => events[idx];
const readGrid = p => [...document.querySelectorAll(`.${p}`)].map(i => i.value.trim() === '' ? 0 : Number(i.value));
const writeGrid = (p, s) => document.querySelectorAll(`.${p}`).forEach((i, k) => i.value = s[k] || '');
function msg(t, info) { $('msg').className = 'alert py-2 alert-' + (info ? 'info' : 'danger'); $('msg').textContent = t; $('msg').hidden = !t; }

function configured() {
  const a = readGrid('gi'), b = readGrid('gg');
  const e = Puzzle.validate(a, 'Initial state') || Puzzle.validate(b, 'Goal state') || (!Puzzle.solvable(a, b) && 'Unsolvable: the initial and goal states have different inversion parity.');
  if (e) { msg(e); return null; } msg(''); return { a, b };
}
function applyBoards() { const c = configured(); if (!c) return false; initS = c.a; goalS = c.b; Viz.draw($('bInit'), initS); Viz.draw($('bGoal'), goalS); Viz.draw($('bCur'), initS); return true; }

function pull() {   // advance the generator by one event; only generator time counts as execution time
  if (!gen) return false;
  const t = performance.now(), r = gen.next(); tGen += performance.now() - t;
  if (r.done) { gen = null; return false; }
  r.value.ms = tGen; r.value.seq = seq++;
  if (r.value.t === 'iterEnd') rows.push(r.value);
  events.push(r.value);
  if (events.length > CAP) { events.splice(0, DROP); idx -= DROP; dropped = true; } // idx always sits on the last event when pulling
  return true;
}
function step(render = true) {
  const e = cur();
  if (e && e.t === 'done') { if (e.found && solIdx < e.sol.length - 1) { solIdx++; if (render) show(e); return true; } return false; }
  if (idx < events.length - 1) idx++; else if (pull()) idx++; else return false;
  if (render || cur().t === 'done') show(cur()); // the final event is always rendered
  return true;
}
function back() {
  const e = cur(); if (!e) return;
  if (e.t === 'done' && solIdx > 0) { solIdx--; show(e); return; }
  if (idx > 0) { idx--; solIdx = 0; show(cur()); }
}
function show(e) {
  const set = (id, v) => $(id).textContent = v;
  set('sIter', e.limit !== undefined ? e.limit + 1 : '-'); set('sLimit', e.limit ?? '-');
  set('sGen', e.gen); set('sExp', e.exp); set('sTime', Stats.fmtMs(e.ms));
  const shown = rows.filter(x => x.seq <= e.seq);
  $('iterBody').innerHTML = shown.map(r => `<tr><td>${r.limit + 1}</td><td>${r.limit}</td><td>${r.itGen}</td><td>${r.itExp}</td><td>${r.result}</td><td>${Stats.fmtMs(r.ms)}</td></tr>`).join('');
  $('summaryCard').hidden = e.t !== 'done';
  if (dropped) msg('Event history is capped: the oldest search events were discarded, so Previous cannot go back that far. The search itself is unaffected.', true);
  if (e.t === 'expand') {
    set('sDepth', e.depth); set('sNode', Viz.mini(e.state)); set('sParent', e.parent ? Viz.mini(e.parent) : 'none (root)');
    set('sSucc', e.succ.length ? e.succ.map(Viz.mini).join('  |  ') : 'none (all on current path)');
    set('sPath', e.path.map(Viz.mini).join('  ->  ')); set('sRes', 'Searching'); set('sStep', '-');
    Viz.draw($('bCur'), e.state);
  } else if (e.t === 'iter') { set('sRes', 'Iteration started'); set('sNode', '-'); set('sPath', Viz.mini(initS)); Viz.draw($('bCur'), initS); }
  else if (e.t === 'iterEnd') set('sRes', e.result);
  else if (e.t === 'done') {
    set('sRes', e.found ? 'Goal Found' : 'Not found within limit');
    if (e.found) Viz.draw($('bCur'), e.sol[solIdx], solIdx ? e.sol[solIdx - 1][e.sol[solIdx].indexOf(0)] : null);
    set('sStep', e.found ? `Step ${solIdx}: ${solIdx ? e.moves[solIdx - 1] : 'Initial state'}` : e.found === false ? `No solution within depth limit ${e.limit}` : '-');
    $('solList').innerHTML = e.found ? e.sol.map((s, i) => `<li class="${i === solIdx ? 'fw-bold text-info' : ''}" value="${i}">${i ? e.moves[i - 1] : 'Initial state'} <span class="text-secondary">${Viz.mini(s)}</span></li>`).join('') : '';
    $('summary').innerHTML = [
      ['Status', e.found ? 'Solution Found' : `Not Found within depth limit ${e.limit}`],
      ['Moves in solution', e.found ? e.sol.length - 1 : '-'], ['Final solution depth', e.found ? e.sol.length - 1 : '-'],
      ['Nodes generated', e.gen], ['Nodes expanded', e.exp], ['Max depth reached', e.maxD], ['Iterations completed', e.iters],
      ['Execution time', Stats.fmtMs(e.ms)], ['Memory', Stats.memoryEstimate(e.peak)],
      ['Optimality', e.found ? 'Optimal: every shallower limit was fully searched without finding the goal (unit-cost moves).' : 'No optimality claim: the search stopped at the configured limit, so a deeper solution may exist.']
    ].map(([k, v]) => `<div class="col-md-6"><div class="stat"><span>${k}</span><b>${v}</b></div></div>`).join('');
  }
  ctrl();
}
function ctrl() {
  const started = events.length > 0 || gen, fin = cur() && cur().t === 'done';
  document.querySelectorAll('.gi, .gg, #maxDepth').forEach(i => i.disabled = !!started); // no edits mid-search; use Reset
  $('bRun').disabled = playing || started; $('bPause').disabled = !playing; $('bResume').disabled = playing || !started || fin;
  $('bNext').disabled = playing || !started; $('bPrev').disabled = playing || (idx < 1 && solIdx < 1);
}
function tick() {
  let speed = Number($('speed').value), n = speed === 0 ? 300 : 1;
  if (cur() && cur().t === 'done') { n = 1; speed = Math.max(speed, 300); } // always animate solution moves visibly
  while (n-- > 0) { if (!step(n === 0)) { stop(); return; } if (cur().t === 'done') break; }  // Instant mode renders only the last event of each batch
  timer = setTimeout(tick, speed);
}
function stop() { playing = false; clearTimeout(timer); ctrl(); }
function start() { playing = true; ctrl(); tick(); }
function reset() {
  stop(); gen = null; events = []; rows = []; seq = 0; dropped = false; idx = -1; solIdx = 0; tGen = 0; msg('');
  $('iterBody').innerHTML = ''; $('solList').innerHTML = ''; $('summaryCard').hidden = true; $('sStep').textContent = '-';
  ['sIter','sLimit','sDepth','sNode','sParent','sSucc','sPath','sRes'].forEach(i => $(i).textContent = '-');
  ['sGen','sExp'].forEach(i => $(i).textContent = 0); $('sTime').textContent = '0 ms';
  applyBoards(); ctrl();
}
function run() {
  if (!applyBoards()) return;
  const md = Number($('maxDepth').value); if (!(Number.isInteger(md) && md >= 0 && md <= 40)) return msg('Maximum depth must be between 0 and 40.');
  gen = iddls(initS, goalS, md); start();
}
document.addEventListener('DOMContentLoaded', () => {
  [['gi', 'gridInit'], ['gg', 'gridGoal']].forEach(([p, id]) => { for (let i = 0; i < 9; i++) $(id).insertAdjacentHTML('beforeend', `<input class="form-control text-center ${p}" maxlength="1" inputmode="numeric" aria-label="cell ${i + 1}">`); });
  writeGrid('gi', Puzzle.DEFAULT_INIT); writeGrid('gg', Puzzle.DEFAULT_GOAL);
  ['bInit', 'bGoal', 'bCur'].forEach(i => Viz.build($(i)));
  $('bRun').onclick = run; $('bPause').onclick = stop; $('bResume').onclick = start;
  $('speed').onchange = () => { if (playing) { clearTimeout(timer); tick(); } }; // new speed applies immediately
  $('bNext').onclick = () => step(); $('bPrev').onclick = back; $('bReset').onclick = reset;
  $('applyInit').onclick = $('applyGoal').onclick = reset;
  $('swap').onclick = () => { const a = readGrid('gi'), b = readGrid('gg'); writeGrid('gi', b); writeGrid('gg', a); reset(); };
  $('defaults').onclick = () => { writeGrid('gi', Puzzle.DEFAULT_INIT); writeGrid('gg', Puzzle.DEFAULT_GOAL); reset(); };
  $('random').onclick = () => {
    const g = readGrid('gg'), e = Puzzle.validate(g, 'Goal state'); if (e) return msg(e);
    writeGrid('gi', Puzzle.random(g, Number($('diff').value))); reset();
  };
  reset();
});
