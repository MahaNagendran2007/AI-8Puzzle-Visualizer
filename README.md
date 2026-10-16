# AI-8Puzzle-Visualizer

Interactive 8-Puzzle solver that uses **Iterative Deepening Depth-Limited Search (IDDLS)** and visualises every iteration, depth limit, node expansion and the final solution path. It is a static website (HTML5, CSS3, JavaScript ES6, Bootstrap 5) with no backend, no API key and no build step.

| | |
|---|---|
| Student | Maha Vignesh Shree |
| Registration number | 24BCE2736 |
| Course | Artificial Intelligence (Individual Digital Assignment) |
| Assigned algorithm | Iterative Deepening Depth-Limited Search (IDDLS), Algorithm No. 4 |
| Repository URL | https://github.com/MahaNagendran2007/AI-8Puzzle-Visualizer |
| GitHub Pages URL | https://mahanagendran2007.github.io/AI-8Puzzle-Visualizer/ |

## Features
- Manual input of initial and goal states with validation (tiles 0-8 exactly once, 0 = blank) and an inversion-parity solvability check before any search.
- Random solvable puzzles: the goal is scrambled with 6 / 12 / 16 legal random moves (Easy / Medium / Hard). This is scrambling effort, not a guaranteed optimal length.
- Run, Pause, Resume, Next Step, Previous Step, Reset and speed selection (Slow, Normal, Fast, Instant).
- Search panel: iteration, depth limit, depth, node being expanded, parent, successors, active recursive path, result, generated/expanded counts, time. Iteration table and solution summary.
- Animated board; the animated moves come from the recursion path that IDDLS actually returned.

## IDDLS implementation (`js/iddls.js`)
1. Start with depth limit 0. Each iteration **restarts from the initial state**.
2. A recursive depth-limited search checks the goal, stops at the limit (**cutoff**), and otherwise expands the node by moving the blank up / down / left / right.
3. **Cycles** are blocked with a set holding only the states on the *current* recursion path (added on descent, removed on backtrack). There is no global visited set, so valid paths in later iterations are never pruned.
4. Results are distinguished as goal / cutoff / failure. If an iteration ends with failure (no cutoff), the state space is exhausted and the search stops.
5. If the iteration is not successful, the limit increases by 1. The search stops at the goal or at the configurable maximum depth (0-40, default 20), and then reports "not found within limit". No other algorithm is used as a fallback.
6. The search is a JavaScript generator that yields one event per expansion. The UI pulls one event at a time, so it stays responsive and Pause/Resume/Step are exact.

IDDLS has no persistent open list. The panel therefore shows the *active recursive path* instead of a frontier.

**Statistics.** *Generated* counts the root once per iteration plus every legal successor not already on the current path. *Expanded* counts nodes whose successors were generated. Per-iteration figures sum to the totals. Memory is only an estimate (recursion path size), and is labelled as such.

**Optimality.** A found solution is reported as optimal because every smaller depth limit was fully searched without success on a unit-cost state space. When the search stops at the maximum depth, no optimality claim is made.

## Complexity
Time O(b^d), space O(bd), where b is the branching factor (at most 3 new moves per node in the 8-puzzle, since reversing is excluded) and d is the depth of the shallowest solution. Complete for finite branching if the limit is allowed to grow far enough; optimal for equal-cost moves. IDDLS repeats work across iterations, but the repeated work is dominated by the deepest level. Compared with BFS it uses far less memory; compared with plain DFS it is complete and optimal. BFS and DFS are not implemented here.

## Run locally
Open `index.html` in a browser (internet is needed once for the Bootstrap CDN), or serve the folder: `python3 -m http.server` and visit http://localhost:8000.

## Project structure
```
index.html          layout and sections
css/style.css       styling and tile animation
js/puzzle.js        validation, parity check, legal moves, random generation
js/iddls.js         IDDLS (generator-based recursive depth-limited search)
js/statistics.js    time formatting and memory estimate
js/visualization.js board rendering
js/main.js          controls, playback, event history, summary
tests/              unit.test.js (Node) and e2e.test.js (Playwright)
docs/test-results.txt  captured output of the test runs
```

## Testing
```
node tests/unit.test.js                     # no dependencies
npm install && npx playwright install chromium
node tests/e2e.test.js                      # drives the real page in Chromium
```
The unit tests cover solved / one-move / multi-move / unsolvable / invalid / depth-limit cases, iteration restarts and limit increments, cycle prevention, optimality against a test-only BFS, random generation (default and custom goals), and statistics against an independent reference implementation. The end-to-end tests cover every control, Pause/Resume without duplicated execution, Next/Previous board restoration, Reset, animation vs. solution path, statistics consistency, responsiveness and bounded memory. The e2e tests block the CDN on purpose, so they check logic rather than Bootstrap styling.

## Deploy on GitHub Pages
1. Create an empty repository on github.com (for example `AI-8Puzzle-Visualizer`).
2. In this folder run:
   ```
   git init
   git add .
   git commit -m "AI 8-Puzzle IDDLS visualizer"
   git branch -M main
   git remote add origin https://github.com/<your-username>/AI-8Puzzle-Visualizer.git
   git push -u origin main
   ```
3. On GitHub open **Settings > Pages**, set **Source** to *Deploy from a branch*, branch `main`, folder `/ (root)`, and save.
4. After about a minute the site is at `https://<your-username>.github.io/AI-8Puzzle-Visualizer/`. Put both URLs in the table above.

All paths are relative, so the site works from a project sub-path.

## Demo video
Link to the short demonstration video: _add after you upload it (YouTube unlisted, Google Drive, etc.)_

## Screenshots
Add your own screenshots to `images/` and link them here:
- `images/home.png` (placeholder)
- `images/solver.png` (placeholder)
- `images/summary.png` (placeholder)

## Known limitations
- Bootstrap is loaded from a CDN, so styling needs internet; logic works offline.
- Search history is capped at 60,000 events; beyond that the oldest events are dropped (Previous cannot reach them) and a notice is shown. The search itself is unaffected.
- Very deep solutions (roughly 25+ moves) can take a long time in IDDLS. Use Pause or Reset at any time.
- Appearance on real phones and other browsers was not tested; only a Chromium desktop and a 375 px viewport check were run.

## References
- Russell, S. and Norvig, P., *Artificial Intelligence: A Modern Approach*, sections on depth-limited and iterative deepening search.
- Bootstrap 5 documentation, https://getbootstrap.com
