# Shortest Path Finder & Algorithm Visualizer

Mini project for **Design and Analysis of Algorithms (DAA)**.

An interactive web application that visualizes how shortest-path and graph-search
algorithms explore a grid, and replays weighted-graph algorithms one relaxation at a time.

## Features

**Grid visualizer**
- 5 algorithms: Dijkstra, A* (Manhattan heuristic), Breadth-First Search, Depth-First Search, Greedy Best-First Search
- Draw walls and weighted cells (cost 5) with the mouse or a finger; drag start and target
- Maze generators: recursive division, random walls, random weights
- Animated exploration (frontier → visited → final path) with 5 speed levels
- Live recompute: after a run, dragging start/target updates the path instantly
- Statistics: nodes visited, path length, path cost, compute time, optimality check
- "Compare all five" table on the current board (25 runs each, averaged)

**Graph step-through**
- Dijkstra (array version, O(V²)) and Bellman–Ford (O(VE)) replayed step by step
- Live distance table, priority queue, relaxation log, shortest-path tree
- Negative-edge preset that shows exactly where Dijkstra goes wrong
- Floyd–Warshall all-pairs shortest-path matrix

## How to run

No installation or build step is needed.

1. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
2. That's it. (Fonts load from Google Fonts when online; system fonts are used offline.)

To run the automated tests (needs Node.js 16+):

```
node tests/test-algorithms.js
```

## Project structure

```
shortest-path-finder/
├── index.html                 Page layout (both views)
├── css/style.css              Styling, light and dark themes
├── js/algorithms.js           All algorithms + min-heap + maze generators (no DOM)
├── js/grid-visualizer.js      Canvas grid: drawing, editing, animation, stats, comparison
├── js/graph-visualizer.js     SVG graph: step-through for Dijkstra / Bellman–Ford, Floyd–Warshall
├── js/main.js                 Tab switching
└── tests/test-algorithms.js   5,300+ automated correctness checks and a timing benchmark
```

## Technologies

HTML5, CSS3, JavaScript (ES6), Canvas 2D API, SVG. No external libraries.

## Complexity summary (V = vertices/cells, E = edges)

| Algorithm | Time | Space | Weighted | Shortest path guaranteed |
|---|---|---|---|---|
| Dijkstra (binary heap) | O((V+E) log V) | O(V) | Yes (non-negative) | Yes |
| A* (admissible h) | O((V+E) log V) worst | O(V) | Yes | Yes |
| BFS | O(V+E) | O(V) | No | Only if unweighted |
| DFS | O(V+E) | O(V) | No | No |
| Greedy Best-First | O((V+E) log V) | O(V) | No | No |
| Dijkstra (array) | O(V²) | O(V) | Yes (non-negative) | Yes |
| Bellman–Ford | O(VE) | O(V) | Yes (negative allowed) | Yes, detects negative cycles |
| Floyd–Warshall | O(V³) | O(V²) | Yes (negative allowed) | Yes, all pairs |
