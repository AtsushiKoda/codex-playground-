const svgNs = "http://www.w3.org/2000/svg";

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS(svgNs, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

const STEPS = [
  { key: "l1Access", title: "Prefill", detail: "prompt埋め込みと初期文脈展開" },
  { key: "l2Access", title: "Decode", detail: "1 tokenずつ反復計算" },
  { key: "l3Access", title: "KV参照", detail: "過去tokenのKey/Value探索" },
  { key: "dramAccess", title: "Projection", detail: "QKV/FFN線形変換" },
  { key: "ssdAccess", title: "Weight Offload", detail: "不足重みのI/O読み戻し" }
];

export function createInferencePipelineRenderer({ svg }) {
  svg.replaceChildren();

  const defs = createSvgEl("defs");
  const marker = createSvgEl("marker", {
    id: "inferenceArrow",
    viewBox: "0 0 10 10",
    refX: "9",
    refY: "5",
    markerWidth: "8",
    markerHeight: "8",
    orient: "auto-start-reverse"
  });
  marker.appendChild(createSvgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "currentColor" }));
  defs.appendChild(marker);

  const linkLayer = createSvgEl("g", { class: "inf-link-layer" });
  const nodeLayer = createSvgEl("g", { class: "inf-node-layer" });
  svg.append(defs, linkLayer, nodeLayer);

  const stepNodes = {};
  const links = [];

  const startX = 30;
  const y = 72;
  const width = 155;
  const height = 96;
  const gap = 28;

  STEPS.forEach((step, index) => {
    const x = startX + index * (width + gap);
    const group = createSvgEl("g", { class: "inf-node-group" });
    const rect = createSvgEl("rect", { x, y, width, height, rx: 14, ry: 14, class: "inf-node" });
    const title = createSvgEl("text", {
      x: x + width / 2,
      y: y + 38,
      class: "inf-node-title",
      "text-anchor": "middle"
    });
    title.textContent = step.title;

    const detail = createSvgEl("text", {
      x: x + width / 2,
      y: y + 60,
      class: "inf-node-detail",
      "text-anchor": "middle"
    });
    detail.textContent = step.detail;

    group.append(rect, title, detail);
    nodeLayer.appendChild(group);
    stepNodes[step.key] = group;

    if (index < STEPS.length - 1) {
      const x1 = x + width;
      const x2 = x + width + gap - 8;
      const line = createSvgEl("line", {
        x1,
        y1: y + height / 2,
        x2,
        y2: y + height / 2,
        class: "inf-link",
        "marker-end": "url(#inferenceArrow)"
      });
      linkLayer.appendChild(line);
      links.push(line);
    }
  });

  function render({ focusedKey, scope }) {
    for (const step of STEPS) {
      stepNodes[step.key]?.classList.toggle("is-focused", step.key === focusedKey);
    }

    for (const link of links) {
      link.classList.toggle("is-micro", scope === "micro");
      link.classList.toggle("is-meso", scope === "meso");
    }
  }

  return { render };
}
