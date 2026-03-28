const ids = [
  "modelSize", "contextLen", "batchSize", "quantBits",
  "l1Size", "l2Size", "l3Size", "dramBw", "ssdBw", "offloadRate"
];

const fmt = new Intl.NumberFormat("ja-JP");

const inputs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const outputs = Object.fromEntries(ids.map((id) => [id, document.getElementById(`${id}Out`)]));

const ui = {
  ttft: document.getElementById("ttft"),
  decodeLatency: document.getElementById("decodeLatency"),
  throughput: document.getElementById("throughput"),
  bottleneck: document.getElementById("bottleneck"),
  flowBars: document.getElementById("flowBars"),
  cacheTableBody: document.getElementById("cacheTableBody"),
  narrative: document.getElementById("narrative")
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
    label: "L1 (SRAM)",
    access: (m) => m.l1Access,
    hit: (m) => m.l1Hit,
    miss: (m) => m.l1Miss,
    latencyNs: (m) => m.l1Access / 64 * 1.2
  },
  {
    label: "L2 (SRAM)",
    access: (m) => m.l2Access,
    hit: (m) => 1 - (m.l2Miss / Math.max(m.l1Miss, 1e-6)),
    miss: (m) => m.l2Miss / Math.max(m.l1Miss, 1e-6),
    latencyNs: (m) => m.l2Access / 64 * 4.8
  },
  {
    label: "L3 (SRAM)",
    access: (m) => m.l3Access,
    hit: (m) => 1 - (m.l3Miss / Math.max(m.l2Miss, 1e-6)),
    miss: (m) => m.l3Miss / Math.max(m.l2Miss, 1e-6),
    latencyNs: (m) => m.l3Access / 64 * 16
  },
  {
    label: "DRAM",
    access: (m) => m.dramAccess,
    hit: (m) => 1 - m.l3Miss,
    miss: (m) => m.l3Miss,
    latencyNs: (m) => m.dramAccess / 64 * 85
  },
  {
    label: "SSD",
    access: (m) => m.ssdAccess,
    hit: (m) => 1 - Math.min(1, m.ssdAccess / (m.dramAccess + 1e-6)),
    miss: (m) => Math.min(1, m.ssdAccess / (m.dramAccess + 1e-6)),
    latencyNs: (m) => m.ssdAccess / 4096 * 80000
  }
];

const flowRowNodes = [];
const cacheRowNodes = [];

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

function bottleneckLabel(m) {
  if (m.ssdAccess > m.dramAccess * 0.35 || m.ssdUtil > 0.75) return "I/O-bound (SSD)";
  if (m.dramUtil > 0.7 || m.l3Miss > 0.35) return "Memory-bound (DRAM)";
  if (m.l2Miss > 0.4) return "Cache-thrashing (L2/L3)";
  return "Compute寄り (on-chip SRAM活用)";
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

function updateFlowRows(metrics) {
  const maxV = Math.max(
    ...flowRowDefs.map((def) => metrics[def.key]),
    1
  );

  for (const node of flowRowNodes) {
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

function updateCacheRows(metrics) {
  for (let i = 0; i < cacheRowDefs.length; i += 1) {
    const def = cacheRowDefs[i];
    const node = cacheRowNodes[i];
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

function updateUI() {
  updateOutputs();
  const m = compute();

  ui.ttft.textContent = `${m.ttftMs.toFixed(1)} ms`;
  ui.decodeLatency.textContent = `${m.decodeLatencyMs.toFixed(2)} ms/token`;
  ui.throughput.textContent = `${m.tokensPerSec.toFixed(1)} tokens/s`;
  ui.bottleneck.textContent = bottleneckLabel(m);

  updateFlowRows(m);
  updateCacheRows(m);

  const narrative = [];
  if (m.l1Miss > 0.25) narrative.push("L1ミス率が高く、ワーキングセットがオンチップSRAMを超えています。");
  if (m.l3Miss > 0.3) narrative.push("L3を抜けてDRAMアクセスが増え、decode遅延が拡大しています。");
  if (m.ssdAccess > m.dramAccess * 0.25) narrative.push("SSDオフロード比率が高く、I/O待ちの影響が顕著です。");
  if (narrative.length === 0) narrative.push("現在の設定ではL1-L3再利用が効いており、比較的安定した推論です。");

  ui.narrative.textContent = narrative.join(" ");
}

initFlowRows();
initCacheRows();

for (const id of ids) {
  inputs[id].addEventListener("input", updateUI);
}

updateUI();
