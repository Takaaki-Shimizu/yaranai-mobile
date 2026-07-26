// 一覧の並び・ホームの帯の選定(v1.1 §4.3 / §5.2)と、記事1の登録内容の検証。
// すべて純関数: ArticlesState は withFired/withRead で組み、AsyncStorage には触れない。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARTICLES, getArticle, SHINAI_KOTO_ID, TSUNDA_MONO_ID } from '../registry';
import { SHINAI_KOTO_BODY } from '../content/shinai-koto';
import { SHINAI_KOTO_BODY_EN } from '../content/shinai-koto-en';
import { withFired, withRead, isRead } from '../state';
import { newestUnread, articleSections, previewSections } from '../select';
import type { ArticlesState } from '../types';

const T1 = '2026-07-20T09:00:00.000Z'; // 記事1の発火(古い)
const T2 = '2026-07-24T09:00:00.000Z'; // 記事2の発火(新しい)

// 記事1が先に発火し、後から記事2が発火した典型状態。
function bothFired(): ArticlesState {
  let s: ArticlesState = {};
  s = withFired(s, SHINAI_KOTO_ID, T1);
  s = withFired(s, TSUNDA_MONO_ID, T2);
  return s;
}

// ---------------------------------------------------------------- 記事1の登録(v1.1 §3)

test('記事1: id・kind・タイトルが仕様どおり登録されている', () => {
  const article = getArticle(SHINAI_KOTO_ID)!;
  assert.ok(article);
  assert.equal(article.kind, 'standing');
  assert.equal(article.title.ja, 'このアプリが、あなたにしないこと');
  assert.ok(article.title.en.length > 0);
});

test('記事1: 本文に編集メモを含めない(v1.1 §3)。日英とも', () => {
  assert.ok(!SHINAI_KOTO_BODY.includes('編集メモ'));
  assert.ok(!SHINAI_KOTO_BODY.includes('---'));
  assert.ok(!SHINAI_KOTO_BODY_EN.includes('---'));
  // 本文はH1タイトルを含まず、確定稿の冒頭・結びで始まり終わる。
  assert.ok(SHINAI_KOTO_BODY.startsWith('はじめての方にも'));
  assert.ok(SHINAI_KOTO_BODY.trimEnd().endsWith('あなたのペースで大丈夫です。'));
});

test('記事2: conditional(crashedDay)として分類されている(リグレッション)', () => {
  const article = getArticle(TSUNDA_MONO_ID)!;
  assert.ok(article);
  assert.equal(article.kind, 'conditional');
  assert.equal(article.kind === 'conditional' ? article.trigger.kind : null, 'crashedDay');
});

// ---------------------------------------------------------------- ホームの帯(v1.1 §4.3)

test('両方が未読 → 帯は発火が新しい1本のみ(記事2)', () => {
  const strip = newestUnread(bothFired(), 'ja');
  assert.equal(strip?.id, TSUNDA_MONO_ID);
});

test('新しいほう(記事2)が既読 → 帯は未読の記事1に移る', () => {
  const s = withRead(bothFired(), TSUNDA_MONO_ID, '2026-07-25T09:00:00.000Z');
  const strip = newestUnread(s, 'ja');
  assert.equal(strip?.id, SHINAI_KOTO_ID);
});

test('両方既読 → 帯は出ない', () => {
  let s = bothFired();
  s = withRead(s, SHINAI_KOTO_ID, '2026-07-25T09:00:00.000Z');
  s = withRead(s, TSUNDA_MONO_ID, '2026-07-25T09:00:00.000Z');
  assert.equal(newestUnread(s, 'ja'), null);
});

// ---------------------------------------------------------------- 一覧の並び(v1.1 §5.2)

test('一覧: standing は conditional より常に上(発火が古くても沈まない)', () => {
  // 記事1の発火は記事2より古い。発火順なら記事1が下に沈むが、節で常に上に固定される。
  const sections = articleSections(bothFired(), 'ja');
  assert.deepEqual(sections.standing.map((a) => a.id), [SHINAI_KOTO_ID]);
  assert.deepEqual(sections.conditional.map((a) => a.id), [TSUNDA_MONO_ID]);
});

test('一覧: 既読になっても standing の位置は変わらない(未読の点だけ消える)', () => {
  const s = withRead(bothFired(), SHINAI_KOTO_ID, '2026-07-25T09:00:00.000Z');
  const sections = articleSections(s, 'ja');
  assert.equal(sections.standing[0].id, SHINAI_KOTO_ID);
  assert.equal(sections.standing[0].unread, false);
});

test('一覧: 未発火の記事は一覧に現れない(発火済みだけを並べる)', () => {
  let s: ArticlesState = {};
  s = withFired(s, SHINAI_KOTO_ID, T1);
  const sections = articleSections(s, 'ja');
  assert.equal(sections.standing.length, 1);
  assert.equal(sections.conditional.length, 0);
});

test('一覧: タイトルは表示言語で引ける(en)', () => {
  const sections = articleSections(bothFired(), 'en');
  assert.equal(sections.standing[0].title, getArticle(SHINAI_KOTO_ID)!.title.en);
  assert.equal(sections.conditional[0].title, getArticle(TSUNDA_MONO_ID)!.title.en);
});

test('開発者モードの一覧も standing が上・conditional が下', () => {
  const sections = previewSections('ja');
  assert.deepEqual(sections.standing.map((a) => a.id), [SHINAI_KOTO_ID]);
  assert.ok(sections.conditional.map((a) => a.id).includes(TSUNDA_MONO_ID));
});

// ---------------------------------------------------------------- 単調性(v1.1 §6-4)

test('記事1: 既読後に状態が巻き戻らない(再発火・再既読でも不変)', () => {
  let s: ArticlesState = {};
  s = withFired(s, SHINAI_KOTO_ID, T1);
  s = withRead(s, SHINAI_KOTO_ID, '2026-07-21T09:00:00.000Z');
  const settled = s;
  s = withFired(s, SHINAI_KOTO_ID, '2026-08-01T00:00:00.000Z');
  s = withRead(s, SHINAI_KOTO_ID, '2026-08-02T00:00:00.000Z');
  assert.equal(s, settled); // 同一参照 = 一切変化しない
  assert.equal(isRead(s, SHINAI_KOTO_ID), true);
  assert.equal(s[SHINAI_KOTO_ID].firedAt, T1);
});

// registry 全体の整合: id の重複が無いこと(既読状態のキー衝突を防ぐ)。
test('registry: 記事IDが重複しない', () => {
  const ids = ARTICLES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});
