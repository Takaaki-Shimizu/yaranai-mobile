// ArticlesState の単調変化ガード(実装仕様書 §3)。純関数として閉じる。
// AsyncStorage への読み書きは storage.ts に置き、ここは状態遷移だけを担う。
//
// 許可する変化は2種類のみ(高水位マージと同じ思想):
//   - エントリ追加(発火)
//   - readAt を null → 日時(既読)
// 既読→未読の巻き戻し・エントリ削除は実装しない(原則1)。

import type { ArticlesState } from './types';

// 発火: エントリが無ければ追加する。既にあれば不変(冪等・§4.4「発火当日に再起動」)。
export function withFired(
  state: ArticlesState,
  articleId: string,
  firedAt: string,
): ArticlesState {
  if (state[articleId]) return state;
  return { ...state, [articleId]: { firedAt, readAt: null } };
}

// 既読化: 発火済みかつ未読のときだけ readAt を埋める。
// 未発火の記事は既読にできず、既読の巻き戻しもしない(単調)。
export function withRead(
  state: ArticlesState,
  articleId: string,
  readAt: string,
): ArticlesState {
  const entry = state[articleId];
  if (!entry) return state;
  if (entry.readAt !== null) return state;
  return { ...state, [articleId]: { ...entry, readAt } };
}

export function isFired(state: ArticlesState, articleId: string): boolean {
  return !!state[articleId];
}

export function isRead(state: ArticlesState, articleId: string): boolean {
  return state[articleId]?.readAt != null;
}

export function isUnread(state: ArticlesState, articleId: string): boolean {
  const entry = state[articleId];
  return !!entry && entry.readAt === null;
}
