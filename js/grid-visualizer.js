/*
 * Grid visualizer: canvas rendering, mouse/touch editing, animation,
 * statistics and the "compare all" table.
 */
(function () {
  'use strict';
  const A = window.PathAlgorithms;
  const $ = (id) => document.getElementById(id);

  /* ---------------- Algorithm descriptions (shown in the info card) ---------------- */
  const INFO = {
    dijkstra: {
      name: "Dijkstra's algorithm",
      desc: 'Greedy single-source shortest path. Always expands the unvisited cell with the smallest known distance g(v), so the first time the target is removed from the queue its distance is optimal.',
      weighted: true, optimal: true,
      rows: [['Data structure', 'Binary min-heap (priority queue)'], ['Time', 'O((V + E) log V)'], ['On this grid', 'E ≤ 4V, so O(V log V)'], ['Space', 'O(V)'], ['Design paradigm', 'Greedy']],
      code: `<span class="kw">DIJKSTRA</span>(G, s, t)
  <span class="kw">for each</span> v ∈ V:  d[v] ← ∞;  prev[v] ← NIL
  d[s] ← 0;   Q ← min-heap {(0, s)}
  <span class="kw">while</span> Q ≠ ∅
      u ← EXTRACT-MIN(Q)
      <span class="kw">if</span> u visited: <span class="kw">continue</span>     <span class="cm">// stale entry</span>
      mark u visited
      <span class="kw">if</span> u = t: <span class="kw">break</span>
      <span class="kw">for each</span> neighbour v of u
          <span class="kw">if</span> d[u] + w(u,v) &lt; d[v]       <span class="cm">// relax</span>
              d[v] ← d[u] + w(u,v);  prev[v] ← u
              INSERT(Q, (d[v], v))
  <span class="kw">return</span> path from t back to s via prev`,
    },
    astar: {
      name: 'A* search',
      desc: 'Dijkstra plus a heuristic. The queue is ordered by f(v) = g(v) + h(v), where h is the Manhattan distance to the target. Because h never overestimates, A* still returns an optimal path while visiting far fewer cells.',
      weighted: true, optimal: true,
      rows: [['Data structure', 'Binary min-heap ordered by f = g + h'], ['Heuristic', 'Manhattan |Δr| + |Δc| (admissible, consistent)'], ['Time (worst)', 'O((V + E) log V)'], ['Space', 'O(V)'], ['Design paradigm', 'Informed (heuristic) search']],
      code: `<span class="kw">A-STAR</span>(G, s, t)
  g[s] ← 0;  Q ← min-heap {(h(s), s)}
  <span class="kw">while</span> Q ≠ ∅
      u ← EXTRACT-MIN(Q)                <span class="cm">// smallest f</span>
      <span class="kw">if</span> u visited: <span class="kw">continue</span>
      mark u visited
      <span class="kw">if</span> u = t: <span class="kw">return</span> PATH(prev, t)
      <span class="kw">for each</span> neighbour v of u
          <span class="kw">if</span> g[u] + w(u,v) &lt; g[v]
              g[v] ← g[u] + w(u,v);  prev[v] ← u
              f ← g[v] + h(v)            <span class="cm">// h = Manhattan</span>
              INSERT(Q, (f, v))
  <span class="kw">return</span> "no path"`,
    },
    bfs: {
      name: 'Breadth-first search',
      desc: 'Explores the grid in rings of equal step count using a FIFO queue. It finds the path with the fewest steps but ignores weights, so on a weighted board its path can cost more than the optimum.',
      weighted: false, optimal: false,
      rows: [['Data structure', 'FIFO queue'], ['Time', 'O(V + E)'], ['Space', 'O(V)'], ['Shortest when', 'All edges have equal weight'], ['Design paradigm', 'Uninformed graph traversal']],
      code: `<span class="kw">BFS</span>(G, s, t)
  mark s seen;  Q ← queue [s]
  <span class="kw">while</span> Q ≠ ∅
      u ← DEQUEUE(Q)
      <span class="kw">if</span> u = t: <span class="kw">return</span> PATH(prev, t)
      <span class="kw">for each</span> neighbour v of u
          <span class="kw">if</span> v not seen
              mark v seen;  prev[v] ← u
              ENQUEUE(Q, v)
  <span class="kw">return</span> "no path"`,
    },
    dfs: {
      name: 'Depth-first search',
      desc: 'Follows one direction as far as possible using a LIFO stack before backtracking. It will find a path if one exists, but the path is usually long and winding. Included as a contrast to the optimal algorithms.',
      weighted: false, optimal: false,
      rows: [['Data structure', 'LIFO stack'], ['Time', 'O(V + E)'], ['Space', 'O(V)'], ['Shortest path?', 'No guarantee'], ['Design paradigm', 'Uninformed graph traversal']],
      code: `<span class="kw">DFS</span>(G, s, t)
  S ← stack [(s, NIL)]
  <span class="kw">while</span> S ≠ ∅
      (u, p) ← POP(S)
      <span class="kw">if</span> u visited: <span class="kw">continue</span>
      mark u visited;  prev[u] ← p
      <span class="kw">if</span> u = t: <span class="kw">return</span> PATH(prev, t)
      <span class="kw">for each</span> neighbour v of u (reversed)
          <span class="kw">if</span> v not visited: PUSH(S, (v, u))
  <span class="kw">return</span> "no path"`,
    },
    greedy: {
      name: 'Greedy best-first search',
      desc: 'Orders the queue by the heuristic h(v) alone and ignores the cost already travelled. It rushes toward the target and visits few cells, but walls and weights can lead it down a costly route.',
      weighted: false, optimal: false,
      rows: [['Data structure', 'Binary min-heap ordered by h'], ['Time (worst)', 'O((V + E) log V)'], ['Space', 'O(V)'], ['Shortest path?', 'No guarantee'], ['Design paradigm', 'Greedy, informed search']],
      code: `<span class="kw">GREEDY-BFS</span>(G, s, t)
  mark s seen;  Q ← min-heap {(h(s), s)}
  <span class="kw">while</span> Q ≠ ∅
      u ← EXTRACT-MIN(Q)                <span class="cm">// smallest h only</span>
      <span class="kw">if</span> u = t: <span class="kw">return</span> PATH(prev, t)
      <span class="kw">for each</span> neighbour v of u
          <span class="kw">if</span> v not seen
              mark v seen;  prev[v] ← u
              INSERT(Q, (h(v), v))
  <span class="kw">return</span> "no path"`,
    },
  };
  const ORDER = ['dijkstra', 'astar', 'bfs', 'dfs', 'greedy'];

  /* ---------------- Board model ---------------- */
  const canvas = $('board');
  const ctx = canvas.getContext('2d');
  const wrapEl = canvas.parentElement;
  const narrow = window.innerWidth < 640;
  const ROWS = narrow ? 27 : 21;          // odd sizes so recursive division works
  const COLS = narrow ? 19 : 45;
  const N = ROWS * COLS;
  const idx = (r, c) => r * COLS + c;

  const walls = new Uint8Array(N);
  const weights = new Uint8Array(N).fill(1);
  const vis = new Uint8Array(N);          // 0 none, 1 frontier, 2 visited, 3 path
  const vt = new Float64Array(N);         // time the cell changed (for the grow-in effect)
  const homeStart = narrow ? idx(3, 9) : idx(9, 7);
  const homeEnd = narrow ? idx(23, 9) : idx(11, 37);
  let start = homeStart, end = homeEnd;
  const model = { rows: ROWS, cols: COLS, walls, weights };

  let algo = 'dijkstra';
  let tool = 'wall';
  let speed = 3;
  let anim = null;                        // running animation (search or maze)
  let lastResult = null;                  // last completed run, enables live recompute
  let pathCells = [], pathShown = 0;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EVENTS_PER_FRAME = [0.35, 1.2, 4, 12, 45];
  const PATH_PER_FRAME = [0.25, 0.5, 1, 2, 4];
  const MAZE_PER_FRAME = [2, 4, 8, 16, 40];

  /* ---------------- Colours from CSS tokens ---------------- */
  let C = {};
  function readColors() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    C = {
      surface: v('--surface'), grid: v('--grid'), ink: v('--ink'), accent: v('--accent'), accentInk: v('--accent-ink'),
      visited: v('--visited'), frontier: v('--frontier'), path: v('--path'), pathcell: v('--pathcell'),
      wall: v('--wall'), weight: v('--weight'), weightbg: v('--weightbg'), mono: v('--f-mono'),
    };
    requestDraw();
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  /* ---------------- Sizing ---------------- */
  let cell = 20, W = 0, H = 0, dpr = 1;
  function resize() {
    const avail = wrapEl.clientWidth - 20;
    cell = Math.max(10, Math.floor(avail / COLS));
    W = cell * COLS; H = cell * ROWS;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    requestDraw();
  }
  new ResizeObserver(resize).observe(wrapEl);

  /* ---------------- Drawing ---------------- */
  let drawQueued = false;
  function requestDraw() {
    if (!drawQueued) { drawQueued = true; requestAnimationFrame(frame); }
  }

  function frame(time) {
    drawQueued = false;
    if (anim) stepAnimation(time);
    const busy = draw(time);
    if (anim || busy) requestDraw();
  }

  function draw(time) {
    let growing = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.surface;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < N; i++) {
      const x = (i % COLS) * cell, y = ((i / COLS) | 0) * cell;
      if (walls[i]) {
        const k = reduceMotion ? 1 : Math.min(1, (time - vt[i]) / 160);
        if (k < 1) growing = true;
        const inset = (1 - k) * cell * 0.4;
        ctx.fillStyle = C.wall;
        ctx.fillRect(x + inset, y + inset, cell - 2 * inset, cell - 2 * inset);
        continue;
      }
      if (weights[i] > 1) {
        ctx.fillStyle = C.weightbg;
        ctx.fillRect(x, y, cell, cell);
      }
      const st = vis[i];
      if (st) {
        const k = reduceMotion ? 1 : Math.min(1, (time - vt[i]) / 240);
        if (k < 1) growing = true;
        const e = 1 - (1 - k) * (1 - k);
        const inset = (1 - e) * cell * 0.45;
        ctx.fillStyle = st === 1 ? C.frontier : st === 2 ? C.visited : C.pathcell;
        if (weights[i] > 1) ctx.globalAlpha = 0.75;
        ctx.fillRect(x + inset, y + inset, cell - 2 * inset, cell - 2 * inset);
        ctx.globalAlpha = 1;
      }
      if (weights[i] > 1) {
        ctx.fillStyle = C.weight;
        ctx.font = `600 ${Math.round(cell * 0.55)}px ${C.mono}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('5', x + cell / 2, y + cell / 2 + 1);
      }
    }

    // grid lines
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= COLS; c++) { ctx.moveTo(c * cell + 0.5, 0); ctx.lineTo(c * cell + 0.5, H); }
    for (let r = 0; r <= ROWS; r++) { ctx.moveTo(0, r * cell + 0.5); ctx.lineTo(W, r * cell + 0.5); }
    ctx.stroke();

    // path polyline
    const shown = Math.floor(pathShown);
    if (shown > 1) {
      ctx.strokeStyle = C.path;
      ctx.lineWidth = Math.max(3, cell * 0.3);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let k = 0; k < shown; k++) {
        const i = pathCells[k];
        const cx = (i % COLS) * cell + cell / 2, cy = ((i / COLS) | 0) * cell + cell / 2;
        if (k === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    drawStart(start);
    drawEnd(end);
    return growing;
  }

  function center(i) { return [(i % COLS) * cell + cell / 2, ((i / COLS) | 0) * cell + cell / 2]; }
  function drawStart(i) {
    const [cx, cy] = center(i), r = cell * 0.42;
    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.accentInk;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.32, cy - r * 0.45);
    ctx.lineTo(cx + r * 0.5, cy);
    ctx.lineTo(cx - r * 0.32, cy + r * 0.45);
    ctx.closePath(); ctx.fill();
  }
  function drawEnd(i) {
    const [cx, cy] = center(i), r = cell * 0.42;
    ctx.fillStyle = C.surface;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.beginPath(); ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = C.path;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2); ctx.fill();
  }

  /* ---------------- Animation ---------------- */
  function clearVisuals() {
    vis.fill(0);
    pathCells = []; pathShown = 0;
  }

  function startSearch() {
    clearVisuals();
    const result = A.run(algo, model, start, end);
    anim = { kind: 'search', result, ei: 0, acc: 0, phase: 'events' };
    lastResult = null;
    setRunning(true);
    showStats(null);
    requestDraw();
  }

  function stepAnimation(time) {
    const s = speed - 1;
    if (anim.kind === 'maze') {
      anim.acc += MAZE_PER_FRAME[s];
      while (anim.acc >= 1 && anim.i < anim.list.length) {
        const c = anim.list[anim.i++];
        anim.acc -= 1;
        if (c === start || c === end) continue;
        if (anim.type === 'wall') { walls[c] = 1; weights[c] = 1; }
        else if (!walls[c]) weights[c] = 5;
        vt[c] = time;
      }
      if (anim.i >= anim.list.length) { anim = null; setRunning(false); }
      return;
    }
    const r = anim.result;
    if (anim.phase === 'events') {
      anim.acc += EVENTS_PER_FRAME[s];
      while (anim.acc >= 1 && anim.ei < r.events.length) {
        const [type, c] = r.events[anim.ei++];
        anim.acc -= 1;
        if (type === 1) { vis[c] = 2; vt[c] = time; }
        else if (vis[c] !== 2) { vis[c] = 1; vt[c] = time; }
      }
      if (anim.ei >= r.events.length) { anim.phase = 'path'; anim.acc = 0; pathCells = r.path; pathShown = 0; }
    } else {
      pathShown = Math.min(pathCells.length, pathShown + PATH_PER_FRAME[s] * (pathCells.length > 60 ? 2 : 1));
      const shown = Math.floor(pathShown);
      for (let k = 0; k < shown; k++) if (vis[pathCells[k]] !== 3) { vis[pathCells[k]] = 3; vt[pathCells[k]] = time; }
      if (pathShown >= pathCells.length) {
        lastResult = r;
        anim = null;
        setRunning(false);
        showStats(r);
      }
    }
  }

  function stopAnimation() {
    if (!anim) return;
    if (anim.kind === 'search') { applyInstant(anim.result); }
    else {
      for (; anim.i < anim.list.length; anim.i++) {
        const c = anim.list[anim.i];
        if (c === start || c === end) continue;
        if (anim.type === 'wall') { walls[c] = 1; weights[c] = 1; } else if (!walls[c]) weights[c] = 5;
      }
    }
    anim = null;
    setRunning(false);
    requestDraw();
  }

  /* Instant (non-animated) result, used for live recompute and "stop". */
  function applyInstant(result) {
    clearVisuals();
    for (const [type, c] of result.events) {
      if (type === 1) vis[c] = 2; else if (vis[c] !== 2) vis[c] = 1;
      vt[c] = 0;
    }
    for (const c of result.path) vis[c] = 3;
    pathCells = result.path; pathShown = result.path.length;
    lastResult = result;
    showStats(result);
    requestDraw();
  }
  function recomputeLive() {
    if (lastResult && !anim) applyInstant(A.run(algo, model, start, end));
  }

  function runMaze(kind) {
    stopAnimation();
    clearVisuals();
    lastResult = null;
    showStats(null);
    walls.fill(0); weights.fill(1);
    if (kind === 'division') {
      anim = { kind: 'maze', type: 'wall', list: A.recursiveDivision(ROWS, COLS), i: 0, acc: 0 };
    } else if (kind === 'random') {
      anim = { kind: 'maze', type: 'wall', list: shuffle(A.randomCells(ROWS, COLS, 0.28)), i: 0, acc: 0 };
    } else if (kind === 'weights') {
      anim = { kind: 'maze', type: 'weight', list: shuffle(A.randomCells(ROWS, COLS, 0.25)), i: 0, acc: 0 };
    } else if (kind === 'both') {
      const wl = A.randomCells(ROWS, COLS, 0.22);
      for (const c of A.randomCells(ROWS, COLS, 0.2)) if (c !== start && c !== end) weights[c] = 5;
      anim = { kind: 'maze', type: 'wall', list: shuffle(wl), i: 0, acc: 0 };
    }
    if (kind === 'division') { start = homeStart; end = homeEnd; }
    setRunning(true, true);
    requestDraw();
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------------- Editing with mouse / touch ---------------- */
  let drag = null, paintMode = null, lastCell = -1;
  function cellAt(e) {
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / (rect.width / COLS));
    const r = Math.floor((e.clientY - rect.top) / (rect.height / ROWS));
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return -1;
    return idx(r, c);
  }
  function paint(i, time) {
    if (i === start || i === end) return;
    switch (paintMode) {
      case 'wall': if (!walls[i]) { walls[i] = 1; weights[i] = 1; vt[i] = time; } break;
      case 'unwall': walls[i] = 0; break;
      case 'weight': if (!walls[i]) weights[i] = 5; break;
      case 'unweight': weights[i] = 1; break;
      case 'erase': walls[i] = 0; weights[i] = 1; break;
    }
  }
  function cellsBetween(a, b) {      // Bresenham line so fast drags leave no gaps
    const out = [];
    let r0 = (a / COLS) | 0, c0 = a % COLS;
    const r1 = (b / COLS) | 0, c1 = b % COLS;
    const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0), sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
    let err = dc - dr;
    for (;;) {
      out.push(idx(r0, c0));
      if (r0 === r1 && c0 === c1) break;
      const e2 = 2 * err;
      if (e2 > -dr) { err -= dr; c0 += sc; }
      if (e2 < dc) { err += dc; r0 += sr; }
    }
    return out;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (anim) return;
    const i = cellAt(e);
    if (i < 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    lastCell = i;
    if (i === start) { drag = 'start'; return; }
    if (i === end) { drag = 'end'; return; }
    drag = 'paint';
    if (tool === 'wall') paintMode = walls[i] ? 'unwall' : 'wall';
    else if (tool === 'weight') paintMode = weights[i] > 1 ? 'unweight' : 'weight';
    else paintMode = 'erase';
    if (!lastResult) clearVisuals();
    paint(i, performance.now());
    afterEdit();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const i = cellAt(e);
    if (i < 0 || i === lastCell) return;
    if (drag === 'paint') {
      const t = performance.now();
      for (const c of cellsBetween(lastCell, i)) paint(c, t);
    } else if (!walls[i]) {
      if (drag === 'start' && i !== end) start = i;
      if (drag === 'end' && i !== start) end = i;
    }
    lastCell = i;
    afterEdit();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function afterEdit() {
    if (lastResult) recomputeLive(); else requestDraw();
  }

  /* ---------------- UI wiring ---------------- */
  const runBtn = $('run');
  function setRunning(on, maze) {
    runBtn.textContent = on ? (maze ? 'Skip' : 'Stop') : 'Visualize';
    runBtn.classList.toggle('stop', on);
    $('clearPath').disabled = on;
    $('clearBoard').disabled = on;
    $('compare').disabled = on;
    $('maze').disabled = on;
    $('algo').disabled = on;
    if (!on) $('maze').value = '';
  }

  function fmtNum(n) { return n.toLocaleString('en-IN'); }
  function showStats(r) {
    const name = INFO[algo].name;
    if (!r) {
      $('statAlgo').textContent = anim && anim.kind === 'search' ? `Running ${name}…` : 'Press Visualize to run the selected algorithm.';
      ['statVisited', 'statSteps', 'statCost', 'statTime'].forEach((id) => { $(id).textContent = '—'; });
      $('statStatus').textContent = '';
      $('statStatus').className = 'status';
      return;
    }
    $('statAlgo').textContent = `${name} on a ${ROWS} × ${COLS} grid (${fmtNum(N)} cells).`;
    $('statVisited').textContent = fmtNum(r.visitedCount);
    $('statSteps').innerHTML = r.found ? `${r.steps} <small>moves</small>` : '—';
    $('statCost').textContent = r.found ? r.cost : '∞';
    $('statTime').innerHTML = `${r.ms.toFixed(3)} <small>ms</small>`;
    const st = $('statStatus');
    if (!r.found) {
      st.textContent = 'No path exists. The target is walled off from the start.';
      st.className = 'status bad';
    } else {
      const opt = A.run('dijkstra', model, start, end).cost;
      if (r.cost === opt) {
        st.textContent = `Optimal: this path has the minimum possible cost (${opt}).`;
        st.className = 'status ok';
      } else {
        st.textContent = `Not optimal: the cheapest path costs ${opt}, this one costs ${r.cost} (+${r.cost - opt}).`;
        st.className = 'status bad';
      }
    }
  }

  function showInfo() {
    const d = INFO[algo];
    $('infoName').textContent = d.name;
    $('infoDesc').textContent = d.desc;
    $('infoChips').innerHTML =
      `<span class="chip ${d.weighted ? 'yes' : 'no'}">${d.weighted ? 'Uses weights' : 'Ignores weights'}</span>` +
      `<span class="chip ${d.optimal ? 'yes' : 'no'}">${d.optimal ? 'Guarantees shortest path' : 'No shortest-path guarantee'}</span>` +
      `<span class="chip">V = ${fmtNum(N)} cells</span>`;
    $('infoTable').innerHTML = d.rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
    $('infoCode').innerHTML = d.code;
  }

  function runComparison() {
    stopAnimation();
    const REPS = 25;
    const rows = ORDER.map((name) => {
      let total = 0, res = null;
      for (let k = 0; k < REPS; k++) { res = A.run(name, model, start, end); total += res.ms; }
      return { name, res, avg: total / REPS };
    });
    const opt = rows[0].res.cost;
    const minVisited = Math.min(...rows.filter((r) => r.res.found && r.res.cost === opt).map((r) => r.res.visitedCount));
    const minTime = Math.min(...rows.map((r) => r.avg));
    $('compareBody').innerHTML = rows.map(({ name, res, avg }) => {
      const optimal = res.found && res.cost === opt;
      return `<tr data-algo="${name}" tabindex="0">
        <td>${INFO[name].name}</td>
        <td class="num ${optimal && res.visitedCount === minVisited ? 'best' : ''}">${fmtNum(res.visitedCount)}</td>
        <td class="num">${res.found ? res.steps : '—'}</td>
        <td class="num">${res.found ? res.cost : '∞'}</td>
        <td class="num ${avg === minTime ? 'best' : ''}">${avg.toFixed(3)}</td>
        <td>${!res.found ? '<span class="pill no">No path</span>' : optimal ? '<span class="pill yes">Yes</span>' : `<span class="pill no">No, +${res.cost - opt}</span>`}</td>
      </tr>`;
    }).join('');
  }
  $('compareBody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-algo]');
    if (!tr || anim) return;
    algo = tr.dataset.algo;
    $('algo').value = algo;
    showInfo();
    applyInstant(A.run(algo, model, start, end));
  });
  $('compareBody').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.closest('tr[data-algo]')?.click(); }
  });

  runBtn.addEventListener('click', () => (anim ? stopAnimation() : startSearch()));
  $('compare').addEventListener('click', runComparison);
  $('algo').addEventListener('change', (e) => {
    algo = e.target.value;
    showInfo();
    if (lastResult) recomputeLive(); else showStats(null);
  });
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => {
    tool = b.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  }));
  $('speed').addEventListener('input', (e) => { speed = +e.target.value; });
  $('maze').addEventListener('change', (e) => { if (e.target.value) runMaze(e.target.value); });
  $('clearPath').addEventListener('click', () => { clearVisuals(); lastResult = null; showStats(null); requestDraw(); });
  $('clearBoard').addEventListener('click', () => {
    walls.fill(0); weights.fill(1); clearVisuals(); lastResult = null;
    start = homeStart; end = homeEnd; showStats(null); requestDraw();
  });

  /* ---------------- Sample board so the first view shows something ---------------- */
  function loadSample() {
    const midR = (ROWS / 2) | 0;
    if (!narrow) {
      for (let r = 3; r <= ROWS - 4; r++) if (r !== midR + 6) walls[idx(r, 22)] = 1;
      for (let c = 14; c <= 22; c++) walls[idx(3, c)] = 1;
      for (let c = 22; c <= 30; c++) walls[idx(ROWS - 4, c)] = 1;
      for (let r = 6; r <= 14; r++) for (let c = 27; c <= 30; c++) weights[idx(r, c)] = 5;
    } else {
      for (let c = 3; c <= COLS - 1; c++) if (c !== 4) walls[idx(9, c)] = 1;
      for (let c = 0; c <= COLS - 4; c++) if (c !== COLS - 5) walls[idx(17, c)] = 1;
      for (let r = 11; r <= 15; r++) for (let c = 6; c <= 12; c++) weights[idx(r, c)] = 5;
    }
  }

  loadSample();
  readColors();
  showInfo();
  showStats(null);
  resize();
  // run once instantly so the board opens with a finished example
  applyInstant(A.run(algo, model, start, end));

  window.GridVisualizer = { stop: stopAnimation };
})();
