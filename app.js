const results = [
  { node: 'core', label: 'Core', access: 920, missRate: 0.03 },
  { node: 'l1', label: 'L1', access: 840, missRate: 0.08 },
  { node: 'l2', label: 'L2', access: 510, missRate: 0.21 },
  { node: 'l3', label: 'L3', access: 330, missRate: 0.36 },
  { node: 'dram', label: 'DRAM', access: 220, missRate: 0.48 },
  { node: 'ssd', label: 'SSD', access: 80, missRate: 0.74 }
];

const flowBars = document.getElementById('flowBars');
const resultRows = document.getElementById('resultRows');
const svgNodes = Array.from(document.querySelectorAll('[data-node]'));

const byNode = new Map(results.map((r) => [r.node, r]));
const maxAccess = Math.max(...results.map((r) => r.access));

function getLevel(missRate) {
  if (missRate < 0.15) return 'good';
  if (missRate < 0.4) return 'warn';
  return 'bad';
}

function render() {
  results.forEach((entry) => {
    const missPercent = Math.round(entry.missRate * 100);
    const intensity = 20 + Math.round((entry.access / maxAccess) * 70);
    const level = getLevel(entry.missRate);

    const bar = document.createElement('div');
    bar.className = `flow-bar ${level}`;
    bar.dataset.node = entry.node;
    bar.innerHTML = `
      <div class="flow-fill" style="width:${Math.round((entry.access / maxAccess) * 100)}%;--intensity:${intensity}%"></div>
      <span class="flow-label">${entry.label} / miss ${missPercent}%</span>
    `;
    flowBars.appendChild(bar);

    const row = document.createElement('tr');
    row.dataset.node = entry.node;
    row.innerHTML = `<td>${entry.label}</td><td>${entry.access}</td><td>${missPercent}%</td>`;
    resultRows.appendChild(row);
  });
}

function bindSvgLoad() {
  svgNodes.forEach((nodeEl) => {
    const nodeKey = nodeEl.dataset.node;
    const data = byNode.get(nodeKey);
    if (!data) return;

    const level = getLevel(data.missRate);
    const intensity = 15 + Math.round((data.access / maxAccess) * 75);

    nodeEl.classList.add(level);
    nodeEl.style.setProperty('--intensity', `${intensity}%`);
    nodeEl.setAttribute(
      'aria-label',
      `${data.label}: access ${data.access}, miss rate ${Math.round(data.missRate * 100)}%`
    );
  });
}

function setActive(nodeKey) {
  document.querySelectorAll('[data-node]').forEach((el) => {
    el.classList.toggle('active', el.dataset.node === nodeKey);
  });
  document.querySelectorAll('tr[data-node]').forEach((row) => {
    row.classList.toggle('active', row.dataset.node === nodeKey);
  });
}

function clearActive() {
  document.querySelectorAll('.active').forEach((el) => el.classList.remove('active'));
}

function wireInteractions() {
  document.querySelectorAll('.flow-bar').forEach((bar) => {
    bar.addEventListener('mouseenter', () => setActive(bar.dataset.node));
    bar.addEventListener('mouseleave', clearActive);
  });

  svgNodes.forEach((nodeEl) => {
    nodeEl.addEventListener('mouseenter', () => setActive(nodeEl.dataset.node));
    nodeEl.addEventListener('mouseleave', clearActive);
  });
}

render();
bindSvgLoad();
wireInteractions();
