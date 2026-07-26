// 記事状態 + registry から画面用の並びを組む(実装仕様書 §5.1 / §5.4、v1.1 §5.2)。
// ホームの帯は種別を問わず「発火が新しい順」の未読1本(firedAt の降順・v1.1 §4.3)。
// 一覧は standing を常に最上部(registry 定義順)に固定し、罫線を挟んで
// conditional を発火が新しい順に並べる(v1.1 §5.2)。
// registry に無い id(将来削除された記事)は無視する。
// タイトルは表示言語(lang)で引く。既読・発火の状態は言語をまたいで共通(id がキー)。

import { ARTICLES, getArticle } from './registry';
import type { ArticlesState, ArticleKind } from './types';
import type { Lang } from '../i18n/types';

export type ArticleListItem = {
  id: string;
  kind: ArticleKind;
  title: string;
  unread: boolean;
  firedAt: string;
};

// 一覧画面の2段組(v1.1 §5.2)。standing と conditional の間に罫線を1本挟んで描画する。
export type ArticleListSections = {
  standing: ArticleListItem[]; // registry の定義順
  conditional: ArticleListItem[]; // 発火が新しい順
};

// 発火済みの記事を発火が新しい順に。ホームの帯の選定(§5.1)で使う。
export function firedArticles(state: ArticlesState, lang: Lang): ArticleListItem[] {
  const items: ArticleListItem[] = [];
  for (const [id, entry] of Object.entries(state)) {
    const article = getArticle(id);
    if (!article) continue;
    items.push({
      id,
      kind: article.kind,
      title: article.title[lang],
      unread: entry.readAt === null,
      firedAt: entry.firedAt,
    });
  }
  // firedAt(ISO)の降順。同時刻は registry の並び順で安定させる。
  const order = new Map(ARTICLES.map((a, i) => [a.id, i]));
  items.sort((a, b) => {
    if (a.firedAt !== b.firedAt) return a.firedAt < b.firedAt ? 1 : -1;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
  return items;
}

// 読みもの一覧(§5.4 / v1.1 §5.2): standing を最上部に固定、conditional は発火が新しい順。
// standing 同士の並びは registry の定義順(将来 standing が増えたとき用)。
export function articleSections(state: ArticlesState, lang: Lang): ArticleListSections {
  const items = firedArticles(state, lang);
  const order = new Map(ARTICLES.map((a, i) => [a.id, i]));
  const standing = items
    .filter((a) => a.kind === 'standing')
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const conditional = items.filter((a) => a.kind === 'conditional');
  return { standing, conditional };
}

// ホームの帯に出す1本(未読のうち発火が最新のもの)。無ければ null(§5.1)。
// 種別で優先しない: standing と conditional が両方未読なら、発火が新しいほうが出る(v1.1 §4.3)。
// 帯に出ていない未読は一覧側で未読のまま残る。数えない・バッジを出さない(v1.1 §4.3)。
export function newestUnread(state: ArticlesState, lang: Lang): ArticleListItem | null {
  return firedArticles(state, lang).find((a) => a.unread) ?? null;
}

// 開発者モード用: 発火判定を通らない(計測しない)ため、登録簿の記事をそのまま見せる。
// 永続状態(発火・既読)は参照しない ── 常に「読める」状態として並べる。registry 順。
export function previewArticles(lang: Lang): ArticleListItem[] {
  return ARTICLES.map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a.title[lang],
    unread: true,
    firedAt: '',
  }));
}

// 開発者モードの一覧: 本番と同じ2段組(standing 上・罫線・conditional 下)で確認できるようにする。
export function previewSections(lang: Lang): ArticleListSections {
  const items = previewArticles(lang);
  return {
    standing: items.filter((a) => a.kind === 'standing'),
    conditional: items.filter((a) => a.kind === 'conditional'),
  };
}

// 開発者モードのホームの帯に出す1本(登録簿の先頭)。無ければ null。
export function previewStripArticle(lang: Lang): ArticleListItem | null {
  return previewArticles(lang)[0] ?? null;
}
