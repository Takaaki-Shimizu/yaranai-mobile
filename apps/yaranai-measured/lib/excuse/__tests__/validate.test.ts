import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXCUSE_MAX_LINE_WIDTH, EXCUSE_MAX_WIDTH,
  excuseWidth, normalizeExcuse, splitExcuseLines, validateExcuse,
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

test('splitExcuseLines: 読点で2行に割り、読点は行末に残す', () => {
  assert.deepEqual(
    splitExcuseLines('ショート動画があるアプリは、やらない。'),
    ['ショート動画があるアプリは、', 'やらない。'],
  );
});

test('splitExcuseLines: 読点がなければ1行のまま', () => {
  assert.deepEqual(splitExcuseLines('二次会はやらない。'), ['二次会はやらない。']);
});

test('splitExcuseLines: 末尾の読点で空行を作らない', () => {
  assert.deepEqual(splitExcuseLines('即レスは、'), ['即レスは、']);
});

test('splitExcuseLines: 半角カンマも読点として扱う', () => {
  assert.deepEqual(splitExcuseLines('Late-night calls, I won’t.'), ['Late-night calls,', 'I won’t.']);
});

test('normalizeExcuse: 改行を落とし、前後の空白を落とす', () => {
  assert.equal(normalizeExcuse('  二次会は、\nやらない。 '), '二次会は、やらない。');
});

test('validateExcuse: モックの顔(確定例文)が通り、2行に割れる', () => {
  const result = validateExcuse('ショート動画があるアプリは、やらない。');
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.lines, ['ショート動画があるアプリは、', 'やらない。']);
});

test('validateExcuse: 全角24字ちょうどは通る(14字+10字の最長ケース)', () => {
  // 14字目が読点。1行目=14字、2行目=10字 で合計24字
  const text = `${'あ'.repeat(13)}、${'い'.repeat(10)}`;
  assert.equal(excuseWidth(text), EXCUSE_MAX_WIDTH);
  const result = validateExcuse(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.lines.map(excuseWidth), [14, 10]);
});

test('validateExcuse: 全角25字は拒否する', () => {
  const result = validateExcuse('あ'.repeat(EXCUSE_MAX_WIDTH + 1));
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'tooLong');
});

test('validateExcuse: 読点2つ(3行)は拒否する', () => {
  const result = validateExcuse('あ、い、う');
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'tooManyLines');
});

test('validateExcuse: 1行が15字を超えると拒否する(24字以内でも)', () => {
  const text = 'あ'.repeat(EXCUSE_MAX_LINE_WIDTH + 1);
  assert.ok(excuseWidth(text) <= EXCUSE_MAX_WIDTH);
  const result = validateExcuse(text);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'lineTooLong');
});

test('validateExcuse: 空文字・空白だけは拒否する(白紙の宣言は存在しない)', () => {
  assert.equal(validateExcuse('').ok, false);
  assert.equal(validateExcuse('   ').ok, false);
});

test('validateExcuse: 英語の宣言も全角換算で通る', () => {
  const result = validateExcuse('Late-night calls, I won’t.');
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.lines, ['Late-night calls,', 'I won’t.']);
});
