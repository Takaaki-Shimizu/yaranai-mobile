import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDEAL_MAX_LENGTH, idealLength, validateIdeal } from '../validate';

test('idealLength: 絵文字はコードポイント1文字として数える', () => {
  assert.equal(idealLength('🌱'), 1);
  assert.equal('🌱'.length, 2); // String#length は UTF-16 単位なので2。これを使わない根拠
  assert.equal(idealLength('庭を🌱に'), 4);
});

test('validateIdeal: 20文字ちょうどは通る', () => {
  const twenty = 'あ'.repeat(IDEAL_MAX_LENGTH);
  const result = validateIdeal(twenty);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value, twenty);
});

test('validateIdeal: 絵文字を含む20文字が通る(サロゲートペアで弾かれない)', () => {
  const text = '🌱'.repeat(IDEAL_MAX_LENGTH); // UTF-16 では40単位
  const result = validateIdeal(text);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value, text);
});

test('validateIdeal: 21文字は拒否する', () => {
  const result = validateIdeal('あ'.repeat(IDEAL_MAX_LENGTH + 1));
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.length, IDEAL_MAX_LENGTH + 1);
});

test('validateIdeal: 絵文字21文字も拒否する', () => {
  const result = validateIdeal('🌱'.repeat(IDEAL_MAX_LENGTH + 1));
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.length, IDEAL_MAX_LENGTH + 1);
});

test('validateIdeal: trim してから数える(前後の空白は上限に含めない)', () => {
  const result = validateIdeal(`  ${'あ'.repeat(IDEAL_MAX_LENGTH)}  `);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value, 'あ'.repeat(IDEAL_MAX_LENGTH));
});

test('validateIdeal: 空文字は許可する(理想の削除)', () => {
  const result = validateIdeal('');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value, '');
});

test('validateIdeal: 空白だけの入力は空文字として通る', () => {
  const result = validateIdeal('   ');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value, '');
});
