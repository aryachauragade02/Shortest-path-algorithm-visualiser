/*
 * Shortest Path Finder & Algorithm Visualizer
 * Core algorithms — no DOM access, so the same file runs in the browser
 * (as window.PathAlgorithms) and in Node.js (module.exports) for testing.
 *
 * Grid model:  { rows, cols, walls: Uint8Array, weights: Uint8Array }
 *   - cells are numbered i = row * cols + col
 *   - moving INTO cell i costs weights[i] (1 for a normal cell, 5 for a weight)
 *   - movement is 4-directional (up, right, down, left)
 *
 * Graph model: { directed, nodes: [{id, x, y}], edges: [[u, v, w], ...] }
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PathAlgorithms = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const fmt = (x) => (x === Infinity ? '∞' : String(x));

  /* ------------------------------------------------------------------ */
  /* Binary min-heap used as the priority queue                          */
  /* push / pop are O(log n). Ties are broken by `tie`, then FIFO order. */
  /* ------------------------------------------------------------------ */
  class MinHeap {
    constructor() { this.a = []; this.seq = 0; }
    get size() { return this.a.length; }
    less(x, y) {
      if (x.key !== y.key) return x.key < y.key;
      if (x.tie !== y.tie) return x.tie < y.tie;
      return x.seq < y.seq;
    }
    push(node, key, tie = 0) {
      const a = this.a;
      a.push({ node, key, tie, seq: this.seq++ });
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!this.less(a[i], a[p])) break;
        [a[i], a[p]] = [a[p], a[i]];
        i = p;
      }
    }
    pop() {
      const a = this.a;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < a.length && this.less(a[l], a[m])) m = l;
          if (r < a.length && this.less(a[r], a[m])) m = r;
          if (m === i) break;
          [a[i], a[m]] = [a[m], a[i]];
          i = m;
        }
      }
      return top;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Grid helpers                                                         */
  /* ------------------------------------------------------------------ */
  const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

  function neighbors(g, i) {
    const r = (i / g.cols) | 0, c = i % g.cols, out = [];
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= g.rows || nc >= g.cols) continue;
      const j = nr * g.cols + nc;
      if (!g.walls[j]) out.push(j);
    }
    return out;
  }
  const manhattan = (g, a, b) =>
    Math.abs(((a / g.cols) | 0) - ((b / g.cols) | 0)) + Math.abs((a % g.cols) - (b % g.cols));
  const cellCost = (g, i) => g.weights[i] || 1;

  function buildPath(prev, s, t) {
    if (s !== t && prev[t] === -1) return [];
    const path = [];
    for (let v = t; v !== -1; v = prev[v]) path.push(v);
    return path.reverse();
  }

  function finish(g, s, t, events, prev, visitedCount) {
    const path = buildPath(prev, s, t);
    let cost = 0;
    for (let k = 1; k < path.length; k++) cost += cellCost(g, path[k]);
    return {
      events,                       // [type, cell] — type 0 = added to frontier, 1 = visited
      path,
      found: path.length > 0,
      steps: Math.max(0, path.length - 1),
      cost: path.length ? cost : Infinity,
      visitedCount,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Dijkstra and A* (same skeleton, different priority key)              */
  /*   Dijkstra: key = g(v)                                               */
  /*   A*:       key = g(v) + h(v), h = Manhattan distance (admissible,   */
  /*             because every step costs at least 1)                     */
  /* ------------------------------------------------------------------ */
  function bestFirst(g, s, t, mode) {
    const N = g.rows * g.cols;
    const dist = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    const pq = new MinHeap();
    const events = [];
    const h = (i) => (mode === 'astar' ? manhattan(g, i, t) : 0);
    let visited = 0;

    dist[s] = 0;
    pq.push(s, h(s), h(s));
    events.push([0, s]);

    while (pq.size) {
      const u = pq.pop().node;
      if (done[u]) continue;            // stale entry (lazy deletion)
      done[u] = 1;
      visited++;
      events.push([1, u]);
      if (u === t) break;
      for (const v of neighbors(g, u)) {
        if (done[v]) continue;
        const nd = dist[u] + cellCost(g, v);
        if (nd < dist[v]) {             // relaxation
          dist[v] = nd;
          prev[v] = u;
          const hv = h(v);
          pq.push(v, nd + hv, hv);
          events.push([0, v]);
        }
      }
    }
    return finish(g, s, t, events, prev, visited);
  }

  const dijkstra = (g, s, t) => bestFirst(g, s, t, 'dijkstra');
  const astar = (g, s, t) => bestFirst(g, s, t, 'astar');

  /* Greedy Best-First Search: priority = h(v) only. Fast, not optimal. */
  function greedy(g, s, t) {
    const N = g.rows * g.cols;
    const prev = new Int32Array(N).fill(-1);
    const seen = new Uint8Array(N);
    const pq = new MinHeap();
    const events = [];
    let visited = 0;
    seen[s] = 1;
    pq.push(s, manhattan(g, s, t));
    events.push([0, s]);
    while (pq.size) {
      const u = pq.pop().node;
      visited++;
      events.push([1, u]);
      if (u === t) break;
      for (const v of neighbors(g, u)) {
        if (seen[v]) continue;
        seen[v] = 1;
        prev[v] = u;
        pq.push(v, manhattan(g, v, t));
        events.push([0, v]);
      }
    }
    return finish(g, s, t, events, prev, visited);
  }

  /* Breadth-First Search: FIFO queue, shortest in number of steps (ignores weights). */
  function bfs(g, s, t) {
    const N = g.rows * g.cols;
    const prev = new Int32Array(N).fill(-1);
    const seen = new Uint8Array(N);
    const queue = [s];
    const events = [[0, s]];
    let head = 0, visited = 0;
    seen[s] = 1;
    while (head < queue.length) {
      const u = queue[head++];
      visited++;
      events.push([1, u]);
      if (u === t) break;
      for (const v of neighbors(g, u)) {
        if (seen[v]) continue;
        seen[v] = 1;
        prev[v] = u;
        queue.push(v);
        events.push([0, v]);
      }
    }
    return finish(g, s, t, events, prev, visited);
  }

  /* Depth-First Search: LIFO stack. Finds *a* path, usually not the shortest. */
  function dfs(g, s, t) {
    const N = g.rows * g.cols;
    const prev = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    const stack = [[s, -1]];
    const events = [[0, s]];
    let visited = 0;
    while (stack.length) {
      const [u, parent] = stack.pop();
      if (done[u]) continue;
      done[u] = 1;
      prev[u] = parent;
      visited++;
      events.push([1, u]);
      if (u === t) break;
      const nb = neighbors(g, u);
      for (let k = nb.length - 1; k >= 0; k--) {   // reverse so "up" is explored first
        if (!done[nb[k]]) { stack.push([nb[k], u]); events.push([0, nb[k]]); }
      }
    }
    return finish(g, s, t, events, prev, visited);
  }

  const GRID_ALGORITHMS = { dijkstra, astar, bfs, dfs, greedy };

  function run(name, g, s, t) {
    const fn = GRID_ALGORITHMS[name];
    if (!fn) throw new Error('Unknown algorithm: ' + name);
    const t0 = now();
    const res = fn(g, s, t);
    res.ms = now() - t0;
    res.algorithm = name;
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Maze and obstacle generators — return cell indices in drawing order  */
  /* ------------------------------------------------------------------ */

  /* Recursive division (rows and cols must be odd). Rooms sit on odd
     coordinates, walls on even ones, so the result is a perfect maze:
     exactly one route between any two rooms. */
  function recursiveDivision(rows, cols, rand = Math.random) {
    const order = [];
    const add = (r, c) => order.push(r * cols + c);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];

    for (let c = 0; c < cols; c++) add(0, c);
    for (let r = 1; r < rows; r++) add(r, cols - 1);
    for (let c = cols - 2; c >= 0; c--) add(rows - 1, c);
    for (let r = rows - 2; r > 0; r--) add(r, 0);

    (function divide(r0, r1, c0, c1) {
      const rowsC = [], colsC = [];
      for (let r = r0 + 1; r < r1; r++) if (r % 2 === 0) rowsC.push(r);
      for (let c = c0 + 1; c < c1; c++) if (c % 2 === 0) colsC.push(c);
      if (!rowsC.length && !colsC.length) return;
      const h = r1 - r0 + 1, w = c1 - c0 + 1;
      let horizontal = h > w ? true : w > h ? false : rand() < 0.5;
      if (horizontal && !rowsC.length) horizontal = false;
      if (!horizontal && !colsC.length) horizontal = true;

      if (horizontal) {
        const wr = pick(rowsC), gaps = [];
        for (let c = c0; c <= c1; c++) if (c % 2 === 1) gaps.push(c);
        const gap = pick(gaps);
        for (let c = c0; c <= c1; c++) if (c !== gap) add(wr, c);
        divide(r0, wr - 1, c0, c1);
        divide(wr + 1, r1, c0, c1);
      } else {
        const wc = pick(colsC), gaps = [];
        for (let r = r0; r <= r1; r++) if (r % 2 === 1) gaps.push(r);
        const gap = pick(gaps);
        for (let r = r0; r <= r1; r++) if (r !== gap) add(r, wc);
        divide(r0, r1, c0, wc - 1);
        divide(r0, r1, wc + 1, c1);
      }
    })(1, rows - 2, 1, cols - 2);
    return order;
  }

  function randomCells(rows, cols, density, rand = Math.random) {
    const out = [];
    for (let i = 0; i < rows * cols; i++) if (rand() < density) out.push(i);
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Weighted graph algorithms with step-by-step snapshots                */
  /* ------------------------------------------------------------------ */
  function expandEdges(g) {
    const E = [];
    for (const [u, v, w] of g.edges) {
      E.push([u, v, w]);
      if (!g.directed) E.push([v, u, w]);
    }
    return E;
  }
  function adjacency(g) {
    const adj = g.nodes.map(() => []);
    for (const e of expandEdges(g)) adj[e[0]].push(e);
    return adj;
  }

  /* Dijkstra, array version: Extract-Min is a linear scan, O(V^2) overall. */
  function graphDijkstra(g, src) {
    const n = g.nodes.length, L = (i) => g.nodes[i].id, adj = adjacency(g);
    const dist = Array(n).fill(Infinity), prev = Array(n).fill(-1), done = Array(n).fill(false);
    const steps = [];
    const snap = (o) => steps.push(Object.assign(
      { dist: dist.slice(), prev: prev.slice(), done: done.slice(), cur: -1, edge: null, outcome: null }, o));

    dist[src] = 0;
    snap({ msg: `Initialise d[${L(src)}] = 0 and d[v] = ∞ for every other vertex. All vertices start in the queue Q.` });

    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++)
        if (!done[i] && dist[i] < Infinity && (u === -1 || dist[i] < dist[u])) u = i;
      if (u === -1) break;
      done[u] = true;
      snap({ cur: u, msg: `Extract-Min(Q) gives ${L(u)} with d = ${dist[u]}. ${L(u)} is now final.` });

      for (const [, v, w] of adj[u]) {
        const nd = dist[u] + w;
        if (done[v]) {
          snap({
            cur: u, edge: [u, v], outcome: 'skip',
            msg: nd < dist[v]
              ? `Edge ${L(u)}→${L(v)}: ${dist[u]} + (${w}) = ${nd} is less than d[${L(v)}] = ${dist[v]}, but ${L(v)} is already final. Dijkstra never revisits a final vertex, so this cheaper route is lost.`
              : `Edge ${L(u)}→${L(v)}: ${L(v)} is already final, so skip it.`,
          });
          continue;
        }
        if (nd < dist[v]) {
          const old = dist[v];
          dist[v] = nd; prev[v] = u;
          snap({ cur: u, edge: [u, v], outcome: 'update', msg: `Relax ${L(u)}→${L(v)}: ${dist[u]} + ${w} = ${nd} < ${fmt(old)}, so d[${L(v)}] = ${nd} and prev[${L(v)}] = ${L(u)}.` });
        } else {
          snap({ cur: u, edge: [u, v], outcome: 'keep', msg: `Relax ${L(u)}→${L(v)}: ${dist[u]} + ${w} = ${nd} ≥ ${dist[v]}, no change.` });
        }
      }
    }
    snap({ final: true, msg: 'No reachable vertex is left in Q. Every distance is final.' });
    return { steps, dist, prev, negativeCycle: false };
  }

  /* Bellman–Ford: V−1 passes over every edge, then one pass to detect negative cycles. */
  function bellmanFord(g, src) {
    const n = g.nodes.length, L = (i) => g.nodes[i].id, E = expandEdges(g);
    const dist = Array(n).fill(Infinity), prev = Array(n).fill(-1);
    const steps = [];
    let pass = 0;
    const snap = (o) => steps.push(Object.assign(
      { dist: dist.slice(), prev: prev.slice(), done: null, cur: -1, edge: null, outcome: null, pass }, o));

    dist[src] = 0;
    snap({ msg: `Initialise d[${L(src)}] = 0 and d[v] = ∞ for every other vertex. ${n - 1} passes over all ${E.length} edges are needed at most.` });

    for (pass = 1; pass <= n - 1; pass++) {
      let changed = false;
      snap({ msg: `Pass ${pass} of ${n - 1}: relax every edge once.` });
      for (const [u, v, w] of E) {
        if (dist[u] === Infinity) continue;
        const nd = dist[u] + w;
        if (nd < dist[v]) {
          const old = dist[v];
          dist[v] = nd; prev[v] = u; changed = true;
          snap({ cur: u, edge: [u, v], outcome: 'update', msg: `Relax ${L(u)}→${L(v)}: ${dist[u]} + (${w}) = ${nd} < ${fmt(old)}, so d[${L(v)}] = ${nd} and prev[${L(v)}] = ${L(u)}.` });
        } else {
          snap({ cur: u, edge: [u, v], outcome: 'keep', msg: `Relax ${L(u)}→${L(v)}: ${dist[u]} + (${w}) = ${nd} ≥ ${dist[v]}, no change.` });
        }
      }
      if (!changed) {
        snap({ msg: `No distance changed in pass ${pass}, so the distances are already final. Stop early.` });
        break;
      }
    }
    pass = Math.min(pass, n - 1);
    let negativeCycle = false;
    for (const [u, v, w] of E) if (dist[u] !== Infinity && dist[u] + w < dist[v]) negativeCycle = true;
    snap({
      final: true,
      msg: negativeCycle
        ? 'Check pass: an edge can still be relaxed, so the graph has a negative-weight cycle and shortest paths are undefined.'
        : 'Check pass: no edge can be relaxed any further, so there is no negative cycle. Distances are final.',
    });
    return { steps, dist, prev, negativeCycle };
  }

  /* Floyd–Warshall all-pairs shortest paths (dynamic programming), O(V^3). */
  function floydWarshall(g) {
    const n = g.nodes.length;
    const d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
    const next = Array.from({ length: n }, () => Array(n).fill(-1));
    for (const [u, v, w] of expandEdges(g)) if (w < d[u][v]) { d[u][v] = w; next[u][v] = v; }
    for (let i = 0; i < n; i++) next[i][i] = i;
    for (let k = 0; k < n; k++)
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          if (d[i][k] + d[k][j] < d[i][j]) { d[i][j] = d[i][k] + d[k][j]; next[i][j] = next[i][k]; }
    return { dist: d, next };
  }

  function graphPath(prev, src, t) {
    if (t !== src && prev[t] === -1) return [];
    const p = [];
    const guard = new Set();
    for (let v = t; v !== -1 && !guard.has(v); v = prev[v]) { guard.add(v); p.push(v); }
    return p.reverse();
  }

  return {
    MinHeap, neighbors, manhattan, run, GRID_ALGORITHMS,
    dijkstra, astar, bfs, dfs, greedy,
    recursiveDivision, randomCells,
    graphDijkstra, bellmanFord, floydWarshall, graphPath, fmt,
  };
});
