// 記事状態 + registry から画面用の並びを組む(実装仕様書 §5.1 / §5.4)。
// 「発火が新しい順」は firedAt の降順。registry に無い id(将来削除された記事)は無視する。

import { ARTICLES, getArticle } from './registry';
import type { ArticlesState } from './types';

export type ArticleListItem = {
  id: string;
  title: string;
  unread: boolean;
  firedAt: string;
};

// 発火済みの記事を発火が新しい順に。読みもの一覧(§5.4)で使う。
export function firedArticles(state: ArticlesState): ArticleListItem[] {
  const items: ArticleListItem[] = [];
  for (const [id, entry] of Object.entries(state)) {
    const article = getArticle(id);
    if (!article) continue;
    items.push({ id, title: article.title, unread: entry.readAt === null, firedAt: entry.firedAt });
  }
  // firedAt(ISO)の降順。同時刻は registry の並び順で安定させる。
  const order = new Map(ARTICLES.map((a, i) => [a.id, i]));
  items.sort((a, b) => {
    if (a.firedAt !== b.firedAt) return a.firedAt < b.firedAt ? 1 : -1;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
  return items;
}

// ホームの帯に出す1本(未読のうち発火が最新のもの)。無ければ null(§5.1)。
export function newestUnread(state: ArticlesState): ArticleListItem | null {
  return firedArticles(state).find((a) => a.unread) ?? null;
}
