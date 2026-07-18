// 全記事の登録簿(実装仕様書 §2)。表示順・発火条件をここで定義する。
// v1 は記事2「積んだものは、崩れない」の1本のみ。記事1・4、節目駆動記事は
// 本ファイルへの追加と trigger の union 拡張で後から載せる。

import type { Article } from './types';
import { TSUNDA_MONO_BODY } from './content/tsunda-mono';

export const TSUNDA_MONO_ID = 'tsunda-mono';

export const ARTICLES: Article[] = [
  {
    id: TSUNDA_MONO_ID,
    title: '積んだものは、崩れない',
    body: TSUNDA_MONO_BODY,
    trigger: { kind: 'crashedDay' },
  },
];

export function getArticle(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id);
}
