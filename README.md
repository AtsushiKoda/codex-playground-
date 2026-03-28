# LLM推論 × コンピュータアーキテクチャ可視化ツール

ブラウザで動く軽量なインタラクティブ可視化です。CPUキャッシュ階層（L1/L2/L3）とSRAM/DRAM/SSDの観点で、LLM推論（1 token decode）のボトルネックを近似的に確認できます。

## できること

- モデルサイズ・コンテキスト長・バッチ・量子化を調整
- L1/L2/L3容量、DRAM/SSD帯域、SSDオフロード比率を調整
- 以下を即時反映
  - 推定 TTFT
  - 推定 decode latency / token
  - 推定 tokens/sec
  - ボトルネック判定（Cache/DRAM/SSD）
- メモリ階層ごとの bytes/token フロー表示
- L1-L3/SRAM/DRAM統計（hit/miss/待ち時間寄与）
- Compute→L1/L2/L3→DRAM→SSD のアーキテクチャ図パネル（DRAM/SSDアクセス強度を線色・太さで反映）

## 起動

静的ファイルのみです。次のどちらかで開けます。

```bash
python3 -m http.server 8000
# http://localhost:8000 を開く
```

または `index.html` を直接ブラウザで開いても動作します。

## 注意

このツールは教育向けの簡易モデルです。実機プロファイラ（perf、VTune、Nsight等）での実測値とは一致しません。
