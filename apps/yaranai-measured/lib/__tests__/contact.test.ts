import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMailtoUrl, CONTACT_EMAIL } from '../contact';

// 受け入れ条件(スペック §8): 件名が文字化けせず、本文の日本語・改行が壊れないこと。
// mailto: URL は開く側のメールアプリがデコードするため、
// 「エンコードして往復させたら原文に戻る」ことをここで固定する。

// mailto:...?subject=...&body=... から subject / body を取り出してデコードする
function decodeQuery(url: string): { subject: string; body: string } {
  const query = url.slice(url.indexOf('?') + 1);
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    out[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
  }
  return { subject: out.subject ?? '', body: out.body ?? '' };
}

test('宛先は support@yaranai.app で、subject と body がクエリに乗る', () => {
  const url = buildMailtoUrl(CONTACT_EMAIL, 'Yaranai お問い合わせ', 'こんにちは');
  assert.ok(url.startsWith('mailto:support@yaranai.app?subject='));
  assert.ok(url.includes('&body='));
});

test('日本語・改行・記号がエンコード往復で欠落しない', () => {
  const body = [
    '',
    '',
    '',
    '――― 以下は不具合調査のための情報です ―――',
    '（不要であれば削除してください）',
    '',
    'アプリ: Yaranai 1.0.0 (12)',
    '記録日数: 42日',
  ].join('\n');
  const url = buildMailtoUrl(CONTACT_EMAIL, 'Yaranai お問い合わせ', body);
  const decoded = decodeQuery(url);
  assert.equal(decoded.subject, 'Yaranai お問い合わせ');
  assert.equal(decoded.body, body);
});

test('生の改行・空白・& がクエリ文字列に残らない(一部メールアプリで本文が欠ける)', () => {
  const url = buildMailtoUrl(CONTACT_EMAIL, 'a&b c', 'line1\nline2 & more');
  const query = url.slice(url.indexOf('?') + 1);
  assert.ok(!query.includes('\n'));
  assert.ok(!query.includes(' '));
  // & は subject と body を区切る1個だけ
  assert.equal(query.split('&').length, 2);
});
