// Run: npm i -D playwright && npx playwright install chromium && node tests/e2e.test.js
// Bootstrap CDN requests are blocked on purpose: the app logic must not depend on them.
const { chromium } = require('playwright'), path = require('path'), assert = require('assert');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
let pass = 0, fail = 0; const results = [];
const t = async (name, fn) => { try { await fn(); pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } };
(async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text()) && errors.push(m.text()));
  page.on('requestfailed', r => { if (!/cdn\.jsdelivr/.test(r.url())) failed.push(r.url()); });
  await page.route('**/cdn.jsdelivr.net/**', r => r.abort());
  await page.goto(URL);
  const setGrid = (cls, s) => page.evaluate(([c, s]) => document.querySelectorAll('.' + c).forEach((i, k) => i.value = s[k] === 0 ? '' : String(s[k])), [cls, s]);
  const board = id => page.evaluate(id => { const b = document.getElementById(id), s = Array(9).fill(-1); for (const [n, t] of Object.entries(b.tiles)) { const m = t.style.transform.match(/translate\(([\d.]+)%,\s*([\d.]+)%\)/); s[Math.round(m[2] / 100) * 3 + Math.round(m[1] / 100)] = Number(n); } return s; }, id);
  const speed = v => page.selectOption('#speed', v);
  const doneWait = () => page.waitForFunction(() => cur() && cur().t === 'done' && !playing, null, { timeout: 60000 });
  const reset = async () => { await page.click('#bReset'); };
  const setup = async (a, g, md = 20) => { await reset(); await setGrid('gi', a); await setGrid('gg', g); await page.fill('#maxDepth', String(md)); await reset(); }; // inputs lock while a search exists, so Reset first
  const G = [1,2,3,8,0,4,7,6,5], I = [2,8,3,1,6,4,7,0,5];
  const summary = () => page.innerText('#summary');
  const msg = async () => (await page.isHidden('#msg')) ? '' : page.innerText('#msg');

  await t('page loads: no JS errors, all local css/js paths resolve, name + reg number shown', async () => {
    assert.deepStrictEqual(errors, []); assert.deepStrictEqual(failed, []);
    const txt = await page.innerText('body'); assert(txt.includes('Maha Vignesh Shree') && txt.includes('24BCE2736') && txt.includes('IDDLS'));
    assert.strictEqual(await page.evaluate(() => [...document.styleSheets].some(s => s.href && s.href.endsWith('css/style.css'))), true);
    assert.strictEqual(await page.evaluate(() => typeof iddls + typeof Puzzle + typeof Viz + typeof Stats), 'functionobjectobjectobject');
  });
  await t('default puzzle shown on all three boards at load', async () => { assert.deepStrictEqual(await board('bInit'), I); assert.deepStrictEqual(await board('bGoal'), G); assert.deepStrictEqual(await board('bCur'), I); });

  await speed('0');
  await t('case: initial equals goal -> 0 moves', async () => { await setup(G, G); await page.click('#bRun'); await doneWait(); const s = await summary(); assert(/Solution Found/.test(s) && /Moves in solution\s*0/.test(s)); });
  await t('case: one move away -> depth 1', async () => { const g = await page.evaluate(([i]) => Puzzle.moves(i)[0].state, [I]); await setup(I, g); await page.click('#bRun'); await doneWait(); assert(/Moves in solution\s*1/.test(await summary())); assert.deepStrictEqual(await board('bCur'), g); });
  await t('case: multi-move default -> 5 moves, ends on goal board', async () => { await setup(I, G); await page.click('#bRun'); await doneWait(); assert(/Moves in solution\s*5/.test(await summary())); assert.deepStrictEqual(await board('bCur'), G); });
  await t('case: unsolvable rejected before search', async () => { await setup([1,2,3,4,5,6,8,7,0], [1,2,3,4,5,6,7,8,0]); await page.click('#bRun'); assert(/Unsolvable/.test(await msg())); assert.strictEqual(await page.evaluate(() => events.length + (gen ? 1 : 0)), 0); });
  await t('case: invalid inputs rejected with clear messages', async () => {
    for (const [a, re] of [[[1,1,3,4,5,6,7,8,0], /duplicate|missing/], [[1,2,3,4,5,6,7,8,9], /duplicate|missing|0 to 8/], [[1,2,3,4,5,6,7,8,'x'], /0 to 8/]]) { await setGrid('gi', a.map(v => v === 'x' ? 0 : v)); if (a.includes('x')) await page.evaluate(() => document.querySelectorAll('.gi')[8].value = 'x'); await setGrid('gg', G); await page.click('#bReset'); await page.click('#bRun'); assert(re.test(await msg()), JSON.stringify(a) + ' -> ' + await msg()); assert.strictEqual(await page.evaluate(() => events.length), 0); }
  });
  await t('case: depth limit too small -> accurate not-found message, no optimality claim', async () => { await setup(I, G, 3); await page.click('#bRun'); await doneWait(); const s = await summary(); assert(/Not Found within depth limit 3/.test(s) && /No optimality claim/.test(s) && /Iterations completed\s*4/.test(s)); });
  await t('case: invalid max depth rejected', async () => { await setup(I, G); await page.fill('#maxDepth', '99'); await page.click('#bRun'); assert(/Maximum depth/.test(await msg())); await page.fill('#maxDepth', '2.5'); await page.click('#bRun'); assert(/Maximum depth/.test(await msg())); assert.strictEqual(await page.evaluate(() => events.length), 0); });

  await t('random generation via button: solvable for default and custom goals, all difficulties', async () => {
    for (const goal of [G, [1,2,3,4,5,6,7,8,0], [3,1,2,6,0,4,7,8,5]]) for (const d of ['6', '12', '16']) { await setGrid('gg', goal); await page.selectOption('#diff', d); for (let i = 0; i < 25; i++) { await page.click('#random'); const ok = await page.evaluate(([g]) => { const a = readGrid('gi'); return Puzzle.validate(a, 'x') === null && Puzzle.solvable(a, g); }, [goal]); assert(ok, 'unsolvable random puzzle'); } }
    await setGrid('gg', G); await page.selectOption('#diff', '12'); await page.click('#random'); await page.fill('#maxDepth', '20'); await speed('0'); await page.click('#bRun'); await doneWait(); assert(/Solution Found/.test(await summary()));
  });

  await t('animation: Next/Previous walk the real solution; board matches path; moved tile highlighted correctly', async () => {
    await setup(I, G); await page.click('#bRun'); await doneWait();
    const sol = await page.evaluate(() => cur().sol); assert.strictEqual(sol.length, 6);
    for (let i = 5; i >= 0; i--) { assert.deepStrictEqual(await board('bCur'), sol[i]); if (i) { const mv = await page.evaluate(() => [...document.querySelectorAll('#bCur .tile.moved')].map(t => Number(t.textContent))); const tile = sol[i - 1][sol[i].indexOf(0)]; assert.deepStrictEqual(mv, [tile]); await page.click('#bPrev'); } }
    assert.deepStrictEqual(await board('bCur'), sol[0]);
    for (let i = 1; i <= 5; i++) { await page.click('#bNext'); assert.deepStrictEqual(await board('bCur'), sol[i]); }
    assert(/Step 5/.test(await page.innerText('#sStep')));
    assert.strictEqual(await page.evaluate(() => events.filter(e => e.t === 'done').length), 1);
  });
  await t('stats consistency: summary, table and live counters agree with event log', async () => {
    await setup(I, G); await page.click('#bRun'); await doneWait();
    const r = await page.evaluate(() => { const d = cur(), rows = [...document.querySelectorAll('#iterBody tr')].map(tr => [...tr.children].map(c => c.textContent)); return { d: { gen: d.gen, exp: d.exp, iters: d.iters }, rows, live: [$('sGen').textContent, $('sExp').textContent] }; });
    assert.strictEqual(r.rows.length, r.d.iters); assert.strictEqual(r.rows.reduce((a, x) => a + Number(x[2]), 0), r.d.gen); assert.strictEqual(r.rows.reduce((a, x) => a + Number(x[3]), 0), r.d.exp);
    assert.deepStrictEqual(r.rows.map(x => x[1]), r.rows.map((_, i) => String(i))); assert.strictEqual(r.rows.at(-1)[4], 'Goal Found'); assert(r.rows.slice(0, -1).every(x => x[4] === 'Cutoff'));
    assert.deepStrictEqual(r.live, [String(r.d.gen), String(r.d.exp)]);
    const s = await summary(); assert(s.includes('Nodes generated\n' + r.d.gen) && s.includes('Nodes expanded\n' + r.d.exp));
  });

  await t('controls: Run/Pause/Resume/Next/Prev/Reset/Speed with correct enabled states', async () => {
    await speed('80'); await setup(I, G);
    const dis = ids => page.evaluate(ids => ids.map(i => document.getElementById(i).disabled), ids); const ids = ['bRun', 'bPause', 'bResume', 'bNext', 'bPrev'];
    assert.deepStrictEqual(await dis(ids), [false, true, true, true, true]);
    await page.click('#bRun'); assert.deepStrictEqual(await dis(ids), [true, false, true, true, true]);
    await page.waitForFunction(() => events.length > 8); await page.click('#bPause');
    assert.deepStrictEqual(await dis(ids), [true, true, false, false, false]);
    const n1 = await page.evaluate(() => [events.length, idx]); await page.waitForTimeout(500); assert.deepStrictEqual(await page.evaluate(() => [events.length, idx]), n1, 'search advanced while paused');
    await page.click('#bNext'); assert.deepStrictEqual(await page.evaluate(() => [events.length, idx]), [n1[0] + 1, n1[1] + 1], 'Next must add exactly one event');
    const snap = await page.evaluate(() => ({ st: cur().state, i: idx })); await page.click('#bPrev'); assert.strictEqual(await page.evaluate(() => idx), snap.i - 1);
    const prevEv = await page.evaluate(() => cur()); if (prevEv.state) assert.deepStrictEqual(await board('bCur'), prevEv.state);
    await page.click('#bNext'); assert.deepStrictEqual(await page.evaluate(() => idx), snap.i);
    await page.click('#bResume'); await page.waitForTimeout(400); assert((await page.evaluate(() => events.length)) > n1[0] + 1, 'resume did not continue');
    const seqOk = await page.evaluate(() => events.every((e, i) => i === 0 || e.gen >= events[i - 1].gen)); assert(seqOk);
    await speed('0'); await doneWait(); assert(/Moves in solution\s*5/.test(await summary()), 'pause/resume changed the result');
    assert.deepStrictEqual(await page.evaluate(() => { const e = events.filter(x => x.t === 'iterEnd'); return e.map(x => x.limit); }), [0, 1, 2, 3, 4, 5], 'iterations duplicated or skipped');
  });
  await t('speed change mid-run takes effect; double Run click does not start two searches', async () => {
    await speed('800'); await setup(I, G); await page.click('#bRun'); await page.click('#bRun', { force: true }).catch(() => {}); await page.waitForTimeout(1700);
    const slow = await page.evaluate(() => events.length); assert(slow <= 4, 'slow speed too fast: ' + slow); await speed('0'); await page.waitForTimeout(400);
    assert((await page.evaluate(() => events.length)) > slow + 5); await doneWait(); assert(/Moves in solution\s*5/.test(await summary()));
    assert.strictEqual(await page.evaluate(() => events.filter(e => e.t === 'iter').length), 6);
  });
  await t('Reset mid-run stops everything and restores configured puzzle; Resume stays disabled; rerun works', async () => {
    await speed('80'); await setup(I, G); await page.click('#bRun'); await page.waitForFunction(() => events.length > 5); await page.click('#bReset');
    const st = await page.evaluate(() => ({ ev: events.length, idx, playing, g: !!gen, rows: document.querySelectorAll('#iterBody tr').length, sum: !document.getElementById('summaryCard').hidden, rs: document.getElementById('bResume').disabled, run: document.getElementById('bRun').disabled }));
    assert.deepStrictEqual(st, { ev: 0, idx: -1, playing: false, g: false, rows: 0, sum: false, rs: true, run: false }); assert.deepStrictEqual(await board('bCur'), I);
    await page.waitForTimeout(300); assert.strictEqual(await page.evaluate(() => events.length), 0, 'search kept running after reset');
    await speed('0'); await page.click('#bRun'); await doneWait(); assert(/Moves in solution\s*5/.test(await summary()));
  });
  await t('swap and reset-puzzle buttons', async () => { await setup(I, G); await page.click('#swap'); assert.deepStrictEqual(await board('bInit'), G); assert.deepStrictEqual(await board('bGoal'), I); await page.click('#defaults'); assert.deepStrictEqual(await board('bInit'), I); });
  await t('responsiveness: UI thread stays responsive during an Instant 16-move search', async () => {
    await speed('0'); await page.evaluate(() => { writeGrid('gg', Puzzle.DEFAULT_GOAL); writeGrid('gi', Puzzle.random(Puzzle.DEFAULT_GOAL, 16)); }); await reset();
    await page.evaluate(() => { window.__gap = 0; let l = performance.now(); window.__i = setInterval(() => { const n = performance.now(); window.__gap = Math.max(window.__gap, n - l); l = n; }, 20); });
    const t0 = Date.now(); await page.click('#bRun'); await doneWait(); const gap = await page.evaluate(() => window.__gap); console.log('   solved in', Date.now() - t0, 'ms; worst UI stall', Math.round(gap), 'ms');
    assert(gap < 1000, 'UI stalled ' + gap);
  });
  await t('safety: deep search stays pausable/resettable and memory-bounded', async () => {
    await speed('0'); await page.evaluate(() => { writeGrid('gi', [8,6,7,2,5,4,3,0,1]); writeGrid('gg', [1,2,3,4,5,6,7,8,0]); }); await reset(); await page.fill('#maxDepth', '40'); await reset(); await page.click('#bRun'); await page.waitForTimeout(16000);
    const n = await page.evaluate(() => events.length), dr = await page.evaluate(() => dropped); console.log('   events held after 16s:', n, '| history trimmed:', dr); assert(n <= 60000 && dr, 'event history not capped: ' + n);
    assert(!(await page.isHidden('#msg')), 'cap notice not shown');
    const t0 = Date.now(); await page.click('#bPause'); assert(Date.now() - t0 < 1500); const a = await page.evaluate(() => events.length); await page.waitForTimeout(400); assert.strictEqual(await page.evaluate(() => events.length), a);
    const i0 = await page.evaluate(() => idx); await page.click('#bPrev'); assert.strictEqual(await page.evaluate(() => idx), i0 - 1, 'Previous broken after history trim');
    await reset(); assert.strictEqual(await page.evaluate(() => events.length), 0);
  });
  await t('no JS errors during the whole session', async () => assert.deepStrictEqual(errors, []));
  await page.setViewportSize({ width: 375, height: 800 }); await page.reload();
  await t('mobile viewport: no horizontal overflow', async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)));
  await browser.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
