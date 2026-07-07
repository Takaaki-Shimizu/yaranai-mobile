# 庭ビジュアル 参照モック

実測版(`apps/yaranai-measured`)の庭刷新のデザイン基準。

## ファイル

- `yaranai-north-star-v3.html` — Day 84 完成形。レイヤー構造・色・座標の移植元(デザインの正)
- `yaranai-garden-growth.html` — Day 1 / Day 42。成長段階の表現の移植元

SVGの座標・グラデーション定義・フィルタ設定は
`apps/yaranai-measured/lib/garden/scene.ts` にそのまま基準値として移植されている。

## reference/

レンダリング済みスクリーンショット(実機レビュー時の比較用)。

## reference/

| ファイル | 元モック | 内容 |
|---|---|---|
| `garden-growth-day1.png` | yaranai-garden-growth.html | Day 1 — 乾いた地に石。道はまだ気配 |
| `garden-growth-day42.png` | yaranai-garden-growth.html | Day 42 — 苔がひろがり、道が半ばまで。竹林が姿を見せ始める |
| `north-star-v3-day84.png` | yaranai-north-star-v3.html | Day 84 — 木漏れ日の石畳が、竹林の奥へ(完成形) |

3枚とも構図・座標は完全に固定で、要素の「実り方」だけで時間を表現している。
