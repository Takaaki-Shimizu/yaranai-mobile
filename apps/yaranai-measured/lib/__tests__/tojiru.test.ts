// 閉じ際演出「とじる」の検証(閉じ際演出指示書 §3・§4・§7)。
// 障子の描画そのもの(Skia)は実機確認だが、タイムラインと骨組みの必須要件は
// データで機械検証できる。ここが落ちる実装は §7 の受け入れ基準を満たさない。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SINK_OPACITY, TOJIRU_TIMELINE as TL, WASHI_OPACITY, washiOpacity,
} from '../tojiru/timeline';
import { MULLION_COLS, MULLION_ROWS, shojiOffset, shojiPanel } from '../tojiru/shoji';

// ---------------------------------------------------------------- タイムライン(§3)

test('A〜D が隙間なく連なり、合計 1200ms(§3)', () => {
  assert.equal(TL.exit.start, 0);
  assert.equal(TL.exit.start + TL.exit.duration, TL.garden.start);
  assert.equal(TL.garden.start + TL.garden.duration, TL.hold.start);
  assert.equal(TL.hold.start + TL.hold.duration, TL.shoji.start);
  assert.equal(TL.shoji.start + TL.shoji.duration, TL.total);
  assert.equal(TL.total, 1200);
});

test('区間の割り当ては指示書の表どおり(§3)', () => {
  assert.deepEqual(TL.exit, { start: 0, duration: 200 });
  assert.deepEqual(TL.garden, { start: 200, duration: 300 });
  assert.deepEqual(TL.hold, { start: 500, duration: 400 });
  assert.deepEqual(TL.shoji, { start: 900, duration: 300 });
});

test('背景の沈みは「わずかに」の範囲に収まる(§3-A)', () => {
  assert.ok(SINK_OPACITY > 0 && SINK_OPACITY <= 0.1);
});

// ---------------------------------------------------------------- 透け感(§4-3)

test('閉じ切る直前まで和紙越しに庭が透け、閉じ切りで不透明になる(§4-3)', () => {
  assert.ok(WASHI_OPACITY.from < 1, '開いている間は透けること');
  assert.equal(washiOpacity(1), 1, '閉じ切りは完全に不透明');
  assert.equal(washiOpacity(0), WASHI_OPACITY.from);
  // 進行に応じて単調に上がる(途中で薄くなる=透け感が戻ることはない)
  let prev = -1;
  for (let i = 0; i <= 10; i += 1) {
    const v = washiOpacity(i / 10);
    assert.ok(v > prev, `p=${i / 10} で不透明度が上がること`);
    prev = v;
  }
  // 0.9 の時点でもまだ庭が透けている(一瞬で真っ暗にならない)
  assert.ok(washiOpacity(0.9) < 1);
});

test('範囲外の進行値でも不透明度は 0〜1 に収まる', () => {
  assert.equal(washiOpacity(-1), WASHI_OPACITY.from);
  assert.equal(washiOpacity(2), 1);
});

// ---------------------------------------------------------------- 障子の骨組み(§4)

const panel = shojiPanel(390, 844); // 一般的な縦画面

test('障子は画面の半分ずつの二枚(§3-D)', () => {
  assert.equal(panel.width, 195);
  assert.equal(panel.height, 844);
});

test('桟は縦3本 × 横6本。指示書の目安(縦3〜4・横5〜7)に収まる(§4-1)', () => {
  assert.equal(panel.verticals.length, MULLION_COLS - 1);
  assert.equal(panel.horizontals.length, MULLION_ROWS - 1);
  assert.ok(panel.verticals.length >= 3 && panel.verticals.length <= 4);
  assert.ok(panel.horizontals.length >= 5 && panel.horizontals.length <= 7);
});

test('桟は框の内側を等分し、框に食い込まない(§4-1)', () => {
  for (const x of panel.verticals) {
    assert.ok(x - panel.mullion / 2 > panel.stile);
    assert.ok(x + panel.mullion / 2 < panel.width - panel.stile);
  }
  for (const y of panel.horizontals) {
    assert.ok(y - panel.mullion / 2 > panel.stile);
    assert.ok(y + panel.mullion / 2 < panel.height - panel.stile);
  }
  // 等間隔であること(格子が歪まない)
  const gap = panel.verticals[1] - panel.verticals[0];
  assert.ok(Math.abs(panel.verticals[2] - panel.verticals[1] - gap) < 1e-9);
});

test('框は桟より太い(§4-4)', () => {
  assert.ok(panel.stile > panel.mullion);
});

test('小さい画面でも桟と框が消えない', () => {
  const small = shojiPanel(240, 400);
  assert.ok(small.mullion >= 2);
  assert.ok(small.stile > small.mullion);
  assert.equal(small.verticals.length, 3);
  assert.equal(small.horizontals.length, 6);
});

// ---------------------------------------------------------------- 閉じの動き(§3-D)

test('閉じ進行 0 で画面外、1 で中央に出会う(§3-D)', () => {
  assert.equal(shojiOffset(panel.width, 0), panel.width); // 一枚ぶん外に退いている
  assert.equal(shojiOffset(panel.width, 1), 0); // 二枚が中央で接する
  assert.ok(shojiOffset(panel.width, 0.5) < shojiOffset(panel.width, 0.2));
});

test('演出は毎回同一。同じ入力なら同じ骨組み(§5・§7-6)', () => {
  assert.deepEqual(shojiPanel(390, 844), shojiPanel(390, 844));
});
