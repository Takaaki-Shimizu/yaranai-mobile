import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFired, withRead, isFired, isRead, isUnread } from '../state';
import type { ArticlesState } from '../types';

const ID = 'tsunda-mono';

test('withFired: 未発火なら null 既読でエントリを追加する', () => {
  const next = withFired({}, ID, '2026-07-18T00:00:00.000Z');
  assert.deepEqual(next[ID], { firedAt: '2026-07-18T00:00:00.000Z', readAt: null });
  assert.equal(isFired(next, ID), true);
  assert.equal(isUnread(next, ID), true);
});

test('withFired: 発火済みなら不変(冪等・同一参照)', () => {
  const state: ArticlesState = { [ID]: { firedAt: '2026-07-18T00:00:00.000Z', readAt: null } };
  const next = withFired(state, ID, '2026-07-20T00:00:00.000Z');
  assert.equal(next, state); // 同一参照 = 変化なし
  assert.equal(next[ID].firedAt, '2026-07-18T00:00:00.000Z'); // firedAt は上書きされない
});

test('withRead: 発火済み・未読なら readAt を埋める', () => {
  const state: ArticlesState = { [ID]: { firedAt: '2026-07-18T00:00:00.000Z', readAt: null } };
  const next = withRead(state, ID, '2026-07-19T00:00:00.000Z');
  assert.equal(next[ID].readAt, '2026-07-19T00:00:00.000Z');
  assert.equal(isRead(next, ID), true);
  assert.equal(isUnread(next, ID), false);
});

test('withRead: 既読の巻き戻しをしない(単調・同一参照)', () => {
  const state: ArticlesState = {
    [ID]: { firedAt: '2026-07-18T00:00:00.000Z', readAt: '2026-07-19T00:00:00.000Z' },
  };
  const next = withRead(state, ID, '2026-07-25T00:00:00.000Z');
  assert.equal(next, state);
  assert.equal(next[ID].readAt, '2026-07-19T00:00:00.000Z'); // 最初の既読時刻を保持
});

test('withRead: 未発火の記事は既読にできない', () => {
  const next = withRead({}, ID, '2026-07-19T00:00:00.000Z');
  assert.deepEqual(next, {});
  assert.equal(isRead(next, ID), false);
});

test('発火→既読の一方向のみ。エントリは消えない(原則1)', () => {
  let s: ArticlesState = {};
  s = withFired(s, ID, '2026-07-18T00:00:00.000Z');
  s = withRead(s, ID, '2026-07-19T00:00:00.000Z');
  // 再発火しても既読エントリはそのまま(消えない・戻らない)
  s = withFired(s, ID, '2026-07-30T00:00:00.000Z');
  assert.equal(isFired(s, ID), true);
  assert.equal(isRead(s, ID), true);
  assert.equal(s[ID].firedAt, '2026-07-18T00:00:00.000Z');
  assert.equal(s[ID].readAt, '2026-07-19T00:00:00.000Z');
});
