// 読みもの機能 v1 の型定義(実装仕様書 §2 / §3)。
// 記事はローカル同梱の静的コンテンツ。サーバー配信・リモート更新はしない(原則5)。

// 発火条件。v1 は「崩れた日の翌起動」だけ。将来は日数レンジ・節目駆動を union に足す。
export type ArticleTrigger =
  | { kind: 'crashedDay' } // 記事2: 崩れた日の翌起動
  // 将来: | { kind: 'dayRange'; from: number; to: number }   // 記事1など
  // 将来: | { kind: 'milestone'; milestone: string }          // 節目駆動
;

export type Article = {
  // 'tsunda-mono' 等。既読状態のキーになるため、公開後は変更しない。
  id: string;
  // 「積んだものは、崩れない」
  title: string;
  // markdown。見出しは h2 まで。yaranai-column-02-tsunda-mono.md の本文部をそのまま使う。
  body: string;
  trigger: ArticleTrigger;
};

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
