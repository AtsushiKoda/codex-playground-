import {
  INPUT_IDS,
  cacheRowDefs,
  compute,
  flowRowDefs,
  getFocusedKey,
  getScopeSteps,
  getWeightBytes,
  hardwareProfiles,
  scopeConfig,
  stepLabels
} from "./model.js";
import { fmtBytes, fmtMs, fmtSec, formatControlOutput, pct } from "./format.js";
import { createFlowRenderer } from "./renderers/flow.js";
import { createCacheRenderer } from "./renderers/cache.js";
import { createLatencyRenderer } from "./renderers/latency.js";
import { createArchitectureRenderer } from "./renderers/architecture.js";

const inputs = Object.fromEntries(INPUT_IDS.map((id) => [id, document.getElementById(id)]));
const outputs = Object.fromEntries(INPUT_IDS.map((id) => [id, document.getElementById(`${id}Out`)]));

const ui = {
  ttft: document.getElementById("ttft"),
  decodeLatency: document.getElementById("decodeLatency"),
  throughput: document.getElementById("throughput"),
  bottleneck: document.getElementById("bottleneck"),
  narrative: document.getElementById("narrative"),
  modelRationaleList: document.getElementById("modelRationaleList"),
  focusPrev: document.getElementById("focusPrev"),
  focusNext: document.getElementById("focusNext"),
  focusStepLabel: document.getElementById("focusStepLabel"),
  hardwareProfile: document.getElementById("hardwareProfile"),
  scopeButtons: Array.from(document.querySelectorAll(".scope-btn")),
  cacheStatsPanel: document.querySelector(".cache-stats")
};

const flowRenderer = createFlowRenderer({ container: document.getElementById("flowBars"), flowRowDefs });
const cacheRenderer = createCacheRenderer({ tbody: document.getElementById("cacheTableBody"), cacheRowDefs });
const latencyRenderer = createLatencyRenderer({
  container: document.getElementById("latencyBreakdownBars"),
  whyText: document.getElementById("latencyWhyText")
});
const architectureRenderer = createArchitectureRenderer({ svg: document.getElementById("archDiagram") });

const state = {
  scope: "macro",
  focusStepIndex: 0
};

function readParams() {
  return {
    modelSize: Number(inputs.modelSize.value),
    contextLen: Number(inputs.contextLen.value),
    batchSize: Number(inputs.batchSize.value),
    quantBits: Number(inputs.quantBits.value),
    l1Size: Number(inputs.l1Size.value),
    l2Size: Number(inputs.l2Size.value),
    l3Size: Number(inputs.l3Size.value),
    dramBw: Number(inputs.dramBw.value),
    ssdBw: Number(inputs.ssdBw.value),
    offloadRate: Number(inputs.offloadRate.value)
  };
}

function updateOutputs() {
  for (const id of INPUT_IDS) {
    outputs[id].textContent = formatControlOutput(id, inputs[id].value);
  }
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

function updateNarrative(metrics) {
  const narrative = [];
  if (metrics.l1Miss > 0.25) narrative.push("L1ミス率が高く、ワーキングセットがオンチップSRAMを超えています。");
  if (metrics.l3Miss > 0.3) narrative.push("L3を抜けてDRAMアクセスが増え、decode遅延が拡大しています。");
  if (metrics.ssdAccess > metrics.dramAccess * 0.25) narrative.push("SSDオフロード比率が高く、I/O待ちの影響が顕著です。");
  if (narrative.length === 0) narrative.push("現在の設定ではL1-L3再利用が効いており、比較的安定した推論です。");
  ui.narrative.textContent = narrative.join(" ");
}

function updateUI() {
  updateOutputs();

  const params = readParams();
  const metrics = compute(params);
  const activeScope = scopeConfig[state.scope] ? state.scope : "macro";
  const focused = getFocusedKey(activeScope, state.focusStepIndex);
  state.focusStepIndex = focused.focusIndex;

  ui.ttft.textContent = `${metrics.ttftMs.toFixed(1)} ms`;
  ui.decodeLatency.textContent = `${metrics.decodeLatencyMs.toFixed(2)} ms/token`;
  ui.throughput.textContent = `${metrics.tokensPerSec.toFixed(1)} tokens/s`;
  ui.bottleneck.textContent = bottleneckLabel(metrics);
  ui.cacheStatsPanel.hidden = !scopeConfig[activeScope].showCachePanel;
  ui.focusStepLabel.textContent = focused.key ? stepLabels[focused.key] : "フォーカスなし";

  flowRenderer.update({ metrics, keysToShow: scopeConfig[activeScope].flowKeys, focusedKey: focused.key });
  cacheRenderer.update({ metrics, labelsToShow: scopeConfig[activeScope].cacheLabels, focusedKey: focused.key });
  latencyRenderer.update(metrics);
  architectureRenderer.update({ metrics, weightBytes: getWeightBytes(params), focusedKey: focused.key });

  updateNarrative(metrics);
  renderModelRationale(metrics);
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

function stepFocus(delta) {
  const steps = getScopeSteps(state.scope);
  if (steps.length === 0) return;
  state.focusStepIndex = (state.focusStepIndex + delta + steps.length) % steps.length;
  updateUI();
}

for (const button of ui.scopeButtons) {
  button.addEventListener("click", () => {
    state.scope = button.dataset.scope || "macro";
    state.focusStepIndex = 0;
    for (const btn of ui.scopeButtons) {
      btn.classList.toggle("is-active", btn === button);
    }
    updateUI();
  });
}

ui.focusPrev.addEventListener("click", () => stepFocus(-1));
ui.focusNext.addEventListener("click", () => stepFocus(1));

for (const id of INPUT_IDS) {
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
