// 入力プレースホルダーの例文(指示書 §7)。
//
// WHATはスマホアプリに限定しない ──「時間を取り戻す」はアプリ限定の思想ではないため、
// 誘い・付き合い・生活の時間も候補に入る。
// 「愚痴の聞き役」「なんとなくの残業」は入力の自由としては通るが、ここには入れない
// (プレースホルダーは提案であり、人の関係や職場を名指しする提案はしない)。

import type { Lang } from '../i18n/types';

const ja = [
  // 確定例文(モックの顔)
  'ショート動画があるアプリは、やらない。',
  '気乗りしない飲み会は、やらない。',
  '二次会は、やらない。',
  '深夜の通話は、やらない。',
  '即レスは、やらない。',
  '寝る前のSNSは、やらない。',
  '目的のないスクロールは、やらない。',
  '朝いちばんのスマホは、やらない。',
  'ながら見の動画は、やらない。',
];

const en = [
  'Short-video apps, I won’t.',
  'Drinks I don’t want, I won’t.',
  'The second round, I won’t.',
  'Late-night calls, I won’t.',
  'Instant replies, I won’t.',
  'Bedtime scrolling, I won’t.',
  'Aimless scrolling, I won’t.',
  'The phone at dawn, I won’t.',
  'Video in the background, I won’t.',
];

export const EXCUSE_PLACEHOLDERS: Record<Lang, string[]> = { ja, en };

/**
 * 例文を1本選ぶ。入力画面を開くたびに変わる(§4.2-1 のランダム表示)。
 * 乱数源は呼び出し側から渡せるようにしてある(テストのため)。
 */
export function pickPlaceholder(lang: Lang, random: number = Math.random()): string {
  const list = EXCUSE_PLACEHOLDERS[lang];
  const index = Math.min(list.length - 1, Math.max(0, Math.floor(random * list.length)));
  return list[index];
}
