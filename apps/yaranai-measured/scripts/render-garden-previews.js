#!/usr/bin/env node
// 庭プレビューのSVGを書き出す開発用スクリプト。
//   npm test でコンパイルされる .test-dist を使う:
//   npx tsc -p tsconfig.test.json && node scripts/render-garden-previews.js <outDir>
// Day 1 / 42 / 84 の中央パネル(モック照合用)と、絵巻の左端・右端を出す。

const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', '.test-dist');
const { deriveGrowth } = require(path.join(dist, 'garden', 'growth.js'));
const { buildScene, PAN_CENTER, PAN_MAX, EDGE_PEEK, HOME_CX } = require(path.join(dist, 'garden', 'scene.js'));
const { sceneToSvg } = require(path.join(dist, 'garden', 'preview-svg.js'));

const outDir = process.argv[2] || path.join(__dirname, '..', '.garden-previews');
fs.mkdirSync(outDir, { recursive: true });

const days = {
  day1: { stoneCount: 2, recordedDays: 1, savedMinutes: 30 },
  day42: { stoneCount: 2, recordedDays: 42, savedMinutes: 360 * 60 },
  day84: { stoneCount: 2, recordedDays: 84, savedMinutes: 720 * 60 },
};

for (const [name, snap] of Object.entries(days)) {
  const scene = buildScene(deriveGrowth(snap));
  const panes = {
    center: PAN_CENTER,
    left: 0,
    right: PAN_MAX,
    peek: PAN_CENTER - EDGE_PEEK,
  };
  for (const [pane, pan] of Object.entries(panes)) {
    if (name !== 'day84' && (pane === 'left' || pane === 'right' || pane === 'peek')) continue;
    const svg = sceneToSvg(scene, { pan });
    fs.writeFileSync(path.join(outDir, `${name}-${pane}.svg`), svg);
  }
}
// 3本の誓い(石3つ)の確認用
const scene3 = buildScene(deriveGrowth({ stoneCount: 3, recordedDays: 42, savedMinutes: 360 * 60 }));
fs.writeFileSync(path.join(outDir, 'day42-3stones.svg'), sceneToSvg(scene3, { pan: PAN_CENTER }));

// ホームの窓(1080×2340想定: 見える論理幅 ≒ 800×1080/1404 ≒ 615)
const HOME_VIEW_W = 615;
for (const [name, snap] of Object.entries(days)) {
  const scene = buildScene(deriveGrowth(snap));
  fs.writeFileSync(
    path.join(outDir, `${name}-home.svg`),
    sceneToSvg(scene, { pan: HOME_CX - HOME_VIEW_W / 2, viewWidth: HOME_VIEW_W }),
  );
}

console.log(`wrote previews to ${outDir}`);
