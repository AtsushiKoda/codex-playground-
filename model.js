export const INPUT_IDS = [
  "modelSize", "contextLen", "batchSize", "quantBits",
  "l1Size", "l2Size", "l3Size", "dramBw", "ssdBw", "offloadRate"
];

export const COEFFICIENTS = {
  kvPerToken: 0.00045,
  activationPerToken: 0.00008,
  bytesPerTokenWeightFactor: 0.0000022,
  bytesPerTokenKvFactor: 0.03,
  workingSetKvFactor: 0.02,
  dramBaseTrafficFactor: 0.15,
  ssdOffloadFactor: 0.000001,
  l1HitBase: 0.95,
  l2HitBase: 0.92,
  l3HitBase: 0.9,
  l1HitSlope: 0.08,
  l2HitSlope: 0.06,
  l3HitSlope: 0.05,
  l1LatencyNs: 1.2,
  l2LatencyNs: 4.8,
  l3LatencyNs: 16,
  dramLatencyNs: 85,
  ssdLatencyNs: 80000
};

export const hardwareProfiles = {
  entryCpu: { l1Size: 64, l2Size: 2, l3Size: 24, dramBw: 80, ssdBw: 3, offloadRate: 20 },
  serverCpu: { l1Size: 96, l2Size: 4, l3Size: 64, dramBw: 220, ssdBw: 8, offloadRate: 10 },
  gpuInferenceNode: { l1Size: 128, l2Size: 8, l3Size: 96, dramBw: 360, ssdBw: 14, offloadRate: 5 }
};

export const flowRowDefs = [
  { key: "l1Access", label: "L1" },
  { key: "l2Access", label: "L2" },
  { key: "l3Access", label: "L3" },
  { key: "dramAccess", label: "DRAM" },
  { key: "ssdAccess", label: "SSD" }
];

export const cacheRowDefs = [
  {
    key: "l1Access",
    label: "L1 (SRAM)",
    access: (m) => m.l1Access,
    hit: (m) => m.l1Hit,
    miss: (m) => m.l1Miss,
    latencyNs: (m) => m.l1Access / 64 * COEFFICIENTS.l1LatencyNs
  },
  {
    key: "l2Access",
    label: "L2 (SRAM)",
    access: (m) => m.l2Access,
    hit: (m) => 1 - (m.l2Miss / Math.max(m.l1Miss, 1e-6)),
    miss: (m) => m.l2Miss / Math.max(m.l1Miss, 1e-6),
    latencyNs: (m) => m.l2Access / 64 * COEFFICIENTS.l2LatencyNs
  },
  {
    key: "l3Access",
    label: "L3 (SRAM)",
    access: (m) => m.l3Access,
    hit: (m) => 1 - (m.l3Miss / Math.max(m.l2Miss, 1e-6)),
    miss: (m) => m.l3Miss / Math.max(m.l2Miss, 1e-6),
    latencyNs: (m) => m.l3Access / 64 * COEFFICIENTS.l3LatencyNs
  },
  {
    key: "dramAccess",
    label: "DRAM",
    access: (m) => m.dramAccess,
    hit: (m) => 1 - m.l3Miss,
    miss: (m) => m.l3Miss,
    latencyNs: (m) => m.dramAccess / 64 * COEFFICIENTS.dramLatencyNs
  },
  {
    key: "ssdAccess",
    label: "SSD",
    access: (m) => m.ssdAccess,
    hit: (m) => 1 - Math.min(1, m.ssdAccess / (m.dramAccess + 1e-6)),
    miss: (m) => Math.min(1, m.ssdAccess / (m.dramAccess + 1e-6)),
    latencyNs: (m) => m.ssdAccess / 4096 * COEFFICIENTS.ssdLatencyNs
  }
];

export const scopeConfig = {
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

export const stepLabels = {
  l1Access: "L1 フォーカス",
  l2Access: "L2 フォーカス",
  l3Access: "L3 フォーカス",
  dramAccess: "DRAM フォーカス",
  ssdAccess: "SSD フォーカス"
};

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function getScopeSteps(scope) {
  return flowRowDefs.map((def) => def.key).filter((key) => scopeConfig[scope].flowKeys.has(key));
}

export function getFocusedKey(scope, focusIndex) {
  const steps = getScopeSteps(scope);
  if (steps.length === 0) {
    return { key: null, focusIndex: 0 };
  }
  const normalizedIndex = ((focusIndex % steps.length) + steps.length) % steps.length;
  return { key: steps[normalizedIndex], focusIndex: normalizedIndex };
}

export function getWeightBytes(params) {
  return params.modelSize * 1e9 * (params.quantBits / 8);
}

export function compute(params) {
  const modelB = params.modelSize;
  const contextLen = params.contextLen;
  const batch = params.batchSize;
  const bits = params.quantBits;

  const l1Bytes = params.l1Size * 1024;
  const l2Bytes = params.l2Size * 1024 * 1024;
  const l3Bytes = params.l3Size * 1024 * 1024;
  const dramBw = params.dramBw * 1e9;
  const ssdBw = params.ssdBw * 1e9;
  const offload = params.offloadRate / 100;

  const weightBytes = getWeightBytes(params);
  const kvBytesPerToken = modelB * COEFFICIENTS.kvPerToken * (bits / 8);
  const kvWorkingSet = kvBytesPerToken * contextLen * batch;
  const activationBytesPerToken = modelB * COEFFICIENTS.activationPerToken * (bits / 8);
  const workingSet = (activationBytesPerToken + kvWorkingSet * COEFFICIENTS.workingSetKvFactor) * 1e9;

  const l1Hit = clamp01(COEFFICIENTS.l1HitBase - Math.log2(1 + workingSet / l1Bytes) * COEFFICIENTS.l1HitSlope);
  const l2Hit = clamp01(COEFFICIENTS.l2HitBase - Math.log2(1 + workingSet / l2Bytes) * COEFFICIENTS.l2HitSlope);
  const l3Hit = clamp01(COEFFICIENTS.l3HitBase - Math.log2(1 + workingSet / l3Bytes) * COEFFICIENTS.l3HitSlope);

  const l1Miss = 1 - l1Hit;
  const l2Miss = l1Miss * (1 - l2Hit);
  const l3Miss = l2Miss * (1 - l3Hit);

  const bytesPerToken =
    (weightBytes * COEFFICIENTS.bytesPerTokenWeightFactor) +
    (kvBytesPerToken * contextLen * COEFFICIENTS.bytesPerTokenKvFactor) +
    activationBytesPerToken;

  const l1Access = bytesPerToken * 1.5;
  const l2Access = l1Access * l1Miss;
  const l3Access = l2Access * (1 - l2Hit);
  const dramAccess = l3Access * (1 - l3Hit) + bytesPerToken * COEFFICIENTS.dramBaseTrafficFactor;
  const ssdAccess = weightBytes * offload * COEFFICIENTS.ssdOffloadFactor;

  const latencyNs =
    l1Access / 64 * COEFFICIENTS.l1LatencyNs +
    l2Access / 64 * COEFFICIENTS.l2LatencyNs +
    l3Access / 64 * COEFFICIENTS.l3LatencyNs +
    dramAccess / 64 * COEFFICIENTS.dramLatencyNs +
    ssdAccess / 4096 * COEFFICIENTS.ssdLatencyNs;

  const dramTimeS = dramAccess / dramBw;
  const ssdTimeS = ssdAccess / ssdBw;
  const decodeLatencyMs = latencyNs / 1e6 + (dramTimeS + ssdTimeS) * 1000;

  const l1WaitMs = (l1Access / 64 * COEFFICIENTS.l1LatencyNs) / 1e6;
  const l2WaitMs = (l2Access / 64 * COEFFICIENTS.l2LatencyNs) / 1e6;
  const l3WaitMs = (l3Access / 64 * COEFFICIENTS.l3LatencyNs) / 1e6;
  const dramWaitMs = (dramAccess / 64 * COEFFICIENTS.dramLatencyNs) / 1e6 + dramTimeS * 1000;
  const ssdWaitMs = (ssdAccess / 4096 * COEFFICIENTS.ssdLatencyNs) / 1e6 + ssdTimeS * 1000;

  const ttftMs = decodeLatencyMs * (4 + Math.log2(contextLen / 128 + 1));
  const tokensPerSec = 1000 / Math.max(0.1, decodeLatencyMs);

  const dramUtil = clamp01((dramAccess / Math.max(1, decodeLatencyMs / 1000)) / dramBw);
  const ssdUtil = clamp01((ssdAccess / Math.max(1, decodeLatencyMs / 1000)) / ssdBw);

  return {
    workingSet, bytesPerToken, dramTimeS, ssdTimeS, kvWorkingSet,
    l1Hit, l2Hit, l3Hit,
    l1Miss, l2Miss, l3Miss,
    l1Access, l2Access, l3Access, dramAccess, ssdAccess,
    l1WaitMs, l2WaitMs, l3WaitMs, dramWaitMs, ssdWaitMs,
    ttftMs, decodeLatencyMs, tokensPerSec,
    dramUtil, ssdUtil
  };
}
