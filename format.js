export const numberFormatter = new Intl.NumberFormat("ja-JP");

export function fmtBytes(v) {
  if (v > 1e9) return `${(v / 1e9).toFixed(2)} GB`;
  if (v > 1e6) return `${(v / 1e6).toFixed(2)} MB`;
  if (v > 1e3) return `${(v / 1e3).toFixed(2)} KB`;
  return `${v.toFixed(1)} B`;
}

export function fmtMs(v) {
  return `${v.toFixed(2)} ms`;
}

export function fmtSec(v) {
  if (v < 0.001) return `${(v * 1e6).toFixed(2)} µs`;
  if (v < 1) return `${(v * 1e3).toFixed(2)} ms`;
  return `${v.toFixed(3)} s`;
}

export function pct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

export function formatControlOutput(id, value) {
  const numeric = Number(value);
  switch (id) {
    case "modelSize": return `${numeric} B`;
    case "contextLen": return `${numberFormatter.format(numeric)} tokens`;
    case "batchSize": return `${numeric}`;
    case "quantBits": return `${numeric} bit`;
    case "l1Size": return `${numeric} KB`;
    case "l2Size": return `${numeric} MB`;
    case "l3Size": return `${numeric} MB`;
    case "dramBw": return `${numeric} GB/s`;
    case "ssdBw": return `${numeric} GB/s`;
    case "offloadRate": return `${numeric}%`;
    default: return String(value);
  }
}
