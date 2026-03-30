import { clamp01 } from "../model.js";

const svgNs = "http://www.w3.org/2000/svg";

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS(svgNs, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function makeNode(x, y, w, h, label, detail = "") {
  const group = createSvgEl("g", { class: "arch-node" });
  const rect = createSvgEl("rect", { x, y, width: w, height: h, rx: 12, ry: 12 });
  const title = createSvgEl("text", {
    x: x + w / 2,
    y: y + h / 2 - (detail ? 8 : 0),
    "text-anchor": "middle",
    class: "arch-node-title"
  });
  title.textContent = label;
  group.append(rect, title);

  if (detail) {
    const sub = createSvgEl("text", {
      x: x + w / 2,
      y: y + h / 2 + 14,
      "text-anchor": "middle",
      class: "arch-node-detail"
    });
    sub.textContent = detail;
    group.appendChild(sub);
  }

  return group;
}

function makeLink(id, x1, y1, x2, y2, label) {
  const group = createSvgEl("g", { class: "arch-link-group" });
  const line = createSvgEl("line", { id, class: "arch-link", x1, y1, x2, y2, "marker-end": "url(#archArrow)" });
  const text = createSvgEl("text", {
    class: "arch-link-label",
    x: (Number(x1) + Number(x2)) / 2,
    y: (Number(y1) + Number(y2)) / 2 - 8,
    "text-anchor": "middle"
  });
  text.textContent = label;
  group.append(line, text);
  return { line, text, group };
}

export function createArchitectureRenderer({ svg }) {
  svg.replaceChildren();

  const defs = createSvgEl("defs");
  const marker = createSvgEl("marker", {
    id: "archArrow",
    viewBox: "0 0 10 10",
    refX: "9",
    refY: "5",
    markerWidth: "8",
    markerHeight: "8",
    orient: "auto-start-reverse"
  });
  marker.appendChild(createSvgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "currentColor" }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  svg.append(
    makeNode(60, 110, 140, 90, "Compute", "Core / Tensor"),
    makeNode(260, 45, 120, 70, "L1"),
    makeNode(260, 130, 120, 70, "L2"),
    makeNode(260, 215, 120, 70, "L3"),
    makeNode(520, 90, 150, 90, "DRAM"),
    makeNode(760, 90, 140, 90, "SSD")
  );

  const links = {
    computeToL1: makeLink("linkComputeL1", 200, 135, 260, 80, "on-chip"),
    l1ToL2: makeLink("linkL1L2", 320, 115, 320, 130, "miss"),
    l2ToL3: makeLink("linkL2L3", 320, 200, 320, 215, "miss"),
    l3ToDram: makeLink("linkL3Dram", 380, 250, 520, 145, "dramAccess"),
    dramToSsd: makeLink("linkDramSsd", 670, 135, 760, 135, "ssdAccess")
  };

  svg.append(links.computeToL1.group, links.l1ToL2.group, links.l2ToL3.group, links.l3ToDram.group, links.dramToSsd.group);

  function update({ metrics, weightBytes, focusedKey }) {
    const dramRatio = clamp01(metrics.dramAccess / Math.max(weightBytes * 0.000005, 1));
    const ssdRatio = clamp01(metrics.ssdAccess / Math.max(metrics.dramAccess, 1));

    const updateLinkStyle = (entry, ratio, baseLabel) => {
      entry.line.style.strokeWidth = `${2 + ratio * 10}`;
      entry.line.classList.toggle("arch-link--hot", ratio > 0.35);
      entry.text.textContent = `${baseLabel} ${Math.round(ratio * 100)}%`;
    };

    updateLinkStyle(links.l3ToDram, dramRatio, "dramAccess");
    updateLinkStyle(links.dramToSsd, ssdRatio, "ssdAccess");

    links.computeToL1.line.classList.toggle("arch-link--hot", focusedKey === "l1Access");
    links.l1ToL2.line.classList.toggle("arch-link--hot", focusedKey === "l2Access");
    links.l2ToL3.line.classList.toggle("arch-link--hot", focusedKey === "l3Access");
    links.l3ToDram.line.classList.toggle("arch-link--hot", focusedKey === "dramAccess" || dramRatio > 0.35);
    links.dramToSsd.line.classList.toggle("arch-link--hot", focusedKey === "ssdAccess" || ssdRatio > 0.35);
  }

  return { update };
}
