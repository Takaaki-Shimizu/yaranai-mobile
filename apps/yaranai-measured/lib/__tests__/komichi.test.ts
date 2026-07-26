// 起動演出「小径」のコンポジション検証(起動演出指示書 §2・§8)。
// 描画そのもの(Skia)は実機確認だが、構図の必須要件はデータで機械検証できる。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKomichiScene, coverTransform, KOMICHI_LAYOUT, TAPER, VANISHING_POINT,
  type Stalk,
} from '../launch/komichi';
import { LAUNCH_TIMELINE as TL } from '../launch/timeline';

const scene = buildKomichiScene();
const byLayer = (layer: Stalk['layer']) => scene.stalks.filter((s) => s.layer === layer);

test('シード84210固定: 呼ぶたび同一の一点物(§2.4・§8-3)', () => {
  assert.equal(JSON.stringify(buildKomichiScene()), JSON.stringify(buildKomichiScene()));
});

test('竹は3層×計24本、片側12本(§2.1)', () => {
  assert.equal(scene.stalks.length, 24);
  assert.equal(byLayer('deep').length, 8);
  assert.equal(byLayer('mid').length, 8);
  assert.equal(byLayer('near').length, 8);
  // 片側12本ずつ
  assert.equal(scene.stalks.filter((s) => s.x < VANISHING_POINT.x).length, 12);
  assert.equal(scene.stalks.filter((s) => s.x > VANISHING_POINT.x).length, 12);
});

test('中・近層は3トーン(地・胴・稜線)+節、遠層は淡い単色(§2.1)', () => {
  for (const s of [...byLayer('mid'), ...byLayer('near')]) {
    assert.equal(s.prims.filter((p) => p.kind === 'poly').length, 3, '3トーンの重ね');
    assert.ok(s.nodeYs.length >= 2, '節が入っている');
    // 節は「暗い線+明帯」の2本組
    assert.equal(s.prims.filter((p) => p.kind === 'line').length, s.nodeYs.length * 2);
  }
  for (const s of byLayer('deep')) {
    assert.equal(s.prims.length, 1);
    const p = s.prims[0];
    assert.ok(p.kind === 'poly' && (p.opacity ?? 1) <= 0.75, '靄に沈む淡さ');
  }
});

test('遠近: 奥の竹ほど細く・短く・節間隔が詰まり、頂部は中央へ倒れ込む(§2.1)', () => {
  const width = (l: Stalk['layer']) => byLayer(l).reduce((a, s) => a + s.w, 0) / 8;
  assert.ok(width('near') > width('mid') && width('mid') > width('deep'));

  const gap = (l: Stalk['layer']) => {
    const gs: number[] = [];
    for (const s of byLayer(l)) {
      for (let i = 1; i < s.nodeYs.length; i++) gs.push(Math.abs(s.nodeYs[i] - s.nodeYs[i - 1]));
    }
    return gs.reduce((a, b) => a + b, 0) / gs.length;
  };
  assert.ok(gap('near') > gap('mid'), '節の間隔は奥の竹ほど詰まる');

  for (const s of scene.stalks) {
    const towardCenter = s.x < VANISHING_POINT.x ? s.topX > s.x : s.topX < s.x;
    assert.ok(towardCenter, '頂部が中央へ倒れ込む');
  }
});

test('末すぼまり: 根本→頂部でテーパー比0.82(§2.1)', () => {
  assert.ok(Math.abs(TAPER - 0.82) < 1e-9);
  for (const s of [...byLayer('mid'), ...byLayer('near')]) {
    const base = s.prims[0];
    if (base.kind !== 'poly') throw new Error('地のトーンは台形ポリゴン');
    const baseW = Math.abs(base.pts[2] - base.pts[0]);
    const topW = Math.abs(base.pts[4] - base.pts[6]);
    assert.ok(Math.abs(topW / baseW - TAPER) < 1e-6);
  }
});

test('参道(2トーン)・竹垣(横木+支柱)・土手のきめが揃っている(§2.2)', () => {
  const polys = scene.ground.filter((p) => p.kind === 'poly');
  assert.ok(polys.length >= 4, '参道2トーン+土手2枚');
  const rails = scene.ground.filter((p) => p.kind === 'line' && p.width > 2.4);
  assert.equal(rails.length, 2, '竹垣の横木は左右2本');
  const posts = scene.ground.filter((p) => p.kind === 'line' && p.width < 2.4);
  assert.equal(posts.length, 8, '支柱は左右4対');
  const dots = scene.ground.filter((p) => p.kind === 'circle');
  assert.equal(dots.length, 52, '土手の斑点(笹のきめ)');
});

test('開口部(文字の光の場所)に葉叢・中近層の竹がかからない(§2.2・§8-4)', () => {
  // 文字ゾーン: 題字+コピーの帯(シーン座標)。実測で mid/near は中心から53px以上離れている
  const zone = { x0: 95, x1: 205, y0: 230, y1: 350 };
  for (const s of [...byLayer('mid'), ...byLayer('near')]) {
    for (const y of [zone.y0, zone.y1]) {
      const t = (s.yB - y) / (s.yB - s.yT);
      if (t < 0 || t > 1) continue;
      const cx = s.x + (s.topX - s.x) * t;
      const hw = s.w * (1 + (TAPER - 1) * t);
      assert.ok(Math.abs(cx - VANISHING_POINT.x) - hw > 40, `竹が開口部を侵食: cx=${cx.toFixed(1)} y=${y}`);
    }
  }
  for (const p of scene.canopy) {
    if (p.kind !== 'ellipse') throw new Error('葉叢は楕円のみ');
    // 回転はクラスタ中心まわりなので、中心からの最大到達距離で保守的に判定
    const reach = p.rx + Math.hypot(p.cx - p.px, p.cy - p.py);
    const dx = Math.max(zone.x0 - p.px, p.px - zone.x1, 0);
    const dy = Math.max(zone.y0 - p.py, p.py - zone.y1, 0);
    assert.ok(Math.hypot(dx, dy) - reach > 20, '葉叢が開口部を侵食');
  }
});

test('中心光は文字の真後ろ(§3)', () => {
  const { lights, halo, brandTop } = KOMICHI_LAYOUT;
  assert.equal(lights.core.cx, VANISHING_POINT.x);
  // 題字ブロック(41%起点)は中心光の楕円の中に収まる
  assert.ok(brandTop > lights.core.cy - lights.core.ry && brandTop < lights.core.cy + lights.core.ry);
  assert.ok(Math.abs(halo.cy - lights.core.cy) <= 10, '影の暈も同じ場所');
});

test('カバー変換: 消失点はほぼ画面中央、全面を覆う(§3)', () => {
  for (const [w, h] of [[390, 844], [360, 800], [412, 915], [300, 640]]) {
    const { s, ox, oy } = coverTransform(w, h);
    assert.ok(ox <= 0 && oy <= 0, 'はみ出しはあっても隙間はない');
    assert.ok(300 * s + ox * 2 >= w - 1e-6 && 640 * s + oy * 2 >= h - 1e-6);
    const vpx = ox + VANISHING_POINT.x * s;
    assert.ok(Math.abs(vpx - w / 2) < 1e-6, '消失点Xは画面中央');
  }
});

test('タイムライン: 総尺2000ms・帳は冒頭250ms完全な黒・順序(§4・§8-5,6)', () => {
  assert.equal(TL.total, 2000);
  assert.equal(TL.veil.delay, 250);
  assert.equal(TL.veil.delay + TL.veil.duration, 1600);
  // 各起点は指示書の表と一致
  assert.equal(TL.camera.delay, 150);
  assert.equal(TL.core.delay, 300);
  assert.equal(TL.side.delayLeft, 600);
  assert.equal(TL.side.delayRight, 820);
  assert.equal(TL.halo.delay, 1000);
  assert.equal(TL.glow.delay, 1050);
  assert.equal(TL.copy.delay, 1300);
  // 題字は光量(グロー)が先、輪郭(上層)が後。すべて総尺±100ms内に収束
  assert.ok(TL.glow.delay <= TL.title.delay);
  const ends = [
    TL.veil.delay + TL.veil.duration,
    TL.camera.delay + TL.camera.duration,
    TL.core.delay + TL.core.duration,
    TL.side.delayRight + TL.side.duration,
    TL.halo.delay + TL.halo.duration,
    TL.glow.delay + TL.glow.rise + TL.glow.settle,
    TL.title.delay + TL.title.duration,
    TL.copy.delay + TL.copy.duration,
  ];
  for (const e of ends) assert.ok(e <= TL.total + 100, `終端が総尺を超過: ${e}`);
});
