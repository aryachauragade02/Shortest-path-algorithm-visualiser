/*
 * Graph step-through: weighted graph drawn in SVG, with Dijkstra and
 * Bellman–Ford replayed one relaxation at a time, plus a Floyd–Warshall matrix.
 */
(function () {
  'use strict';
  const A = window.PathAlgorithms;
  const $ = (id) => document.getElementById(id);
  const fmt = A.fmt;

  const PRESETS = {
    city: {
      directed: false,
      defaultSrc: 0, defaultTgt: 7,
      nodes: [
        { id: 'A', x: 60, y: 190 }, { id: 'B', x: 190, y: 75 }, { id: 'C', x: 190, y: 305 },
        { id: 'D', x: 345, y: 190 }, { id: 'E', x: 495, y: 75 }, { id: 'F', x: 495, y: 305 },
        { id: 'G', x: 640, y: 120 }, { id: 'H', x: 640, y: 300 },
      ],
      edges: [
        [0, 1, 4], [0, 2, 2], [1, 2, 1], [1, 3, 5], [2, 3, 8], [2, 5, 10],
        [3, 4, 2], [3, 5, 6], [1, 4, 10], [4, 6, 3], [5, 6, 2], [5, 7, 4], [6, 7, 1],
      ],
    },
    negative: {
      directed: true,
      defaultSrc: 0, defaultTgt: 4,
      nodes: [
        { id: 'S', x: 80, y: 190 }, { id: 'A', x: 320, y: 80 }, { id: 'B', x: 320, y: 300 },
        { id: 'C', x: 560, y: 80 }, { id: 'T', x: 625, y: 280 },
      ],
      edges: [[0, 1, 2], [0, 2, 6], [2, 1, -5], [1, 3, 3], [3, 4, 2], [2, 4, 10]],
    },
  };

  let presetKey = 'city', algo = 'dijkstra', src = 0, tgt = 7;
  let result = null, step = 0, timer = null;
  const R = 22;

  function graph() { return PRESETS[presetKey]; }

  function fillSelectors() {
    const g = graph();
    const opts = g.nodes.map((n, i) => `<option value="${i}">${n.id}</option>`).join('');
    $('gSrc').innerHTML = opts; $('gTgt').innerHTML = opts;
    src = g.defaultSrc; tgt = g.defaultTgt;
    $('gSrc').value = src; $('gTgt').value = tgt;
  }

  function compute() {
    pause();
    const g = graph();
    result = algo === 'dijkstra' ? A.graphDijkstra(g, src) : A.bellmanFord(g, src);
    step = 0;
    render();
    renderMatrix();
  }

  /* ---------------- SVG ---------------- */
  function edgeGeom(g, u, v) {
    const a = g.nodes[u], b = g.nodes[v];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const endGap = g.directed ? R + 7 : R;
    return {
      x1: a.x + ux * R, y1: a.y + uy * R,
      x2: b.x - ux * endGap, y2: b.y - uy * endGap,
      mx: (a.x + b.x) / 2 - uy * 14, my: (a.y + b.y) / 2 + ux * 14,
    };
  }

  function render() {
    const g = graph();
    const s = result.steps[step];
    const prevSnap = step > 0 ? result.steps[step - 1] : null;
    const final = !!s.final;
    const path = final ? A.graphPath(s.prev, src, tgt) : [];
    const onPath = new Set();
    for (let k = 1; k < path.length; k++) onPath.add(path[k - 1] + '-' + path[k]);

    let svg = '<defs>';
    for (const k of ['base', 'tree', 'path', 'update', 'keep', 'skip']) {
      svg += `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path class="ah ${k === 'base' ? '' : k}" d="M0,0 L10,5 L0,10 z"/></marker>`;
    }
    svg += '</defs>';

    let labels = '';
    for (const [u, v, w] of g.edges) {
      const geo = edgeGeom(g, u, v);
      const isRelax = s.edge && ((s.edge[0] === u && s.edge[1] === v) || (!g.directed && s.edge[0] === v && s.edge[1] === u));
      const isTree = s.prev[v] === u || (!g.directed && s.prev[u] === v);
      const isPath = onPath.has(u + '-' + v) || (!g.directed && onPath.has(v + '-' + u));
      let cls = 'e', mk = 'base';
      if (isPath) { cls += ' path'; mk = 'path'; }
      else if (isRelax) { cls += ' relax ' + s.outcome; mk = s.outcome; }
      else if (isTree) { cls += ' tree'; mk = 'tree'; }
      // for an undirected edge being relaxed "backwards", draw the line in that direction
      let { x1, y1, x2, y2 } = geo;
      if (isRelax && !g.directed && s.edge[0] === v) { const p = edgeGeom(g, v, u); x1 = p.x1; y1 = p.y1; x2 = p.x2; y2 = p.y2; }
      const marker = g.directed ? ` marker-end="url(#ah-${mk})"` : '';
      svg += `<line class="${cls}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"${marker}/>`;
      labels += `<text class="w${w < 0 ? ' neg' : ''}" x="${geo.mx.toFixed(1)}" y="${geo.my.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${w}</text>`;
    }
    svg += labels;

    g.nodes.forEach((n, i) => {
      let cls = 'n';
      if (s.done) { if (s.done[i]) cls += ' done'; else if (s.dist[i] < Infinity) cls += ' queued'; }
      else if (s.dist[i] < Infinity) cls += ' reached';
      if (s.cur === i) cls += ' cur';
      if (i === src) cls += ' src';
      if (i === tgt) cls += ' tgt';
      const changed = prevSnap && prevSnap.dist[i] !== s.dist[i];
      const dy = n.y < 190 ? -R - 10 : R + 20;
      svg += `<g class="${cls}"><circle cx="${n.x}" cy="${n.y}" r="${R}"/><text class="id" x="${n.x}" y="${n.y}">${n.id}</text>` +
        `<text class="d${changed ? ' changed' : ''}" x="${n.x}" y="${n.y + dy}">d=${fmt(s.dist[i])}</text></g>`;
    });
    $('graph').innerHTML = svg;

    // log and counters
    const log = $('gLog');
    log.textContent = s.msg;
    log.classList.toggle('warn', s.outcome === 'skip' && /lost/.test(s.msg) || (final && result.negativeCycle));
    $('gCount').textContent = `Step ${step + 1} / ${result.steps.length}`;
    $('gPrev').disabled = $('gFirst').disabled = step === 0;
    $('gNext').disabled = $('gLast').disabled = step === result.steps.length - 1;

    // queue / pass panel
    const L = (i) => g.nodes[i].id;
    if (algo === 'dijkstra') {
      $('gQueueTitle').textContent = 'Priority queue Q (ordered by d)';
      const q = g.nodes.map((_, i) => i).filter((i) => !s.done[i] && s.dist[i] < Infinity).sort((a, b) => s.dist[a] - s.dist[b]);
      const unreached = g.nodes.filter((_, i) => !s.done[i] && s.dist[i] === Infinity).length;
      $('gQueue').innerHTML = (q.length ? q.map((i) => `<span class="q">${L(i)} : ${s.dist[i]}</span>`).join('') : '<span class="muted">Empty</span>') +
        (unreached ? `<span class="muted">+ ${unreached} at ∞</span>` : '');
    } else {
      $('gQueueTitle').textContent = 'Bellman–Ford progress';
      const n = g.nodes.length;
      $('gQueue').innerHTML = `<span class="q">Pass ${s.pass || 0} of ${n - 1}</span><span class="muted">${g.directed ? g.edges.length : g.edges.length * 2} edge relaxations per pass</span>`;
    }

    // distance table
    $('gTable').innerHTML = g.nodes.map((nd, i) => {
      const changed = prevSnap && prevSnap.dist[i] !== s.dist[i];
      let state;
      if (s.done) state = s.done[i] ? '<span class="state final">Final</span>' : s.dist[i] < Infinity ? '<span class="state">In Q</span>' : '<span class="state">Unreached</span>';
      else state = s.dist[i] < Infinity ? (final ? '<span class="state final">Final</span>' : '<span class="state">Reached</span>') : '<span class="state">∞</span>';
      return `<tr class="${changed ? 'changed' : ''} ${s.cur === i ? 'cur' : ''}"><td>${nd.id}</td><td>${fmt(s.dist[i])}</td><td>${s.prev[i] === -1 ? '—' : L(s.prev[i])}</td><td>${state}</td></tr>`;
    }).join('');

    // result line
    const res = $('gResult');
    res.className = 'result-line';
    if (!final) { res.textContent = ''; return; }
    if (result.negativeCycle) { res.textContent = 'Negative cycle detected: no shortest path is defined.'; res.classList.add('bad'); return; }
    if (!path.length) { res.textContent = `${L(tgt)} is not reachable from ${L(src)}.`; return; }
    const truth = A.bellmanFord(g, src).dist[tgt];
    let html = `Shortest path ${L(src)} → ${L(tgt)}: <strong>${path.map(L).join(' → ')}</strong>, cost <strong>${s.dist[tgt]}</strong>.`;
    if (s.dist[tgt] !== truth) {
      html += ` This is wrong: the true shortest cost is ${truth}. Dijkstra assumes non-negative weights. Switch to Bellman–Ford to see the correct answer.`;
      res.classList.add('bad');
    }
    res.innerHTML = html;
  }

  function renderMatrix() {
    const g = graph();
    const { dist } = A.floydWarshall(g);
    let h = '<thead><tr><th></th>' + g.nodes.map((n) => `<th>${n.id}</th>`).join('') + '</tr></thead><tbody>';
    dist.forEach((row, i) => {
      h += `<tr><th>${g.nodes[i].id}</th>` + row.map((d, j) =>
        `<td class="${d === Infinity ? 'inf' : i === j ? 'zero' : ''}">${fmt(d)}</td>`).join('') + '</tr>';
    });
    $('fwMatrix').innerHTML = h + '</tbody>';
  }

  /* ---------------- Controls ---------------- */
  function go(k) { step = Math.max(0, Math.min(result.steps.length - 1, k)); render(); }
  function pause() { if (timer) { clearInterval(timer); timer = null; } $('gPlay').textContent = 'Play'; }
  function play() {
    if (step >= result.steps.length - 1) step = 0;
    $('gPlay').textContent = 'Pause';
    timer = setInterval(() => {
      if (step >= result.steps.length - 1) { pause(); return; }
      go(step + 1);
    }, 900);
    render();
  }

  $('gPreset').addEventListener('change', (e) => { presetKey = e.target.value; fillSelectors(); compute(); });
  $('gAlgo').addEventListener('change', (e) => { algo = e.target.value; compute(); });
  $('gSrc').addEventListener('change', (e) => { src = +e.target.value; compute(); });
  $('gTgt').addEventListener('change', (e) => { tgt = +e.target.value; render(); });
  $('gFirst').addEventListener('click', () => { pause(); go(0); });
  $('gPrev').addEventListener('click', () => { pause(); go(step - 1); });
  $('gNext').addEventListener('click', () => { pause(); go(step + 1); });
  $('gLast').addEventListener('click', () => { pause(); go(result.steps.length - 1); });
  $('gPlay').addEventListener('click', () => (timer ? pause() : play()));
  document.addEventListener('keydown', (e) => {
    if ($('tab-graph').hidden || /SELECT|INPUT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') { pause(); go(step + 1); }
    if (e.key === 'ArrowLeft') { pause(); go(step - 1); }
  });

  fillSelectors();
  compute();
  window.GraphVisualizer = { pause };
})();
