import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOIL_MIN_SIZE,
  FOOTER_BASE_HEIGHT,
  FOOTER_FOILS,
  FOOTER_PIECES,
  HEADER_FOILS,
  HEADER_MOTIF_HEIGHT,
  HEADER_PIECES,
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

test('piecePath は頂点列から閉じた多角形パスを作る', () => {
  assert.equal(
    piecePath({ points: [[-40, -30], [120, -50], [170, 60]], fill: '#000', opacity: 1 }),
    'M-40 -30 L 120 -50 L 170 60 Z',
  );
});
