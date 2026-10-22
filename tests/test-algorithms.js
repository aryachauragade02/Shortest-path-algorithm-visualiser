/*
 * Correctness and performance tests for js/algorithms.js
 * Run with:  node tests/test-algorithms.js
 */
'use strict';
const A = require('../js/algorithms.js');

let passed = 0, failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; } else { failed++; console.log('  FAIL', name, detail); }
}

// Seeded PRNG so failures are reproducible
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGrid(rows, cols, wallP, weightP, rand) {
  const N = rows * cols, walls = new Uint8Array(N), weights = new Uint8Array(N).fill(1);
  for (let i = 0; i < N; i++) {
    const x = rand();
    if (x < wallP) walls[i] = 1; else if (x < wallP + weightP) weights[i] = 5;
  }
  return { rows, cols, walls, weights };
}

// Reference: Bellman–Ford on the grid (slow but obviously correct)
function referenceCost(g, s, t) {
  const N = g.rows * g.cols, d = new Array(N).fill(Infinity);
  d[s] = 0;
  for (let pass = 0; pass < N; pass++) {
    let changed = false;
    for (let u = 0; u < N; u++) {
      if (g.walls[u] || d[u] === Infinity) continue;
      for (const v of A.neighbors(g, u)) {
        if (d[u] + g.weights[v] < d[v]) { d[v] = d[u] + g.weights[v]; changed = true; }
      }
    }
    if (!changed) break;
  }
  return d[t];
}
function referenceSteps(g, s, t) {   // unweighted BFS distance
  const N = g.rows * g.cols, d = new Array(N).fill(Infinity), q = [s];
  d[s] = 0;
  for (let h = 0; h < q.length; h++) for (const v of A.neighbors(g, q[h])) if (d[v] === Infinity) { d[v] = d[q[h]] + 1; q.push(v); }
  return d[t];
}
function validPath(g, path, s, t) {
  if (!path.length) return true;
  if (path[0] !== s || path[path.length - 1] !== t) return false;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k];
    if (g.walls[b]) return false;
    if (A.manhattan(g, a, b) !== 1) return false;
  }
  return true;
}

console.log('1. Random grids: optimality and path validity');
const rand = mulberry32(2026);
for (let trial = 0; trial < 300; trial++) {
  const rows = 5 + Math.floor(rand() * 20), cols = 5 + Math.floor(rand() * 30);
  const g = makeGrid(rows, cols, rand() * 0.35, rand() * 0.3, rand);
  const N = rows * cols;
  let s = Math.floor(rand() * N), t = Math.floor(rand() * N);
  g.walls[s] = 0; g.walls[t] = 0;
  const ref = referenceCost(g, s, t), refSteps = referenceSteps(g, s, t);
  for (const name of Object.keys(A.GRID_ALGORITHMS)) {
    const r = A.run(name, g, s, t);
    check(`${name} valid path #${trial}`, validPath(g, r.path, s, t));
    check(`${name} found iff reachable #${trial}`, r.found === (ref !== Infinity));
    if (name === 'dijkstra' || name === 'astar') check(`${name} optimal cost #${trial}`, r.cost === ref, `got ${r.cost} want ${ref}`);
    if (name === 'bfs') check(`bfs fewest steps #${trial}`, !r.found || r.steps === refSteps, `got ${r.steps} want ${refSteps}`);
    if (r.found) check(`${name} cost ≥ optimum #${trial}`, r.cost >= ref);
  }
}

console.log('2. Recursive-division maze is a perfect maze (all rooms connected)');
for (let trial = 0; trial < 20; trial++) {
  const rows = 21, cols = 45, N = rows * cols;
  const walls = new Uint8Array(N);
  for (const c of A.recursiveDivision(rows, cols, mulberry32(trial))) walls[c] = 1;
  const g = { rows, cols, walls, weights: new Uint8Array(N).fill(1) };
  const s = 1 * cols + 1;
  let rooms = 0, reachable = 0;
  for (let r = 1; r < rows; r += 2) for (let c = 1; c < cols; c += 2) {
    const i = r * cols + c; rooms++;
    if (!walls[i] && referenceSteps(g, s, i) !== Infinity) reachable++;
  }
  check(`maze ${trial} connected`, rooms === reachable, `${reachable}/${rooms}`);
}

console.log('3. Graph algorithms (step-through presets)');
const city = {
  directed: false,
  nodes: 'ABCDEFGH'.split('').map((id) => ({ id })),
  edges: [[0, 1, 4], [0, 2, 2], [1, 2, 1], [1, 3, 5], [2, 3, 8], [2, 5, 10], [3, 4, 2], [3, 5, 6], [1, 4, 10], [4, 6, 3], [5, 6, 2], [5, 7, 4], [6, 7, 1]],
};
const dj = A.graphDijkstra(city, 0), bf = A.bellmanFord(city, 0), fw = A.floydWarshall(city);
console.log('   City, from A — Dijkstra:', dj.dist.join(' '), '| steps:', dj.steps.length);
check('city dijkstra == bellman-ford', dj.dist.join() === bf.dist.join());
check('city dijkstra == floyd row A', dj.dist.join() === fw.dist[0].join());
check('city expected distances', dj.dist.join() === [0, 3, 2, 8, 10, 12, 13, 14].join());
check('city path A→H', A.graphPath(dj.prev, 0, 7).map((i) => city.nodes[i].id).join('') === 'ACBDEGH');

const neg = {
  directed: true,
  nodes: 'SABCT'.split('').map((id) => ({ id })),
  edges: [[0, 1, 2], [0, 2, 6], [2, 1, -5], [1, 3, 3], [3, 4, 2], [2, 4, 10]],
};
const ndj = A.graphDijkstra(neg, 0), nbf = A.bellmanFord(neg, 0);
console.log('   Negative, from S — Dijkstra:', ndj.dist.join(' '), '| Bellman–Ford:', nbf.dist.join(' '));
check('negative: dijkstra gives wrong T (7)', ndj.dist[4] === 7);
check('negative: bellman-ford correct T (6)', nbf.dist[4] === 6);
check('negative: no negative cycle', nbf.negativeCycle === false);
const cyc = { directed: true, nodes: 'XYZ'.split('').map((id) => ({ id })), edges: [[0, 1, 1], [1, 2, -2], [2, 1, 1]] };
check('negative cycle detected', A.bellmanFord(cyc, 0).negativeCycle === true);

console.log('4. Timing on a 200 × 200 grid (40,000 cells), 20% walls, 15% weights');
const big = makeGrid(200, 200, 0.2, 0.15, mulberry32(7));
// carve an open 3-cell-wide border so the two opposite corners are always connected
for (let k = 0; k < 200; k++) for (let w = 0; w < 3; w++) {
  big.walls[w * 200 + k] = 0; big.walls[k * 200 + (199 - w)] = 0;
}
const bs = 0, bt = 200 * 200 - 1;
console.log('   Reference optimum cost:', referenceCost(big, bs, bt));
const rows = [];
for (const name of Object.keys(A.GRID_ALGORITHMS)) {
  let ms = 0, r;
  for (let k = 0; k < 10; k++) { r = A.run(name, big, bs, bt); ms += r.ms; }
  rows.push({ algorithm: name, visited: r.visitedCount, steps: r.steps, cost: r.cost, avg_ms: +(ms / 10).toFixed(2) });
}
console.table(rows);

console.log(`\n${passed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
