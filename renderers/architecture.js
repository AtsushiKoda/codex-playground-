import { clamp01 } from "../model.js";

const svgNs = "http://www.w3.org/2000/svg";

const PROFILE_THEME_KEY = {
  entryCpu: "cpuServer",
  serverCpu: "cpuServer",
  gpuInferenceNode: "gpuNode"
};

const THEME_LAYOUTS = {
  cpuServer: {
    shells: [
      {
        key: "device",
        x: 36,
        y: 20,
        w: 648,
        h: 582,
        rx: 24,
        label: "CPU Server Chassis",
        detail: "Compute board + DIMM slots",
        style: { fill: "#0f1b2f", stroke: "#2f4b75", opacity: "0.95" },
        textStyle: { fill: "#8faed8", fontSize: "13px", fontWeight: "600" }
      },
      {
        key: "board",
        x: 72,
        y: 68,
        w: 576,
        h: 314,
        rx: 16,
        label: "Motherboard",
        style: { fill: "#0b2036", stroke: "#2d5f8c", opacity: "0.9" },
        textStyle: { fill: "#7cb4e8", fontSize: "12px", fontWeight: "600" }
      },
      {
        key: "dramModule",
        x: 252,
        y: 392,
        w: 216,
        h: 126,
        rx: 14,
        label: "DIMM Module",
        detail: "DDR DRAM",
        style: { fill: "#132a42", stroke: "#4978ad", opacity: "0.9" },
        textStyle: { fill: "#a6c6ea", fontSize: "11px" }
      }
    ],
    internalNodes: {
      compute: { x: 244, y: 98, w: 232, h: 72, label: "Compute", detail: "Core / Tensor" },
      l1: { x: 272, y: 188, w: 176, h: 58, label: "L1" },
      l2: { x: 272, y: 264, w: 176, h: 58, label: "L2" },
      l3: { x: 272, y: 340, w: 176, h: 58, label: "L3" },
      dram: { x: 260, y: 428, w: 200, h: 62, label: "DRAM" },
      ssd: { x: 260, y: 506, w: 200, h: 62, label: "SSD" }
    },
    busLinks: {
      computeToL1: { from: [360, 170], to: [360, 188], label: "on-chip" },
      l1ToL2: { from: [360, 246], to: [360, 264], label: "miss" },
      l2ToL3: { from: [360, 322], to: [360, 340], label: "miss" },
      l3ToDram: { from: [360, 398], to: [360, 428], label: "dramAccess" },
      dramToSsd: { from: [360, 490], to: [360, 506], label: "ssdAccess" }
    }
  },
  gpuNode: {
    shells: [
      {
        key: "device",
        x: 36,
        y: 20,
        w: 648,
        h: 582,
        rx: 24,
        label: "GPU Inference Node",
        detail: "GPU board + HBM package",
        style: { fill: "#101d2b", stroke: "#3a5d8d", opacity: "0.95" },
        textStyle: { fill: "#9abce6", fontSize: "13px", fontWeight: "600" }
      },
      {
        key: "board",
        x: 72,
        y: 68,
        w: 576,
        h: 314,
        rx: 16,
        label: "GPU Baseboard",
        style: { fill: "#0f2332", stroke: "#2f6d90", opacity: "0.9" },
        textStyle: { fill: "#84c0e5", fontSize: "12px", fontWeight: "600" }
      },
      {
        key: "dramModule",
        x: 244,
        y: 392,
        w: 232,
        h: 126,
        rx: 14,
        label: "HBM Stack",
        detail: "High-bandwidth DRAM",
        style: { fill: "#163042", stroke: "#4f89b5", opacity: "0.9" },
        textStyle: { fill: "#add4f0", fontSize: "11px" }
      }
    ],
    internalNodes: {
      compute: { x: 244, y: 98, w: 232, h: 72, label: "Compute", detail: "SM / Tensor" },
      l1: { x: 272, y: 188, w: 176, h: 58, label: "L1" },
      l2: { x: 272, y: 264, w: 176, h: 58, label: "L2" },
      l3: { x: 272, y: 340, w: 176, h: 58, label: "L3" },
      dram: { x: 260, y: 428, w: 200, h: 62, label: "DRAM" },
      ssd: { x: 260, y: 506, w: 200, h: 62, label: "SSD" }
    },
    busLinks: {
      computeToL1: { from: [360, 170], to: [360, 188], label: "on-chip" },
      l1ToL2: { from: [360, 246], to: [360, 264], label: "miss" },
      l2ToL3: { from: [360, 322], to: [360, 340], label: "miss" },
      l3ToDram: { from: [360, 398], to: [360, 428], label: "dramAccess" },
      dramToSsd: { from: [360, 490], to: [360, 506], label: "ssdAccess" }
    }
  }
};

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS(svgNs, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function applyStyles(el, style = {}) {
  Object.entries(style).forEach(([key, value]) => {
    el.style[key] = value;
  });
}

function makeNode({ x, y, w, h, label, detail = "", className = "arch-node", corner = 12, textClass = "arch-node-title", detailClass = "arch-node-detail" }) {
  const group = createSvgEl("g", { class: className });
  const rect = createSvgEl("rect", { x, y, width: w, height: h, rx: corner, ry: corner });
  const title = createSvgEl("text", {
    x: x + w / 2,
    y: y + h / 2 - (detail ? 8 : 0),
    "text-anchor": "middle",
    class: textClass
  });
  title.textContent = label;
  group.append(rect, title);

  if (detail) {
    const sub = createSvgEl("text", {
      x: x + w / 2,
      y: y + h / 2 + 14,
      "text-anchor": "middle",
      class: detailClass
    });
    sub.textContent = detail;
    group.appendChild(sub);
  }

  return { group, rect, title };
}

function makeDeviceShell(spec) {
  const shell = makeNode({
    x: spec.x,
    y: spec.y,
    w: spec.w,
    h: spec.h,
    label: spec.label,
    detail: spec.detail,
    className: "arch-device-shell",
    corner: spec.rx ?? 14,
    textClass: "arch-shell-title",
    detailClass: "arch-shell-detail"
  });

  applyStyles(shell.rect, spec.style);
  applyStyles(shell.title, spec.textStyle);

  return shell.group;
}

function makeInternalNode(spec) {
  return makeNode({
    x: spec.x,
    y: spec.y,
    w: spec.w,
    h: spec.h,
    label: spec.label,
    detail: spec.detail,
    className: "arch-node"
  }).group;
}

function makeBusLink(id, spec) {
  const [x1, y1] = spec.from;
  const [x2, y2] = spec.to;
  const isVertical = Math.abs(x1 - x2) < 14;
  const group = createSvgEl("g", { class: "arch-link-group" });
  const line = createSvgEl("line", {
    id,
    class: "arch-link",
    x1,
    y1,
    x2,
    y2,
    "marker-end": "url(#archArrow)"
  });
  const text = createSvgEl("text", {
    class: "arch-link-label",
    x: isVertical ? x1 + 42 : (x1 + x2) / 2,
    y: isVertical ? (y1 + y2) / 2 + 4 : (y1 + y2) / 2 - 8,
    "text-anchor": isVertical ? "start" : "middle"
  });
  text.textContent = spec.label;
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

  const shellLayer = createSvgEl("g", { id: "arch-shell-layer" });
  const internalLayer = createSvgEl("g", { id: "arch-internal-layer" });
  const linkLayer = createSvgEl("g", { id: "arch-link-layer" });

  svg.append(defs, shellLayer, internalLayer, linkLayer);

  const links = {};
  let currentThemeKey = "";

  function renderTheme(themeKey) {
    if (themeKey === currentThemeKey) return;

    currentThemeKey = themeKey;
    const layout = THEME_LAYOUTS[themeKey] ?? THEME_LAYOUTS.cpuServer;

    shellLayer.replaceChildren(...layout.shells.map((shell) => makeDeviceShell(shell)));

    internalLayer.replaceChildren(
      makeInternalNode(layout.internalNodes.compute),
      makeInternalNode(layout.internalNodes.l1),
      makeInternalNode(layout.internalNodes.l2),
      makeInternalNode(layout.internalNodes.l3),
      makeInternalNode(layout.internalNodes.dram),
      makeInternalNode(layout.internalNodes.ssd)
    );

    Object.keys(links).forEach((key) => delete links[key]);

    const nextLinks = {
      computeToL1: makeBusLink("arch-bus-compute-l1", layout.busLinks.computeToL1),
      l1ToL2: makeBusLink("arch-bus-l1-l2", layout.busLinks.l1ToL2),
      l2ToL3: makeBusLink("arch-bus-l2-l3", layout.busLinks.l2ToL3),
      l3ToDram: makeBusLink("arch-bus-l3-dram", layout.busLinks.l3ToDram),
      dramToSsd: makeBusLink("arch-bus-dram-ssd", layout.busLinks.dramToSsd)
    };

    Object.assign(links, nextLinks);
    linkLayer.replaceChildren(links.computeToL1.group, links.l1ToL2.group, links.l2ToL3.group, links.l3ToDram.group, links.dramToSsd.group);
  }

  function render({ dramAccess, ssdAccess, dramAccessRatioBase, focusedKey, hardwareProfileKey }) {
    const themeKey = PROFILE_THEME_KEY[hardwareProfileKey] ?? "cpuServer";
    renderTheme(themeKey);

    const dramRatio = clamp01(dramAccess / Math.max(dramAccessRatioBase, 1));
    const ssdRatio = clamp01(ssdAccess / Math.max(dramAccess, 1));

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

  return { render };
}
