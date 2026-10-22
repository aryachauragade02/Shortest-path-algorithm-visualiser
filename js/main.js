/* Tab switching between the grid visualizer and the graph step-through. */
(function () {
  'use strict';
  const tabs = document.querySelectorAll('[role="tab"]');
  function select(name) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      document.getElementById('tab-' + t.dataset.tab).hidden = !on;
    });
    if (name !== 'graph' && window.GraphVisualizer) window.GraphVisualizer.pause();
  }
  tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.tab)));
  if (location.hash === '#graph') select('graph');
})();
