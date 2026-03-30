import { fmtBytes, pct } from "../format.js";

export function createCacheRenderer({ tbody, cacheRowDefs }) {
  const rows = [];

  const fragment = document.createDocumentFragment();
  for (const def of cacheRowDefs) {
    const tr = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = def.label;
    const access = document.createElement("td");
    const hit = document.createElement("td");
    const miss = document.createElement("td");
    const latency = document.createElement("td");
    tr.append(name, access, hit, miss, latency);

    rows.push({ key: def.key, label: def.label, tr, access, hit, miss, latency, def });
    fragment.appendChild(tr);
  }
  tbody.replaceChildren(fragment);

  function render({ metrics, labelsToShow, focusedKey }) {
    for (const node of rows) {
      const isVisible = labelsToShow.has(node.label);
      node.tr.hidden = !isVisible;
      node.tr.classList.toggle("is-focused", isVisible && node.key === focusedKey);
      if (!isVisible) continue;

      const access = node.def.access(metrics);
      const hit = node.def.hit(metrics);
      const miss = node.def.miss(metrics);

      node.access.textContent = fmtBytes(access);
      node.hit.textContent = pct(hit);
      node.miss.textContent = pct(miss);
      node.miss.className = miss > 0.4 ? "bad" : miss > 0.2 ? "warn" : "good";
      node.latency.textContent = `${(node.def.latencyNs(metrics) / 1e6).toFixed(2)} ms`;
    }
  }

  return { render };
}
