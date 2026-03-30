import { INPUT_IDS, cacheRowDefs, flowRowDefs } from "./model.js";
import { formatControlOutput } from "./format.js";
import { createFlowRenderer } from "./renderers/flow.js";
import { createCacheRenderer } from "./renderers/cache.js";
import { createLatencyRenderer } from "./renderers/latency.js";
import { createArchitectureRenderer } from "./renderers/architecture.js";
import { createInferencePipelineRenderer } from "./renderers/inferencePipeline.js";
import { createInsightPanelRenderer } from "./renderers/insightPanel.js";
import { createStore } from "./state/store.js";
import { selectComputedState } from "./state/selectors.js";
import { createUIController } from "./controllers/uiController.js";

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
  compareMeaning: document.getElementById("compareMeaning"),
  hardwareProfile: document.getElementById("hardwareProfile"),
  scopeButtons: Array.from(document.querySelectorAll(".scope-btn")),
  cacheStatsPanel: document.querySelector(".cache-stats"),
  archTabs: Array.from(document.querySelectorAll(".arch-tab")),
  archPanels: Array.from(document.querySelectorAll(".arch-tab-panel")),
  archControlsToggle: document.getElementById("archControlsToggle"),
  archControlsPanel: document.getElementById("archControlsPanel")
};

const flowRenderer = createFlowRenderer({ container: document.getElementById("flowBars"), flowRowDefs });
const cacheRenderer = createCacheRenderer({ tbody: document.getElementById("cacheTableBody"), cacheRowDefs });
const latencyRenderer = createLatencyRenderer({
  container: document.getElementById("latencyBreakdownBars"),
  whyText: document.getElementById("latencyWhyText")
});
const architectureRenderer = createArchitectureRenderer({ svg: document.getElementById("archDiagram") });
const inferencePipelineRenderer = createInferencePipelineRenderer({ svg: document.getElementById("inferenceDiagram") });
const insightPanelRenderer = createInsightPanelRenderer({ narrative: ui.narrative, modelRationaleList: ui.modelRationaleList });

const store = createStore({ inputs });

function setActiveControlTab(tabKey) {
  for (const tab of ui.archTabs) {
    const isActive = tab.dataset.tab === tabKey;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  }

  for (const panel of ui.archPanels) {
    const isActive = panel.dataset.panel === tabKey;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  }
}

function toggleArchControls(forceOpen) {
  if (!ui.archControlsPanel || !ui.archControlsToggle) return;
  const nextOpen = typeof forceOpen === "boolean" ? forceOpen : !ui.archControlsPanel.classList.contains("is-open");
  ui.archControlsPanel.classList.toggle("is-open", nextOpen);
  ui.archControlsToggle.setAttribute("aria-expanded", String(nextOpen));
}

function renderView(state) {
  const computed = selectComputedState(state);
  if (computed.focused.focusIndex !== state.focusStepIndex) {
    store.setState((prev) => ({ ...prev, focusStepIndex: computed.focused.focusIndex }));
    return;
  }

  ui.ttft.textContent = `${computed.metrics.ttftMs.toFixed(1)} ms`;
  ui.decodeLatency.textContent = `${computed.metrics.decodeLatencyMs.toFixed(2)} ms/token`;
  ui.throughput.textContent = `${computed.metrics.tokensPerSec.toFixed(1)} tokens/s`;
  ui.bottleneck.textContent = computed.bottleneck;
  ui.cacheStatsPanel.hidden = !computed.showCachePanel;
  ui.focusStepLabel.textContent = computed.focusStepLabel;
  if (ui.compareMeaning) ui.compareMeaning.textContent = computed.compareMeaning;

  flowRenderer.render({ metrics: computed.metrics, keysToShow: computed.flowKeys, focusedKey: computed.focused.key });
  cacheRenderer.render({ metrics: computed.metrics, labelsToShow: computed.cacheLabels, focusedKey: computed.focused.key });
  latencyRenderer.render({ metrics: computed.metrics });
  inferencePipelineRenderer.render({ focusedKey: computed.focused.key, scope: computed.activeScope });
  architectureRenderer.render(computed.architecture);
  insightPanelRenderer.render({ metrics: computed.metrics });
}

const uiController = createUIController({
  ui,
  inputs,
  outputs,
  store,
  formatControlOutput,
  setActiveControlTab,
  toggleArchControls
});

store.subscribe((state) => {
  uiController.syncControlOutputs();
  renderView(state);
});

uiController.bind();
renderView(store.getState());
