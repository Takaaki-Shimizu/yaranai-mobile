import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS } from '../../i18n/strings';
import { CARD_LAYOUTS, CARD_SIZES, declarationBaselines } from '../card-spec';
import { formatDeclaredOn, parseDeclaredOn } from '../format';
import { EXCUSE_PLACEHOLDERS, pickPlaceholder } from '../placeholders';
import { buildQrMatrix } from '../qr';
import { EXCUSE_CARD_URL } from '../url';
import {
  EXCUSE_CARD_LINE_WIDTH, EXCUSE_MAX_WIDTH, excuseLines, excuseWidth, validateExcuse,
} from '../validate';

// ---- 書き出しの2サイズ(§2-8) -------------------------------------------
test('カードは 1080×1080 と 1080×1920 の2サイズ', () => {
  assert.deepEqual(CARD_SIZES, ['square', 'story']);
  assert.deepEqual(
    [CARD_LAYOUTS.square.width, CARD_LAYOUTS.square.height],
    [1080, 1080],
  );
  assert.deepEqual(
    [CARD_LAYOUTS.story.width, CARD_LAYOUTS.story.height],
    [1080, 1920],
  );
});

// ---- 朱は一切使わない(§2-5 / §8) ---------------------------------------
test('版下に朱(#B9482F / #B0472F)が現れない', () => {
  const serialized = JSON.stringify(CARD_LAYOUTS).toUpperCase();
  assert.ok(!serialized.includes('B9482F'));
  assert.ok(!serialized.includes('B0472F'));
});

test('宣言文のベースラインは行数で切り替わる(1行は2行の中間)', () => {
  for (const size of CARD_SIZES) {
    const layout = CARD_LAYOUTS[size];
    assert.deepEqual(declarationBaselines(layout, 1), [layout.declaration.singleBaseline]);
    assert.deepEqual(declarationBaselines(layout, 2), [
      layout.declaration.baselines[0], layout.declaration.baselines[1],
    ]);
    // 1行のベースラインは2行の中間にある
    const [a, b] = layout.declaration.baselines;
    assert.ok(layout.declaration.singleBaseline > a && layout.declaration.singleBaseline < b);
  }
});

test('QRは生成り面に墨のモジュール(暗地に暗QRを置かない §5-5)', () => {
  for (const size of CARD_SIZES) {
    const { qr } = CARD_LAYOUTS[size];
    assert.equal(qr.panelColor, '#F2EDE1');
    assert.equal(qr.moduleColor, '#2E2B26');
    // 静穏帯は生成り面の内側に取る
    assert.ok(qr.quietModules >= 2);
  }
});

// ---- QR(§9-3) ------------------------------------------------------------
test('QRの遷移先に utm_source=excuse_card が付いている', () => {
  assert.equal(EXCUSE_CARD_URL, 'https://yaranai.app/?utm_source=excuse_card');
});

test('QRは正方形の行列で、三隅に位置検出パターンが立つ', () => {
  const matrix = buildQrMatrix(EXCUSE_CARD_URL);
  const n = matrix.length;
  assert.ok(n >= 21 && n % 4 === 1); // QRのモジュール数は 21, 25, 29, ...
  for (const row of matrix) assert.equal(row.length, n);

  // 位置検出パターン: 7×7 の枠が左上・右上・左下に立つ
  const finderAt = (r0: number, c0: number) => {
    for (let i = 0; i < 7; i += 1) {
      assert.equal(matrix[r0][c0 + i], i === 0 || i === 6 ? true : matrix[r0][c0 + i]);
    }
    // 外周は黒、その内側1周は白、中央3×3は黒
    assert.equal(matrix[r0][c0], true);
    assert.equal(matrix[r0 + 1][c0 + 1], false);
    assert.equal(matrix[r0 + 3][c0 + 3], true);
  };
  finderAt(0, 0);
  finderAt(0, n - 7);
  finderAt(n - 7, 0);
});

// ---- はみ出し禁止(§9-2) ----------------------------------------------
test('全角14字×2行の最長ケースが、字を縮めずに安全幅へ収まる', () => {
  // 明朝の全角は1字ぶんの送りが font-size とほぼ等しい。字送りは字と字の間だけ入る
  const widthOf = (chars: number, size: number, ls: number) => chars * size + (chars - 1) * ls;
  for (const size of CARD_SIZES) {
    const d = CARD_LAYOUTS[size].declaration;
    const longest = widthOf(EXCUSE_CARD_LINE_WIDTH, d.size, d.letterSpacing);
    assert.ok(longest <= d.safeWidth, `${size}: 最長行 ${longest}px が安全幅 ${d.safeWidth}px を超える`);
    // 安全幅そのものも版面の内側に収まっていること
    assert.ok(d.safeWidth <= CARD_LAYOUTS[size].width - 80);
  }
});

test('QRの面が、預かりの一文の左端より内側に収まる', () => {
  const modules = buildQrMatrix(EXCUSE_CARD_URL).length;
  for (const size of CARD_SIZES) {
    const layout = CARD_LAYOUTS[size];
    const { qr, custody } = layout;
    const panel = Math.round(qr.size / (modules + qr.quietModules * 2)) * (modules + qr.quietModules * 2);
    // このサイズで実際に刷る預かりの一文の、いちばん長い行の左端(中央寄せ)。
    // 日本語(全角)がいちばん幅を食うので、そちらだけ見れば足りる
    const longest = Math.max(
      ...STRINGS.ja.excuse.card.custody[size]
        .map((line) => line.length * (custody.size + custody.letterSpacing)),
    );
    const custodyLeft = custody.cx - longest / 2;
    assert.ok(
      qr.x + panel < custodyLeft,
      `${size}: QR(右端 ${qr.x + panel})が預かりの一文(左端 ${custodyLeft})に重なる`,
    );
    // 面と「Yaranaiとは」がカードの下辺からはみ出さない
    assert.ok(qr.label.y + qr.label.size <= layout.height);
  }
});

test('QRのモジュールは、カードの面のなかで実寸4px以上になる', () => {
  const modules = buildQrMatrix(EXCUSE_CARD_URL).length;
  for (const size of CARD_SIZES) {
    const { qr } = CARD_LAYOUTS[size];
    const across = modules + qr.quietModules * 2;
    assert.ok(
      Math.round(qr.size / across) >= 4,
      `${size}: 1モジュールが4px未満だと実機カメラで読みにくい`,
    );
  }
});

// ---- 宣言日(§2-3) --------------------------------------------------------
test('宣言日は数字の年月日。月日はゼロ埋めしない', () => {
  assert.equal(formatDeclaredOn('2026-07-29', 'ja'), '2026年7月29日 宣言');
  assert.equal(formatDeclaredOn('2026-07-29', 'en'), 'Declared July 29, 2026');
});

test('宣言日が読めないときは空文字(日付の行ごと出さない)', () => {
  assert.equal(parseDeclaredOn('2026-13-01'), null);
  assert.equal(formatDeclaredOn('', 'ja'), '');
});

// ---- 例文(§7) ------------------------------------------------------------
test('例文はすべて入力規則を満たし、カードの行にも収まる(そのまま打ち込める)', () => {
  for (const lang of ['ja', 'en'] as const) {
    for (const example of EXCUSE_PLACEHOLDERS[lang]) {
      const result = validateExcuse(example);
      assert.equal(result.ok, true, `${example} が入力規則を外れている`);
      assert.ok(excuseWidth(example) <= EXCUSE_MAX_WIDTH);
      const lines = excuseLines(example, lang);
      assert.ok(lines.length >= 1 && lines.length <= 2);
      for (const line of lines) {
        assert.ok(excuseWidth(line) <= EXCUSE_CARD_LINE_WIDTH, `${line} が1行に収まらない`);
      }
    }
  }
});

test('例文には宣言の型(「はやらない。」)を含めない ── 型はアプリが添える', () => {
  for (const example of EXCUSE_PLACEHOLDERS.ja) assert.ok(!example.includes('やらない'));
  for (const example of EXCUSE_PLACEHOLDERS.en) assert.ok(!/won[’']t/.test(example));
});

test('例文に「愚痴の聞き役」「なんとなくの残業」は入れない(§7)', () => {
  const all = EXCUSE_PLACEHOLDERS.ja.join('/');
  assert.ok(!all.includes('愚痴'));
  assert.ok(!all.includes('残業'));
});

test('確定例文(モックの顔)が先頭にあり、型を添えるとモックの一文になる', () => {
  assert.equal(EXCUSE_PLACEHOLDERS.ja[0], 'ショート動画があるアプリ');
  assert.deepEqual(
    excuseLines(EXCUSE_PLACEHOLDERS.ja[0], 'ja'),
    ['ショート動画があるアプリは', 'やらない。'],
  );
});

test('pickPlaceholder: 乱数の端でも範囲から外れない', () => {
  assert.equal(pickPlaceholder('ja', 0), EXCUSE_PLACEHOLDERS.ja[0]);
  assert.equal(
    pickPlaceholder('ja', 0.999999),
    EXCUSE_PLACEHOLDERS.ja[EXCUSE_PLACEHOLDERS.ja.length - 1],
  );
  // 1.0 は Math.random が返さない値だが、渡されても壊れない
  assert.ok(EXCUSE_PLACEHOLDERS.ja.includes(pickPlaceholder('ja', 1)));
});
