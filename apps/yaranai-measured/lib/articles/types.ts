// 読みもの機能 v1 の型定義(実装仕様書 §2 / §3)。
// 記事はローカル同梱の静的コンテンツ。サーバー配信・リモート更新はしない(原則5)。

import type { Lang } from '../i18n/types';

// 言語ごとの本文・タイトル。日本語版が正本、英語版は翻案(逐語訳ではない)。
export type LocalizedText = Record<Lang, string>;

// 記事の種別(v1.1 §2)。
//   - standing:    常設。ユーザーの状態を一切参照せず、初回評価時に無条件で発火する(記事1)
//   - conditional: 条件駆動。trigger の純関数で発火を判定する(記事2)
// 発火が生涯1回・冪等・単調である性質は両種別で共通(state.ts のガードを共用する)。
export type ArticleKind = 'standing' | 'conditional';

// 発火条件(conditional のみ)。v1 は「崩れた日の翌起動」だけ。将来は節目駆動を union に足す。
export type ArticleTrigger =
  | { kind: 'crashedDay' } // 記事2: 崩れた日の翌起動
  // 将来: | { kind: 'milestone'; milestone: string }          // 節目駆動
;

type ArticleBase = {
  // 'tsunda-mono' 等。既読状態のキーになるため、公開後は変更しない(言語で分けない)。
  id: string;
  // 「積んだものは、崩れない」/ "What you've built doesn't crumble"
  title: LocalizedText;
  // markdown。見出しは h2 まで。日本語は前提資料 md の本文部をそのまま使う。
  body: LocalizedText;
};

// 判別 union で「standing は発火条件を持たない」ことを型で表現する(v1.1 §0)。
// standing に trigger を書くことも、conditional から trigger を落とすこともコンパイルエラーになる。
export type Article =
  | (ArticleBase & { kind: 'standing' })
  | (ArticleBase & { kind: 'conditional'; trigger: ArticleTrigger });

// AsyncStorage に単一キー('yaranai.articles.state.v1')で保持する状態(§3)。
// エントリが存在する = 発火済み(=ユーザーの前に現れたことがある)。
// 発火済みエントリは削除しない(原則1)。読了で readAt を埋めるのみ。
export type ArticleEntry = {
  // ISO日時。初回発火(帯が最初に置かれた)時刻。
  firedAt: string;
  // 読了時刻。null なら未読。
  readAt: string | null;
};

export type ArticlesState = {
  [articleId: string]: ArticleEntry;
};
