const ids = [
  "modelSize", "contextLen", "batchSize", "quantBits",
  "l1Size", "l2Size", "l3Size", "dramBw", "ssdBw", "offloadRate"
];

const fmt = new Intl.NumberFormat("ja-JP");
const svgNs = "http://www.w3.org/2000/svg";

const inputs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const outputs = Object.fromEntries(ids.map((id) => [id, document.getElementById(`${id}Out`)]));

const ui = {
  ttft: document.getElementById("ttft"),
  decodeLatency: document.getElementById("decodeLatency"),
  throughput: document.getElementById("throughput"),
  bottleneck: document.getElementById("bottleneck"),
  flowBars: document.getElementById("flowBars"),
  cacheTableBody: document.getElementById("cacheTableBody"),
  narrative: document.getElementById("narrative"),
  modelRationaleList: document.getElementById("modelRationaleList"),
  archDiagram: document.getElementById("archDiagram"),
  scopeButtons: Array.from(document.querySelectorAll(".scope-btn")),
  cacheStatsPanel: document.querySelector(".cache-stats"),
  focusPrev: document.getElementById("focusPrev"),
  focusNext: document.getElementById("focusNext"),
  focusStepLabel: document.getElementById("focusStepLabel"),
  hardwareProfile: document.getElementById("hardwareProfile")
};

const hardwareProfiles = {
  entryCpu: {
    l1Size: 64,
    l2Size: 2,
    l3Size: 24,
    dramBw: 80,
    ssdBw: 3,
    offloadRate: 20
  },
  serverCpu: {
    l1Size: 96,
    l2Size: 4,
    l3Size: 64,
    dramBw: 220,
    ssdBw: 8,
    offloadRate: 10
  },
  gpuInferenceNode: {
    l1Size: 128,
    l2Size: 8,
    l3Size: 96,
    dramBw: 360,
    ssdBw: 14,
    offloadRate: 5
  }
};

const flowRowDefs = [
  { key: "l1Access", label: "L1" },
  { key: "l2Access", label: "L2" },
  { key: "l3Access", label: "L3" },
  { key: "dramAccess", label: "DRAM" },
  { key: "ssdAccess", label: "SSD" }
];

const cacheRowDefs = [
  {
    key: "l1Access",
    label: "L1 (SRAM)",
    access: (m) => m.l1Access,
    hit: (m) => m.l1Hit,
    miss: (m) => m.l1Miss,
    latencyNs: (m) => m.l1Access / 64 * 1.2
  },
  {
    key: "l2Access",
    label: "L2 (SRAM)",
    access: (m) => m.l2Access,
    hit: (m) => 1 - (m.l2Miss / Math.max(m.l1Miss, 1e-6)),
    miss: (m) => m.l2Miss / Math.max(m.l1Miss, 1e-6),
    latencyNs: (m) => m.l2Access / 64 * 4.8
  },
  {
    key: "l3Access",
    label: "L3 (SRAM)",
    access: (m) => m.l3Access,
    hit: (m) => 1 - (m.l3Miss / Math.max(m.l2Miss, 1e-6)),
    miss: (m) => m.l3Miss / Math.max(m.l2Miss, 1e-6),
    latencyNs: (m) => m.l3Access / 64 * 16
  },
  {
    key: "dramAccess",
    label: "DRAM",
    access: (m) => m.dramAccess,
    hit: (m) => 1 - m.l3Miss,
    miss: (m) => m.l3Miss,
    latencyNs: (m) => m.dramAccess / 64 * 85
  },
  {
    key: "ssdAccess",
    label: "SSD",
    access: (m) => m.ssdAccess,
    hit: (m) => 1 - Math.min(1, m.ssdAccess / (m.dramAccess + 1e-6)),
    miss: (m) => Math.min(1, m.ssdAccess / (m.dramAccess + 1e-6)),
    latencyNs: (m) => m.ssdAccess / 4096 * 80000
  }
];

const flowRowNodes = [];
const cacheRowNodes = [];
let archLinks = null;
let scopeLevel = "macro";
let focusStepIndex = 0;

const scopeConfig = {
  macro: {
    flowKeys: new Set(["dramAccess", "ssdAccess"]),
    cacheLabels: new Set(["DRAM", "SSD"]),
    showCachePanel: false
  },
  meso: {
    flowKeys: new Set(["l1Access", "l2Access", "l3Access", "dramAccess"]),
    cacheLabels: new Set(["L1 (SRAM)", "L2 (SRAM)", "L3 (SRAM)", "DRAM"]),
    showCachePanel: true
  },
  micro: {
    flowKeys: new Set(["l1Access", "l2Access", "l3Access", "dramAccess", "ssdAccess"]),
    cacheLabels: new Set(cacheRowDefs.map((def) => def.label)),
    showCachePanel: true
  }
};

const stepLabels = {
  l1Access: "L1 フォーカス",
  l2Access: "L2 フォーカス",
  l3Access: "L3 フォーカス",
  dramAccess: "DRAM フォーカス",
  ssdAccess: "SSD フォーカス"
};

function getScopeSteps(scope) {
  return flowRowDefs
    .map((def) => def.key)
    .filter((key) => scopeConfig[scope].flowKeys.has(key));
}

function getFocusedKey(scope) {
  const steps = getScopeSteps(scope);
  if (steps.length === 0) return null;
  focusStepIndex = ((focusStepIndex % steps.length) + steps.length) % steps.length;
  return steps[focusStepIndex];
}

function stepFocus(delta) {
  const steps = getScopeSteps(scopeLevel);
  if (steps.length === 0) return;
  focusStepIndex = (focusStepIndex + delta + steps.length) % steps.length;
  updateUI();
}

function updateOutputs() {
  outputs.modelSize.textContent = `${inputs.modelSize.value} B`;
  outputs.contextLen.textContent = `${fmt.format(+inputs.contextLen.value)} tokens`;
  outputs.batchSize.textContent = `${inputs.batchSize.value}`;
  outputs.quantBits.textContent = `${inputs.quantBits.value} bit`;
  outputs.l1Size.textContent = `${inputs.l1Size.value} KB`;
  outputs.l2Size.textContent = `${inputs.l2Size.value} MB`;
  outputs.l3Size.textContent = `${inputs.l3Size.value} MB`;
  outputs.dramBw.textContent = `${inputs.dramBw.value} GB/s`;
  outputs.ssdBw.textContent = `${inputs.ssdBw.value} GB/s`;
  outputs.offloadRate.textContent = `${inputs.offloadRate.value}%`;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function compute() {
  const modelB = +inputs.modelSize.value;
  const contextLen = +inputs.contextLen.value;
  const batch = +inputs.batchSize.value;
  const bits = +inputs.quantBits.value;

  const l1Bytes = +inputs.l1Size.value * 1024;
  const l2Bytes = +inputs.l2Size.value * 1024 * 1024;
  const l3Bytes = +inputs.l3Size.value * 1024 * 1024;
  const dramBw = +inputs.dramBw.value * 1e9;
  const ssdBw = +inputs.ssdBw.value * 1e9;
  const offload = +inputs.offloadRate.value / 100;

  const weightBytes = modelB * 1e9 * (bits / 8);
  const kvBytesPerToken = modelB * 0.00045 * (bits / 8) * 1e9 / 1e9;
  const kvWorkingSet = kvBytesPerToken * contextLen * batch;
  const activationBytesPerToken = modelB * 0.00008 * (bits / 8) * 1e9 / 1e9;

  const workingSet = (activationBytesPerToken + kvWorkingSet * 0.02) * 1e9;

  const l1Hit = clamp01(0.95 - Math.log2(1 + workingSet / l1Bytes) * 0.08);
  const l2Hit = clamp01(0.92 - Math.log2(1 + workingSet / l2Bytes) * 0.06);
  const l3Hit = clamp01(0.9 - Math.log2(1 + workingSet / l3Bytes) * 0.05);

  const l1Miss = 1 - l1Hit;
  const l2Miss = l1Miss * (1 - l2Hit);
  const l3Miss = l2Miss * (1 - l3Hit);

  const bytesPerToken = (weightBytes * 0.0000022) + (kvBytesPerToken * contextLen * 0.03) + activationBytesPerToken;

  const l1Access = bytesPerToken * 1.5;
  const l2Access = l1Access * l1Miss;
  const l3Access = l2Access * (1 - l2Hit);
  const dramAccess = l3Access * (1 - l3Hit) + bytesPerToken * 0.15;
  const ssdAccess = weightBytes * offload * 0.000001;

  const l1LatNs = 1.2;
  const l2LatNs = 4.8;
  const l3LatNs = 16;
  const dramLatNs = 85;
  const ssdLatNs = 80000;

  const latencyNs =
    l1Access / 64 * l1LatNs +
    l2Access / 64 * l2LatNs +
    l3Access / 64 * l3LatNs +
    dramAccess / 64 * dramLatNs +
    ssdAccess / 4096 * ssdLatNs;

  const dramTimeS = dramAccess / dramBw;
  const ssdTimeS = ssdAccess / ssdBw;
  const decodeLatencyMs = latencyNs / 1e6 + (dramTimeS + ssdTimeS) * 1000;

  const ttftMs = decodeLatencyMs * (4 + Math.log2(contextLen / 128 + 1));
  const tokensPerSec = 1000 / Math.max(0.1, decodeLatencyMs);

  const dramUtil = clamp01((dramAccess / Math.max(1, decodeLatencyMs / 1000)) / dramBw);
  const ssdUtil = clamp01((ssdAccess / Math.max(1, decodeLatencyMs / 1000)) / ssdBw);

  return {
    workingSet, bytesPerToken, dramTimeS, ssdTimeS, kvWorkingSet,
    l1Hit, l2Hit, l3Hit,
    l1Miss, l2Miss, l3Miss,
    l1Access, l2Access, l3Access, dramAccess, ssdAccess,
    ttftMs, decodeLatencyMs, tokensPerSec,
    dramUtil, ssdUtil
  };
}

function fmtBytes(v) {
  if (v > 1e9) return `${(v / 1e9).toFixed(2)} GB`;
  if (v > 1e6) return `${(v / 1e6).toFixed(2)} MB`;
  if (v > 1e3) return `${(v / 1e3).toFixed(2)} KB`;
  return `${v.toFixed(1)} B`;
}

function pct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtMs(v) {
  return `${v.toFixed(2)} ms`;
}

function fmtSec(v) {
  if (v < 0.001) return `${(v * 1e6).toFixed(2)} µs`;
  if (v < 1) return `${(v * 1e3).toFixed(2)} ms`;
  return `${v.toFixed(3)} s`;
}

function bottleneckLabel(m) {
  if (m.ssdAccess > m.dramAccess * 0.35 || m.ssdUtil > 0.75) return "I/O-bound (SSD)";
  if (m.dramUtil > 0.7 || m.l3Miss > 0.35) return "Memory-bound (DRAM)";
  if (m.l2Miss > 0.4) return "Cache-thrashing (L2/L3)";
  return "Compute寄り (on-chip SRAM活用)";
}

function renderModelRationale(metrics) {
  if (!ui.modelRationaleList) return;

  const items = [
    {
      title: "bytesPerToken",
      explanation: "1トークンを生成する際に触る総データ量（重みストリーミング + KV参照 + 活性）です。",
      formula: "(weightBytes×0.0000022) + (kvBytesPerToken×contextLen×0.03) + activationBytesPerToken",
      value: fmtBytes(metrics.bytesPerToken)
    },
    {
      title: "l1/l2/l3 hit",
      explanation: "ワーキングセットが各キャッシュ容量をどれだけ超えるかで、段階的にヒット率が下がる簡略モデルです。",
      formula: "lXHit = clamp01(base - log2(1 + workingSet/lXBytes)×係数)",
      value: `L1 ${pct(metrics.l1Hit)} / L2 ${pct(metrics.l2Hit)} / L3 ${pct(metrics.l3Hit)}`
    },
    {
      title: "decodeLatencyMs",
      explanation: "キャッシュ〜SSDの待ち時間近似と、DRAM/SSD転送時間を合算した1 tokenあたり遅延です。",
      formula: "latencyNs/1e6 + (dramTimeS + ssdTimeS)×1000",
      value: `${fmtMs(metrics.decodeLatencyMs)} (DRAM ${fmtSec(metrics.dramTimeS)}, SSD ${fmtSec(metrics.ssdTimeS)})`
    },
    {
      title: "ttftMs",
      explanation: "初回トークン生成はデコード数ステップ分の準備が必要という仮定で、decode latencyに文脈長依存の係数を掛けます。",
      formula: "decodeLatencyMs × (4 + log2(contextLen/128 + 1))",
      value: fmtMs(metrics.ttftMs)
    }
  ];

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const dt = document.createElement("dt");
    dt.innerHTML = `<code>${item.title}</code>`;
    const dd = document.createElement("dd");
    dd.innerHTML = `${item.explanation} <span class="formula">式: <code>${item.formula}</code></span> <span class="current-value">現在値: ${item.value}</span>`;
    fragment.append(dt, dd);
  }

  const wsDt = document.createElement("dt");
  wsDt.innerHTML = "<code>workingSet</code>";
  const wsDd = document.createElement("dd");
  wsDd.innerHTML = `hit率推定に使う作業集合の近似です。 <span class="current-value">現在値: ${fmtBytes(metrics.workingSet)}（KV作業集合 ${fmtBytes(metrics.kvWorkingSet)}）</span>`;
  fragment.append(wsDt, wsDd);

  ui.modelRationaleList.replaceChildren(fragment);
}

function createFlowRow(label) {
  const row = document.createElement("div");
  row.className = "flow-row";

  const title = document.createElement("strong");
  title.textContent = label;

  const barWrap = document.createElement("div");
  barWrap.className = "bar-wrap";
  const bar = document.createElement("div");
  bar.className = "bar";
  barWrap.appendChild(bar);

  const value = document.createElement("span");

  row.append(title, barWrap, value);
  return { bar, value, key: null };
}

function initFlowRows() {
  const fragment = document.createDocumentFragment();
  for (const def of flowRowDefs) {
    const node = createFlowRow(def.label);
    node.key = def.key;
    flowRowNodes.push(node);
    fragment.appendChild(node.bar.closest(".flow-row"));
  }
  ui.flowBars.replaceChildren(fragment);
}

function updateFlowRows(metrics, scope, focusedKey) {
  const keysToShow = scopeConfig[scope].flowKeys;
  const maxV = Math.max(
    ...flowRowDefs
      .filter((def) => keysToShow.has(def.key))
      .map((def) => metrics[def.key]),
    1
  );

  for (const node of flowRowNodes) {
    const isVisible = keysToShow.has(node.key);
    const row = node.bar.closest(".flow-row");
    row.hidden = !isVisible;
    row.classList.toggle("is-focused", isVisible && node.key === focusedKey);
    if (!isVisible) continue;

    const value = metrics[node.key];
    node.bar.style.width = `${(value / maxV) * 100}%`;
    node.value.textContent = fmtBytes(value);
  }
}

function createCacheRow(label) {
  const tr = document.createElement("tr");
  const name = document.createElement("td");
  name.textContent = label;
  const access = document.createElement("td");
  const hit = document.createElement("td");
  const miss = document.createElement("td");
  const latency = document.createElement("td");

  tr.append(name, access, hit, miss, latency);
  return { access, hit, miss, latency, tr };
}

function initCacheRows() {
  const fragment = document.createDocumentFragment();
  for (const def of cacheRowDefs) {
    const node = createCacheRow(def.label);
    cacheRowNodes.push(node);
    fragment.appendChild(node.tr);
  }
  ui.cacheTableBody.replaceChildren(fragment);
}

function updateCacheRows(metrics, scope, focusedKey) {
  const labelsToShow = scopeConfig[scope].cacheLabels;
  for (let i = 0; i < cacheRowDefs.length; i += 1) {
    const def = cacheRowDefs[i];
    const node = cacheRowNodes[i];
    const isVisible = labelsToShow.has(def.label);
    node.tr.hidden = !isVisible;
    node.tr.classList.toggle("is-focused", isVisible && def.key === focusedKey);
    if (!isVisible) continue;

    const access = def.access(metrics);
    const hit = def.hit(metrics);
    const miss = def.miss(metrics);

    node.access.textContent = fmtBytes(access);
    node.hit.textContent = pct(hit);
    node.miss.textContent = pct(miss);
    node.miss.className = miss > 0.4 ? "bad" : miss > 0.2 ? "warn" : "good";
    node.latency.textContent = `${(def.latencyNs(metrics) / 1e6).toFixed(2)} ms`;
  }
}

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS(svgNs, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  return el;
}

function makeLink(id, x1, y1, x2, y2, label) {
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
    x: (Number(x1) + Number(x2)) / 2,
    y: (Number(y1) + Number(y2)) / 2 - 8,
    "text-anchor": "middle"
  });
  text.textContent = label;

  group.append(line, text);
  return { group, line, text };
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

function initArchitectureDiagram() {
  const svg = ui.archDiagram;
  if (!svg) return;

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

  const computeToL1 = makeLink("linkComputeL1", 200, 135, 260, 80, "on-chip");
  const l1ToL2 = makeLink("linkL1L2", 320, 115, 320, 130, "miss");
  const l2ToL3 = makeLink("linkL2L3", 320, 200, 320, 215, "miss");
  const l3ToDram = makeLink("linkL3Dram", 380, 250, 520, 145, "dramAccess");
  const dramToSsd = makeLink("linkDramSsd", 670, 135, 760, 135, "ssdAccess");

  svg.append(
    computeToL1.group,
    l1ToL2.group,
    l2ToL3.group,
    l3ToDram.group,
    dramToSsd.group
  );

  archLinks = {
    computeToL1,
    l1ToL2,
    l2ToL3,
    l3ToDram,
    dramToSsd
  };
}

function updateArchitectureDiagram(metrics, params, focusedKey) {
  if (!archLinks) return;

  const dramRatio = clamp01(metrics.dramAccess / Math.max(params.weightBytes * 0.000005, 1));
  const ssdRatio = clamp01(metrics.ssdAccess / Math.max(metrics.dramAccess, 1));

  const updateLinkStyle = (entry, ratio) => {
    const width = 2 + ratio * 10;
    entry.line.style.strokeWidth = `${width}`;
    entry.line.classList.toggle("arch-link--hot", ratio > 0.35);
    entry.text.textContent = `${entry.text.textContent.split(" ")[0]} ${Math.round(ratio * 100)}%`;
  };

  archLinks.l3ToDram.text.textContent = "dramAccess";
  archLinks.dramToSsd.text.textContent = "ssdAccess";
  updateLinkStyle(archLinks.l3ToDram, dramRatio);
  updateLinkStyle(archLinks.dramToSsd, ssdRatio);

  archLinks.computeToL1.line.classList.toggle("arch-link--hot", focusedKey === "l1Access");
  archLinks.l1ToL2.line.classList.toggle("arch-link--hot", focusedKey === "l2Access");
  archLinks.l2ToL3.line.classList.toggle("arch-link--hot", focusedKey === "l3Access");
  archLinks.l3ToDram.line.classList.toggle("arch-link--hot", focusedKey === "dramAccess" || dramRatio > 0.35);
  archLinks.dramToSsd.line.classList.toggle("arch-link--hot", focusedKey === "ssdAccess" || ssdRatio > 0.35);
}

function updateUI() {
  updateOutputs();
  const m = compute();
  const scope = scopeConfig[scopeLevel] ? scopeLevel : "macro";
  const focusedKey = getFocusedKey(scope);

  ui.ttft.textContent = `${m.ttftMs.toFixed(1)} ms`;
  ui.decodeLatency.textContent = `${m.decodeLatencyMs.toFixed(2)} ms/token`;
  ui.throughput.textContent = `${m.tokensPerSec.toFixed(1)} tokens/s`;
  ui.bottleneck.textContent = bottleneckLabel(m);

  ui.cacheStatsPanel.hidden = !scopeConfig[scope].showCachePanel;
  ui.focusStepLabel.textContent = focusedKey ? stepLabels[focusedKey] : "フォーカスなし";

  updateFlowRows(m, scope, focusedKey);
  updateCacheRows(m, scope, focusedKey);

  updateArchitectureDiagram(m, {
    weightBytes: +inputs.modelSize.value * 1e9 * (+inputs.quantBits.value / 8)
  }, focusedKey);

  const narrative = [];
  if (m.l1Miss > 0.25) narrative.push("L1ミス率が高く、ワーキングセットがオンチップSRAMを超えています。");
  if (m.l3Miss > 0.3) narrative.push("L3を抜けてDRAMアクセスが増え、decode遅延が拡大しています。");
  if (m.ssdAccess > m.dramAccess * 0.25) narrative.push("SSDオフロード比率が高く、I/O待ちの影響が顕著です。");
  if (narrative.length === 0) narrative.push("現在の設定ではL1-L3再利用が効いており、比較的安定した推論です。");

  ui.narrative.textContent = narrative.join(" ");
  renderModelRationale(m);
}

function applyHardwareProfile(profileKey) {
  const profile = hardwareProfiles[profileKey];
  if (!profile) return;

  for (const [key, value] of Object.entries(profile)) {
    if (inputs[key]) {
      inputs[key].value = String(value);
    }
  }

  updateUI();
}

initFlowRows();
initCacheRows();
initArchitectureDiagram();

for (const button of ui.scopeButtons) {
  button.addEventListener("click", () => {
    scopeLevel = button.dataset.scope || "macro";
    focusStepIndex = 0;
    for (const btn of ui.scopeButtons) {
      btn.classList.toggle("is-active", btn === button);
    }
    updateUI();
  });
}

ui.focusPrev.addEventListener("click", () => stepFocus(-1));
ui.focusNext.addEventListener("click", () => stepFocus(1));

for (const id of ids) {
  inputs[id].addEventListener("input", updateUI);
}

ui.hardwareProfile?.addEventListener("change", (event) => {
  applyHardwareProfile(event.target.value);
});

if (ui.hardwareProfile?.value) {
  applyHardwareProfile(ui.hardwareProfile.value);
} else {
  updateUI();
}
