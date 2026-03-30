import { fmtBytes, fmtMs, fmtSec, pct } from "../format.js";

export function createInsightPanelRenderer({ narrative, modelRationaleList }) {
  function renderModelRationale(metrics) {
    if (!modelRationaleList) return;

    const items = [
      {
        title: "bytesPerToken",
        explanation: "1トークンを生成する際に触る総データ量（重みストリーミング + KV参照 + 活性）です。",
        formula:
          "(weightBytes×modelCoefficients.weightStreamingFactor) + (kvBytesPerToken×contextLen×modelCoefficients.kvRefFactor) + activationBytesPerToken",
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
        explanation:
          "初回トークン生成はデコード数ステップ分の準備が必要という仮定で、decode latencyに文脈長依存の係数を掛けます。",
        formula: "decodeLatencyMs × (modelCoefficients.ttftBaseSteps + log2(contextLen/modelCoefficients.ttftContextNorm + 1))",
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

    modelRationaleList.replaceChildren(fragment);
  }

  function renderNarrative(metrics) {
    const messages = [];
    if (metrics.l1Miss > 0.25) messages.push("L1ミス率が高く、ワーキングセットがオンチップSRAMを超えています。");
    if (metrics.l3Miss > 0.3) messages.push("L3を抜けてDRAMアクセスが増え、decode遅延が拡大しています。");
    if (metrics.ssdAccess > metrics.dramAccess * 0.25) messages.push("SSDオフロード比率が高く、I/O待ちの影響が顕著です。");
    if (messages.length === 0) messages.push("現在の設定ではL1-L3再利用が効いており、比較的安定した推論です。");
    narrative.textContent = messages.join(" ");
  }

  function render({ metrics }) {
    renderNarrative(metrics);
    renderModelRationale(metrics);
  }

  return { render };
}
