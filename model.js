export const INPUT_IDS = [
  "modelSize", "contextLen", "batchSize", "quantBits",
  "l1Size", "l2Size", "l3Size", "dramBw", "ssdBw", "offloadRate"
];

export const modelCoefficients = {
  // bytesPerToken の重みストリーミング項: weightBytes × weightStreamingFactor
  weightStreamingFactor: 0.0000022,
  // bytesPerToken のKV参照項: kvBytesPerToken × contextLen × kvRefFactor
  kvRefFactor: 0.03,
  // bytesPerToken の活性項: activationBytesPerToken = modelB × activationFactor × (bits/8)
  activationFactor: 0.00008,
  // KVキャッシュの1tokenあたり基礎量: kvBytesPerToken = modelB × kvBytesFactor × (bits/8)
  kvBytesFactor: 0.00045,
  // workingSet へのKV寄与の減衰係数: activation + kvWorkingSet × kvWorkingSetFactor
  kvWorkingSetFactor: 0.02,
  // DRAM基礎トラフィック項: dramAccess += bytesPerToken × dramBaseFactor
  dramBaseFactor: 0.15,
  weightOffloadFactor: 0.000001,
  l1AccessMultiplier: 1.5,
  cacheLineBytes: 64,
  ssdPageBytes: 4096,
  ttftBaseSteps: 4,
  ttftContextNorm: 128
};

export const COEFFICIENTS = {
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
  l1Access: {
    inference: "Prefill",
    hardware: "L1 キャッシュ再利用",
    meaning: "直近トークンや一時値をL1に収め、最小遅延で次演算へ供給する。"
  },
  l2Access: {
    inference: "Decode",
    hardware: "L2 キャッシュ展開",
    meaning: "デコード反復で不足したデータをL2から補い、L1ミスを吸収する。"
  },
  l3Access: {
    inference: "KV参照",
    hardware: "L3 共有キャッシュ参照",
    meaning: "長い文脈のKVを共有キャッシュ経由で探索し、DRAM流入を抑制する。"
  },
  dramAccess: {
    inference: "Projection",
    hardware: "DRAM 帯域消費",
    meaning: "射影/線形層で重み・活性が主メモリ帯域を強く消費する。"
  },
  ssdAccess: {
    inference: "Weight Offload",
    hardware: "SSD 読み戻し",
    meaning: "オフロード重みをストレージから戻すためI/O待ちが律速になりやすい。"
  }
};

export function getStepLabel(key) {
  const info = stepLabels[key];
  if (!info) return "フォーカスなし";
  return `${info.inference} ↔ ${info.hardware}`;
}

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
  const kvBytesPerToken = modelB * modelCoefficients.kvBytesFactor * (bits / 8);
  const kvWorkingSet = kvBytesPerToken * contextLen * batch;
  const activationBytesPerToken = modelB * modelCoefficients.activationFactor * (bits / 8);
  const workingSet = (activationBytesPerToken + kvWorkingSet * modelCoefficients.kvWorkingSetFactor) * 1e9;

  const l1Hit = clamp01(COEFFICIENTS.l1HitBase - Math.log2(1 + workingSet / l1Bytes) * COEFFICIENTS.l1HitSlope);
  const l2Hit = clamp01(COEFFICIENTS.l2HitBase - Math.log2(1 + workingSet / l2Bytes) * COEFFICIENTS.l2HitSlope);
  const l3Hit = clamp01(COEFFICIENTS.l3HitBase - Math.log2(1 + workingSet / l3Bytes) * COEFFICIENTS.l3HitSlope);

  const l1Miss = 1 - l1Hit;
  const l2Miss = l1Miss * (1 - l2Hit);
  const l3Miss = l2Miss * (1 - l3Hit);

  const bytesPerToken =
    (weightBytes * modelCoefficients.weightStreamingFactor) +
    (kvBytesPerToken * contextLen * modelCoefficients.kvRefFactor) +
    activationBytesPerToken;

  const l1Access = bytesPerToken * modelCoefficients.l1AccessMultiplier;
  const l2Access = l1Access * l1Miss;
  const l3Access = l2Access * (1 - l2Hit);
  const dramAccess = l3Access * (1 - l3Hit) + bytesPerToken * modelCoefficients.dramBaseFactor;
  const ssdAccess = weightBytes * offload * modelCoefficients.weightOffloadFactor;

  const latencyNs =
    l1Access / modelCoefficients.cacheLineBytes * COEFFICIENTS.l1LatencyNs +
    l2Access / modelCoefficients.cacheLineBytes * COEFFICIENTS.l2LatencyNs +
    l3Access / modelCoefficients.cacheLineBytes * COEFFICIENTS.l3LatencyNs +
    dramAccess / modelCoefficients.cacheLineBytes * COEFFICIENTS.dramLatencyNs +
    ssdAccess / modelCoefficients.ssdPageBytes * COEFFICIENTS.ssdLatencyNs;

  const dramTimeS = dramAccess / dramBw;
  const ssdTimeS = ssdAccess / ssdBw;
  const decodeLatencyMs = latencyNs / 1e6 + (dramTimeS + ssdTimeS) * 1000;

  const l1WaitMs = (l1Access / modelCoefficients.cacheLineBytes * COEFFICIENTS.l1LatencyNs) / 1e6;
  const l2WaitMs = (l2Access / modelCoefficients.cacheLineBytes * COEFFICIENTS.l2LatencyNs) / 1e6;
  const l3WaitMs = (l3Access / modelCoefficients.cacheLineBytes * COEFFICIENTS.l3LatencyNs) / 1e6;
  const dramWaitMs = (dramAccess / modelCoefficients.cacheLineBytes * COEFFICIENTS.dramLatencyNs) / 1e6 + dramTimeS * 1000;
  const ssdWaitMs = (ssdAccess / modelCoefficients.ssdPageBytes * COEFFICIENTS.ssdLatencyNs) / 1e6 + ssdTimeS * 1000;

  const ttftMs = decodeLatencyMs * (modelCoefficients.ttftBaseSteps + Math.log2(contextLen / modelCoefficients.ttftContextNorm + 1));
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
