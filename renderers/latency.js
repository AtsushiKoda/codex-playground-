import { clamp01 } from "../model.js";

const latencyBreakdownDefs = [
  { key: "l1WaitMs", label: "L1", className: "latency-chip--l1" },
  { key: "l2WaitMs", label: "L2", className: "latency-chip--l2" },
  { key: "l3WaitMs", label: "L3", className: "latency-chip--l3" },
  { key: "dramWaitMs", label: "DRAM", className: "latency-chip--dram" },
  { key: "ssdWaitMs", label: "SSD", className: "latency-chip--ssd" }
];

export function createLatencyRenderer({ container, whyText }) {
  const rows = [];
  const fragment = document.createDocumentFragment();

  for (const def of latencyBreakdownDefs) {
    const row = document.createElement("div");
    row.className = "latency-row";

    const label = document.createElement("strong");
    label.textContent = def.label;

    const barWrap = document.createElement("div");
    barWrap.className = "latency-row__bar-wrap";
    const bar = document.createElement("div");
    bar.className = `latency-row__bar ${def.className}`;
    barWrap.appendChild(bar);

    const value = document.createElement("span");
    value.className = "latency-row__value";

    row.append(label, barWrap, value);
    rows.push({ key: def.key, label: def.label, bar, value });
    fragment.appendChild(row);
  }

  container.replaceChildren(fragment);

  function render({ metrics }) {
    const total = Math.max(metrics.decodeLatencyMs, 1e-9);
    let topContributor = { label: "L1", valueMs: 0, ratio: 0 };

    for (const node of rows) {
      const valueMs = metrics[node.key];
      const ratio = clamp01(valueMs / total);
      node.bar.style.width = `${Math.max(3, ratio * 100)}%`;
      node.value.textContent = `${valueMs.toFixed(3)} ms (${(ratio * 100).toFixed(1)}%)`;
      if (valueMs > topContributor.valueMs) {
        topContributor = { label: node.label, valueMs, ratio };
      }
    }

    const reasons = [];
    if (metrics.l3Miss > 0.3) reasons.push(`L3 miss率 ${(metrics.l3Miss * 100).toFixed(1)}% が高くDRAM遷移が増加`);
    if (metrics.ssdWaitMs > metrics.decodeLatencyMs * 0.2) reasons.push(`SSD待ちが ${(metrics.ssdWaitMs / metrics.decodeLatencyMs * 100).toFixed(1)}% を占有`);
    if (reasons.length === 0) reasons.push("オンチップ（L1/L2/L3）再利用が効いて下位メモリ依存は限定的");

    whyText.textContent = `主因: ${topContributor.label} が ${(topContributor.ratio * 100).toFixed(1)}%。理由: ${reasons.join(" / ")}。`;
  }

  return { render };
}
