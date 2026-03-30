import {
  compute,
  getFocusedKey,
  getWeightBytes,
  getStepLabel,
  scopeConfig,
  stepLabels
} from "../model.js";

export function selectComputedState(state) {
  const params = { ...state.inputValues };
  const metrics = compute(params);
  const activeScope = scopeConfig[state.scope] ? state.scope : "macro";
  const focused = getFocusedKey(activeScope, state.focusStepIndex);

  return {
    params,
    metrics,
    activeScope,
    focused,
    showCachePanel: scopeConfig[activeScope].showCachePanel,
    flowKeys: scopeConfig[activeScope].flowKeys,
    cacheLabels: scopeConfig[activeScope].cacheLabels,
    focusStepLabel: focused.key ? getStepLabel(focused.key) : "フォーカスなし",
    compareMeaning: focused.key
      ? `${stepLabels[focused.key].inference} ↔ ${stepLabels[focused.key].hardware}: ${stepLabels[focused.key].meaning}`
      : "ステップを選択すると、推論計算とハードウェアイベントの対応を表示します。",
    bottleneck: selectBottleneck(metrics),
    architecture: selectArchitectureDTO({
      metrics,
      weightBytes: getWeightBytes(params),
      focusedKey: focused.key,
      hardwareProfileKey: state.hardwareProfileKey
    })
  };
}

export function selectBottleneck(metrics) {
  if (metrics.ssdAccess > metrics.dramAccess * 0.35 || metrics.ssdUtil > 0.75) return "I/O-bound (SSD)";
  if (metrics.dramUtil > 0.7 || metrics.l3Miss > 0.35) return "Memory-bound (DRAM)";
  if (metrics.l2Miss > 0.4) return "Cache-thrashing (L2/L3)";
  return "Compute寄り (on-chip SRAM活用)";
}

export function selectArchitectureDTO({ metrics, weightBytes, focusedKey, hardwareProfileKey }) {
  return {
    focusedKey,
    hardwareProfileKey,
    dramAccessRatioBase: Math.max(weightBytes * 0.000005, 1),
    dramAccess: metrics.dramAccess,
    ssdAccess: metrics.ssdAccess
  };
}
