#!/usr/bin/env node
// 庭プレビューのSVGを書き出す開発用スクリプト。
//   npx tsc -p tsconfig.test.json --ignoreDeprecations 6.0 && node scripts/render-garden-previews.js <outDir>
// 中央パネル(構図100%、north-star 照合用)/ ホーム 90% / 絵巻の左端・右端・中央を出す。

const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', '.test-dist');
const { deriveGrowth } = require(path.join(dist, 'garden', 'growth.js'));
const {
  buildScene, PAN_CENTER, PAN_MAX, EDGE_PEEK, HOME_CX, FRAME_W, HOME_CROP, VIEW_LOGICAL_W, WORLD_W,
} = require(path.join(dist, 'garden', 'scene.js'));
const { sceneToSvg } = require(path.join(dist, 'garden', 'preview-svg.js'));

const outDir = process.argv[2] || path.join(__dirname, '..', '.garden-previews');
fs.mkdirSync(outDir, { recursive: true });

const days = {
  day1: { stoneCount: 2, recordedDays: 1, savedMinutes: 30 },
  day42: { stoneCount: 2, recordedDays: 42, savedMinutes: 360 * 60 },
  day84: { stoneCount: 2, recordedDays: 84, savedMinutes: 210 * 60 }, // 210h = 満開(m=1.0)
};

const HOME_W = Math.round(FRAME_W * HOME_CROP); // 90% クロップ幅

for (const [name, snap] of Object.entries(days)) {
  const scene = buildScene(deriveGrowth(snap));
  // 中央パネル(構図100% = north-star 照合)
  fs.writeFileSync(
    path.join(outDir, `${name}-center.svg`),
    sceneToSvg(scene, { pan: PAN_CENTER, viewWidth: FRAME_W }),
  );
  // ホームの窓(構図の 90%・中心基準)
  fs.writeFileSync(
    path.join(outDir, `${name}-home.svg`),
    sceneToSvg(scene, { pan: HOME_CX - HOME_W / 2, viewWidth: HOME_W }),
  );
}

// 絵巻(Day84)。各スクロール位置(画面が見せる範囲)+ 全景パノラマ
{
  const scene = buildScene(deriveGrowth(days.day84));
  const emaki = {
    'emaki-center': PAN_CENTER, // 中央始まり(開扉直後 = ホームとほぼ同じ絵)
    'emaki-left': 0, // 左端で停止
    'emaki-right': PAN_MAX, // 右端で停止
    'emaki-peek': PAN_CENTER - EDGE_PEEK,
  };
  for (const [nm, pan] of Object.entries(emaki)) {
    fs.writeFileSync(path.join(outDir, `${nm}.svg`), sceneToSvg(scene, { pan, viewWidth: VIEW_LOGICAL_W }));
  }
}

// 3本の誓い(石3つ)
const scene3 = buildScene(deriveGrowth({ stoneCount: 3, recordedDays: 42, savedMinutes: 360 * 60 }));
fs.writeFileSync(path.join(outDir, 'day42-3stones.svg'), sceneToSvg(scene3, { pan: PAN_CENTER, viewWidth: FRAME_W }));

console.log(`wrote previews to ${outDir}`);
