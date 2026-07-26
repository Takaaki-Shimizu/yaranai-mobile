import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNoisePackage, labelForPackage } from '../app-labels';

test('端末の正式名が最優先(「みてね」を Mitene と出さない)', () => {
  const official = { 'us.mitene': 'みてね', 'com.android.chrome': 'Chrome' };
  assert.equal(labelForPackage('us.mitene', official), 'みてね');
  // 対応表と正式名が食い違うときも端末の正式名を採る
  assert.equal(labelForPackage('jp.naver.line.android', { 'jp.naver.line.android': 'LINE' }), 'LINE');
});

test('正式名が引けんパッケージは対応表 → 整形へ倒れる', () => {
  const official = { 'us.mitene': 'みてね' };
  assert.equal(labelForPackage('jp.naver.line.android', official), 'LINE');
  assert.equal(labelForPackage('com.google.android.apps.maps', official), 'Google マップ');
  assert.equal(labelForPackage('com.example.wallet', official), 'Wallet');
});

test('空文字や空白だけの正式名は無かったものとして扱う', () => {
  assert.equal(labelForPackage('jp.naver.line.android', { 'jp.naver.line.android': '  ' }), 'LINE');
  assert.equal(labelForPackage('com.example.wallet', { 'com.example.wallet': '' }), 'Wallet');
});

test('表を渡さんときは従来どおり(対応表 → 整形)', () => {
  assert.equal(labelForPackage('com.netflix.mediaclient'), 'Netflix');
  assert.equal(labelForPackage('us.mitene'), 'Mitene');
});

test('前後の空白は落として出す', () => {
  assert.equal(labelForPackage('us.mitene', { 'us.mitene': ' みてね ' }), 'みてね');
});

test('観測から外すのはランチャー・入力メソッド・自分自身だけ', () => {
  assert.equal(isNoisePackage('app.yaranai.measured'), true);
  assert.equal(isNoisePackage('com.google.android.inputmethod.latin'), true);
  assert.equal(isNoisePackage('us.mitene'), false);
});
