// 全記事の登録簿(実装仕様書 §2 / v1.1 §2)。種別(kind)・表示順・発火条件をここで定義する。
// v1.1 は記事1「このアプリが、あなたにしないこと」(standing)と
// 記事2「積んだものは、崩れない」(conditional)の2本。記事4・節目駆動記事は
// 本ファイルへの追加と trigger の union 拡張で後から載せる。
//
// 並び順の意味: standing が複数になったときの一覧の固定表示順は、この配列の定義順(v1.1 §5.2)。

import type { Article } from './types';
import { SHINAI_KOTO_BODY } from './content/shinai-koto';
import { SHINAI_KOTO_BODY_EN } from './content/shinai-koto-en';
import { TSUNDA_MONO_BODY } from './content/tsunda-mono';
import { TSUNDA_MONO_BODY_EN } from './content/tsunda-mono-en';

export const SHINAI_KOTO_ID = 'shinai-koto';
export const TSUNDA_MONO_ID = 'tsunda-mono';

export const ARTICLES: Article[] = [
  {
    id: SHINAI_KOTO_ID,
    kind: 'standing',
    title: {
      ja: 'このアプリが、あなたにしないこと',
      en: "What this app won't do to you",
    },
    body: { ja: SHINAI_KOTO_BODY, en: SHINAI_KOTO_BODY_EN },
  },
  {
    id: TSUNDA_MONO_ID,
    kind: 'conditional',
    title: {
      ja: '積んだものは、崩れない',
      en: "What you've built doesn't crumble",
    },
    body: { ja: TSUNDA_MONO_BODY, en: TSUNDA_MONO_BODY_EN },
    trigger: { kind: 'crashedDay' },
  },
];

export function getArticle(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id);
}
