// Iterative Deepening Depth-Limited Search as generators, so the UI can step and pause it.
function* iddls(start, goal, maxDepth) {
  const goalKey = Puzzle.key(goal), tot = { gen: 0, exp: 0, maxD: 0, iters: 0 };
  let it, peak = 0;
  const path = [{ state: start, tile: null, dir: null }], onPath = new Set();

  function* dls(node, depth, limit) {
    const k = Puzzle.key(node.state);
    tot.maxD = Math.max(tot.maxD, depth); peak = Math.max(peak, path.length);
    if (k === goalKey) return 'goal';
    if (depth === limit) return 'cutoff';
    tot.exp++; it.exp++;
    const succ = Puzzle.moves(node.state).filter(m => !onPath.has(Puzzle.key(m.state))); // cycles checked on current path only
    tot.gen += succ.length; it.gen += succ.length;
    yield { t: 'expand', limit, depth, state: node.state, parent: path.length > 1 ? path[path.length - 2].state : null,
            succ: succ.map(m => m.state), path: path.map(p => p.state), gen: tot.gen, exp: tot.exp, maxD: tot.maxD };
    let cut = false;
    for (const m of succ) {
      const mk = Puzzle.key(m.state);
      onPath.add(mk); path.push(m);
      const r = yield* dls(m, depth + 1, limit);
      if (r === 'goal') return 'goal';       // keep path intact: it is the solution
      path.pop(); onPath.delete(mk);
      if (r === 'cutoff') cut = true;
    }
    return cut ? 'cutoff' : 'failure';
  }

  for (let limit = 0; limit <= maxDepth; limit++) {
    onPath.clear(); onPath.add(Puzzle.key(start)); path.length = 1;   // every iteration restarts at the initial state
    it = { gen: 1, exp: 0 }; tot.gen++; tot.iters++;                   // root counts as generated
    yield { t: 'iter', limit, gen: tot.gen, exp: tot.exp, maxD: tot.maxD };
    const r = yield* dls(path[0], 0, limit);
    yield { t: 'iterEnd', limit, result: r === 'goal' ? 'Goal Found' : r === 'cutoff' ? 'Cutoff' : 'Failure', itGen: it.gen, itExp: it.exp, gen: tot.gen, exp: tot.exp, maxD: tot.maxD };
    if (r === 'goal') return yield { t: 'done', found: true, sol: path.map(p => p.state), moves: path.slice(1).map(p => `Tile ${p.tile} slides into the blank (blank moves ${p.dir})`), gen: tot.gen, exp: tot.exp, maxD: tot.maxD, iters: tot.iters, peak };
    if (r === 'failure') break; // whole space exhausted without a cutoff
  }
  return yield { t: 'done', found: false, gen: tot.gen, exp: tot.exp, maxD: tot.maxD, iters: tot.iters, peak, limit: maxDepth };
}
