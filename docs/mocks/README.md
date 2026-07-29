# 庭ビジュアル 参照モック

実測版(`apps/yaranai-measured`)の庭刷新のデザイン基準。

## ファイル

- `yaranai-north-star-v3.html` — Day 84 完成形。レイヤー構造・色・座標の移植元(デザインの正)
- `yaranai-garden-growth.html` — Day 1 / Day 42。成長段階の表現の移植元
- `yaranai-launch-eyelevel-3patterns.html` — 起動演出「小径」。**案1(mockP)が採用案**。
  構図・タイムラインの移植元(シード84210固定)
- `yaranai-excuse-card-mock-v3.html` — 言い訳カード「夜の竹林と灯り」(デザインの正)。
  座標・色は `apps/yaranai-measured/lib/excuse/card-spec.ts` に移植されている。
  版下からの照合は `scripts/render-excuse-cards.js`(SVGを書き出して並べて見る)

SVGの座標・グラデーション定義・フィルタ設定は
`apps/yaranai-measured/lib/garden/scene.ts` にそのまま基準値として移植されている。
起動演出の生成ロジックは `apps/yaranai-measured/lib/launch/komichi.ts` に、
タイムラインは `lib/launch/timeline.ts` に移植されている。

## reference/

レンダリング済みスクリーンショット(実機レビュー時の比較用)。

## reference/

| ファイル | 元モック | 内容 |
|---|---|---|
| `garden-growth-day1.png` | yaranai-garden-growth.html | Day 1 — 乾いた地に石。道はまだ気配 |
| `garden-growth-day42.png` | yaranai-garden-growth.html | Day 42 — 苔がひろがり、道が半ばまで。竹林が姿を見せ始める |
| `north-star-v3-day84.png` | yaranai-north-star-v3.html | Day 84 — 木漏れ日の石畳が、竹林の奥へ(完成形) |
| `launch-komichi-mockP.png` | yaranai-launch-eyelevel-3patterns.html | 起動演出「小径」案1(採用) — 演出完了時の最終フレーム |

3枚とも構図・座標は完全に固定で、要素の「実り方」だけで時間を表現している。
