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
        x: 30,
        y: 24,
        w: 890,
        h: 270,
        rx: 24,
        label: "CPU Server Chassis",
        detail: "Compute board + DIMM slots",
        style: { fill: "#0f1b2f", stroke: "#2f4b75", opacity: "0.95" },
        textStyle: { fill: "#8faed8", fontSize: "13px", fontWeight: "600" }
      },
      {
        key: "board",
        x: 48,
        y: 56,
        w: 540,
        h: 206,
        rx: 16,
        label: "Motherboard",
        style: { fill: "#0b2036", stroke: "#2d5f8c", opacity: "0.9" },
        textStyle: { fill: "#7cb4e8", fontSize: "12px", fontWeight: "600" }
      },
      {
        key: "dramModule",
        x: 508,
        y: 72,
        w: 184,
        h: 126,
        rx: 14,
        label: "DIMM Module",
        detail: "DDR DRAM",
        style: { fill: "#132a42", stroke: "#4978ad", opacity: "0.9" },
        textStyle: { fill: "#a6c6ea", fontSize: "11px" }
      }
    ],
    internalNodes: {
      compute: { x: 96, y: 116, w: 140, h: 90, label: "Compute", detail: "Core / Tensor" },
      l1: { x: 276, y: 52, w: 120, h: 70, label: "L1" },
      l2: { x: 276, y: 137, w: 120, h: 70, label: "L2" },
      l3: { x: 276, y: 222, w: 120, h: 70, label: "L3" },
      dram: { x: 520, y: 90, w: 150, h: 90, label: "DRAM" },
      ssd: { x: 760, y: 90, w: 140, h: 90, label: "SSD" }
    },
    busLinks: {
      computeToL1: { from: [236, 141], to: [276, 87], label: "on-chip" },
      l1ToL2: { from: [336, 122], to: [336, 137], label: "miss" },
      l2ToL3: { from: [336, 207], to: [336, 222], label: "miss" },
      l3ToDram: { from: [396, 257], to: [520, 145], label: "dramAccess" },
      dramToSsd: { from: [670, 135], to: [760, 135], label: "ssdAccess" }
    }
  },
  gpuNode: {
    shells: [
      {
        key: "device",
        x: 30,
        y: 24,
        w: 890,
        h: 270,
        rx: 24,
        label: "GPU Inference Node",
        detail: "GPU board + HBM package",
        style: { fill: "#101d2b", stroke: "#3a5d8d", opacity: "0.95" },
        textStyle: { fill: "#9abce6", fontSize: "13px", fontWeight: "600" }
      },
      {
        key: "board",
        x: 60,
        y: 64,
        w: 590,
        h: 188,
        rx: 16,
        label: "GPU Baseboard",
        style: { fill: "#0f2332", stroke: "#2f6d90", opacity: "0.9" },
        textStyle: { fill: "#84c0e5", fontSize: "12px", fontWeight: "600" }
      },
      {
        key: "dramModule",
        x: 488,
        y: 84,
        w: 214,
        h: 116,
        rx: 14,
        label: "HBM Stack",
        detail: "High-bandwidth DRAM",
        style: { fill: "#163042", stroke: "#4f89b5", opacity: "0.9" },
        textStyle: { fill: "#add4f0", fontSize: "11px" }
      }
    ],
    internalNodes: {
      compute: { x: 126, y: 116, w: 180, h: 90, label: "Compute", detail: "SM / Tensor" },
      l1: { x: 334, y: 52, w: 122, h: 70, label: "L1" },
      l2: { x: 334, y: 137, w: 122, h: 70, label: "L2" },
      l3: { x: 334, y: 222, w: 122, h: 70, label: "L3" },
      dram: { x: 548, y: 90, w: 152, h: 90, label: "DRAM" },
      ssd: { x: 760, y: 90, w: 140, h: 90, label: "SSD" }
    },
    busLinks: {
      computeToL1: { from: [306, 141], to: [334, 87], label: "on-chip" },
      l1ToL2: { from: [395, 122], to: [395, 137], label: "miss" },
      l2ToL3: { from: [395, 207], to: [395, 222], label: "miss" },
      l3ToDram: { from: [456, 257], to: [548, 145], label: "dramAccess" },
      dramToSsd: { from: [700, 135], to: [760, 135], label: "ssdAccess" }
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
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2 - 8,
    "text-anchor": "middle"
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
