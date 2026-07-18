import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArticleBody } from '../markdown';

test('h2 見出しと段落を分ける', () => {
  const blocks = parseArticleBody('## 見出し\n\n本文の段落。');
  assert.deepEqual(blocks, [
    { type: 'h2', text: '見出し' },
    { type: 'p', text: '本文の段落。' },
  ]);
});

test('空行で段落を区切る', () => {
  const blocks = parseArticleBody('一段落め。\n\n二段落め。');
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], { type: 'p', text: '一段落め。' });
  assert.deepEqual(blocks[1], { type: 'p', text: '二段落め。' });
});

test('段落内の単一改行は行送りとして残す', () => {
  const blocks = parseArticleBody('一行め。\n二行め。');
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0], { type: 'p', text: '一行め。\n二行め。' });
});

test('CRLF を正規化し、余分な空行を潰す', () => {
  const blocks = parseArticleBody('## 題\r\n\r\n\r\n本文。\r\n');
  assert.deepEqual(blocks, [
    { type: 'h2', text: '題' },
    { type: 'p', text: '本文。' },
  ]);
});

test('空文字はブロックなし', () => {
  assert.deepEqual(parseArticleBody(''), []);
  assert.deepEqual(parseArticleBody('\n\n  \n'), []);
});
