import { fmtBytes } from "../format.js";

export function createFlowRenderer({ container, flowRowDefs }) {
  const nodes = [];

  const fragment = document.createDocumentFragment();
  for (const def of flowRowDefs) {
    const row = document.createElement("div");
    row.className = "flow-row";

    const title = document.createElement("strong");
    title.textContent = def.label;

    const barWrap = document.createElement("div");
    barWrap.className = "bar-wrap";
    const bar = document.createElement("div");
    bar.className = "bar";
    barWrap.appendChild(bar);

    const value = document.createElement("span");
    row.append(title, barWrap, value);

    nodes.push({ key: def.key, row, bar, value });
    fragment.appendChild(row);
  }
  container.replaceChildren(fragment);

  function update({ metrics, keysToShow, focusedKey }) {
    const maxV = Math.max(
      ...flowRowDefs.filter((def) => keysToShow.has(def.key)).map((def) => metrics[def.key]),
      1
    );

    for (const node of nodes) {
      const isVisible = keysToShow.has(node.key);
      node.row.hidden = !isVisible;
      node.row.classList.toggle("is-focused", isVisible && node.key === focusedKey);
      if (!isVisible) continue;

      const value = metrics[node.key];
      node.bar.style.width = `${(value / maxV) * 100}%`;
      node.value.textContent = fmtBytes(value);
    }
  }

  return { update };
}
