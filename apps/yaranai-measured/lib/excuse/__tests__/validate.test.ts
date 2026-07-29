import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXCUSE_CARD_LINE_WIDTH, EXCUSE_MAX_WIDTH,
  excuseLines, excuseSentence, excuseWidth, normalizeExcuse, validateExcuse,
} from '../validate';

test('excuseWidth: 全角は1、半角は0.5で数える', () => {
  assert.equal(excuseWidth('やらない'), 4);
  assert.equal(excuseWidth('abcd'), 2);
  assert.equal(excuseWidth('、'), 1);
});

test('excuseWidth: 絵文字はサロゲートペアでも1字(全角)として数える', () => {
  assert.equal(excuseWidth('🌱'), 1);
  assert.equal('🌱'.length, 2); // String#length は UTF-16 単位。これを使わない根拠
});

// ---- 型はアプリが添える --------------------------------------------------
test('excuseSentence: 「はやらない。」はアプリが添える', () => {
  assert.equal(
    excuseSentence('ショート動画があるアプリ', 'ja'),
    'ショート動画があるアプリはやらない。',
  );
  assert.equal(excuseSentence('Short-video apps', 'en'), 'Short-video apps, I won’t.');
});

test('excuseSentence: 空の入力には型を添えない', () => {
  assert.equal(excuseSentence('   ', 'ja'), '');
});

test('normalizeExcuse: 習慣で書いた「はやらない。」は落とす(二重に添えない)', () => {
  assert.equal(normalizeExcuse('ショート動画があるアプリは、やらない。'), 'ショート動画があるアプリ');
  assert.equal(normalizeExcuse('二次会はやらない'), '二次会');
  assert.equal(normalizeExcuse('深夜の通話はやりません。'), '深夜の通話');
  assert.equal(normalizeExcuse('Late-night calls, I won’t.'), 'Late-night calls');
  assert.equal(
    excuseSentence('ショート動画があるアプリは、やらない。', 'ja'),
    'ショート動画があるアプリはやらない。',
  );
});

test('normalizeExcuse: 「やらない」だけの入力は空にしない', () => {
  assert.equal(normalizeExcuse('やらない'), 'やらない');
});

test('normalizeExcuse: 改行を落とし、前後の空白と末尾の句読点を落とす', () => {
  assert.equal(normalizeExcuse('  二次\n会 '), '二次会');
  assert.equal(normalizeExcuse('二次会、'), '二次会');
});

// ---- 行組みもアプリが決める ----------------------------------------------
test('excuseLines: 1行に収まるなら1行のまま(読点で割らない)', () => {
  assert.deepEqual(excuseLines('二次会', 'ja'), ['二次会はやらない。']);
});

test('excuseLines: 収まらないときだけ「◯◯は」/「やらない。」に割る', () => {
  assert.deepEqual(
    excuseLines('ショート動画があるアプリ', 'ja'),
    ['ショート動画があるアプリは', 'やらない。'],
  );
});

test('excuseLines: 英語も同じ規則で割れる', () => {
  assert.deepEqual(excuseLines('Late-night calls', 'en'), ['Late-night calls, I won’t.']);
  assert.deepEqual(
    excuseLines('Video in the background', 'en'),
    ['Video in the background,', 'I won’t.'],
  );
});

test('excuseLines: 上限まで書いても2行まで。型の行は必ず1行の幅に収まる', () => {
  for (const lang of ['ja', 'en'] as const) {
    const longest = lang === 'ja' ? 'あ'.repeat(EXCUSE_MAX_WIDTH) : 'a'.repeat(EXCUSE_MAX_WIDTH * 2);
    assert.equal(excuseWidth(longest), EXCUSE_MAX_WIDTH);
    const lines = excuseLines(longest, lang);
    assert.ok(lines.length === 2);
    // 1行目(「◯◯は」)は最長で上限+1字。基準幅を超えるぶんは描画側が安全幅へ縮める
    assert.ok(excuseWidth(lines[0]) <= EXCUSE_MAX_WIDTH + 1);
    // 型の行(「やらない。」)は基準の1行幅に収まる
    assert.ok(excuseWidth(lines[1]) <= EXCUSE_CARD_LINE_WIDTH);
  }
});

test('excuseLines: 空の入力は行を作らない', () => {
  assert.deepEqual(excuseLines('', 'ja'), []);
});

// ---- 検証 ------------------------------------------------------------------
test('validateExcuse: モックの顔(確定例文)が通る', () => {
  const result = validateExcuse('ショート動画があるアプリ');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value, 'ショート動画があるアプリ');
});

test('validateExcuse: 上限は理想と同じ全角20字。ちょうどは通り、超えたら拒否する', () => {
  assert.equal(EXCUSE_MAX_WIDTH, 20);
  assert.equal(validateExcuse('あ'.repeat(EXCUSE_MAX_WIDTH)).ok, true);
  const tooLong = validateExcuse('あ'.repeat(EXCUSE_MAX_WIDTH + 1));
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.ok === false && tooLong.reason, 'tooLong');
});

test('validateExcuse: 型を書き添えても、落としたぶんで長さを見る', () => {
  // 「は、やらない。」ぶんは数えない ── 保存するのは「やらないこと」だけ
  const result = validateExcuse(`${'あ'.repeat(EXCUSE_MAX_WIDTH)}は、やらない。`);
  assert.equal(result.ok, true);
  assert.equal(result.ok && excuseWidth(result.value), EXCUSE_MAX_WIDTH);
});

test('validateExcuse: 読点をいくつ打っても拒否しない(行組みは人に問わない)', () => {
  assert.equal(validateExcuse('あ、い、う').ok, true);
});

test('validateExcuse: 空文字・空白だけは拒否する(白紙の宣言は存在しない)', () => {
  const blank = validateExcuse('   ');
  assert.equal(validateExcuse('').ok, false);
  assert.equal(blank.ok, false);
  assert.equal(blank.ok === false && blank.reason, 'empty');
});
