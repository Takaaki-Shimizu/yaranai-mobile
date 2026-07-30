import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOIL_MIN_SIZE,
  FOOTER_BASE_HEIGHT,
  FOOTER_FOILS,
  FOOTER_PIECES,
  GOLD_RULE,
  HEADER_FOILS,
  HEADER_MOTIF_HEIGHT,
  HEADER_PIECES,
  PIECE_EDGE,
  piecePath,
} from '../washi/motif';

test('意匠の構成: ヘッダー紙片2+箔2 / フッター紙片5+箔2(§4・§5)', () => {
  assert.equal(HEADER_PIECES.length, 2);
  assert.equal(HEADER_FOILS.length, 2);
  assert.equal(FOOTER_PIECES.length, 5);
  assert.equal(FOOTER_FOILS.length, 2);
});

test('金箔はすべて最小サイズ8dp以上(§8)', () => {
  assert.equal(FOIL_MIN_SIZE, 8);
  for (const foil of [...HEADER_FOILS, ...FOOTER_FOILS]) {
    assert.ok(foil.size >= FOIL_MIN_SIZE, `箔 ${foil.size}dp は下限 ${FOIL_MIN_SIZE}dp 未満`);
  }
});

test('フッターの金箔はアイコン帯(56dp)内に収まり、どの端末でも見える', () => {
  // 箔は縦ストレッチに載せないので y は帯上端からの dp。下インセットの
  // 大きい端末でも隠れないよう、インセット除きの帯高 56(FOOTER_HEIGHT)以内。
  for (const foil of FOOTER_FOILS) {
    assert.ok(foil.y >= 0 && foil.y + foil.size <= 56, `箔 y=${foil.y} が帯の外`);
  }
});

test('ヘッダー紙片はキャンバスの縦範囲(150dp)に収まる', () => {
  const maxY = Math.max(...HEADER_PIECES.flatMap((p) => p.points.map(([, y]) => y)));
  assert.equal(maxY, HEADER_MOTIF_HEIGHT);
});

test('フッター意匠のローカル座標は帯(72dp)基準', () => {
  assert.equal(FOOTER_BASE_HEIGHT, 72);
  // 頂点は帯の外(負・帯下)に出てよいが、極端に逸脱しない(クリップ前提の範囲)
  for (const p of FOOTER_PIECES) {
    for (const [, y] of p.points) {
      assert.ok(y >= -20 && y <= FOOTER_BASE_HEIGHT + 20, `y=${y} が想定範囲外`);
    }
  }
});

test('紙片の際は輪郭であって塗りの濃さではない', () => {
  // 存在感は opacity ではなく輪郭で稼ぐ約束。線が太ると紙の耳ではなく枠に見える
  assert.equal(PIECE_EDGE.width, 1);
  // 紙片より濃い色でないと際が沈む(#A2957B < washi4 #BFB49B の明度)
  assert.ok(PIECE_EDGE.color < '#BFB49B');
});

test('金の界線: 色と位置の停止点が対応し、両端は地に抜ける', () => {
  assert.equal(GOLD_RULE.colors.length, GOLD_RULE.stops.length);
  // 停止点は 0..1 の昇順
  assert.equal(GOLD_RULE.stops[0], 0);
  assert.equal(GOLD_RULE.stops[GOLD_RULE.stops.length - 1], 1);
  for (let i = 1; i < GOLD_RULE.stops.length; i++) {
    assert.ok(GOLD_RULE.stops[i] > GOLD_RULE.stops[i - 1], '停止点が昇順でない');
  }
  // 両端はアルファ00(切り落とすと題字の下線・三本線への突き当たりに見える)
  const ends = [GOLD_RULE.colors[0], GOLD_RULE.colors[GOLD_RULE.colors.length - 1]];
  for (const c of ends) {
    assert.ok(/^#[0-9A-Fa-f]{6}00$/.test(c), `端の色 ${c} が透明でない`);
  }
  // 1dp を超えると箔ではなく罫に見える
  assert.equal(GOLD_RULE.thickness, 1);
  // 三本線(20x14)に触れない間合い
  assert.ok(GOLD_RULE.gapEnd >= 16, '三本線との間合いが近すぎる');
});

test('piecePath は頂点列から閉じた多角形パスを作る', () => {
  assert.equal(
    piecePath({ points: [[-40, -30], [120, -50], [170, 60]], fill: '#000', opacity: 1 }),
    'M-40 -30 L 120 -50 L 170 60 Z',
  );
});
