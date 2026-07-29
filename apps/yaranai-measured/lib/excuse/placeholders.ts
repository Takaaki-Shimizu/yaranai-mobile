// 入力プレースホルダーの例文(指示書 §7)。
//
// 書くのは「やらないこと」だけ ──「はやらない。」はアプリが添えるので、
// 例文もそこまでを見せる(打ち込む形と、見えている形を揃える)。
//
// WHATはスマホアプリに限定しない ──「時間を取り戻す」はアプリ限定の思想ではないため、
// 誘い・付き合い・生活の時間も候補に入る。
// 「愚痴の聞き役」「なんとなくの残業」は入力の自由としては通るが、ここには入れない
// (プレースホルダーは提案であり、人の関係や職場を名指しする提案はしない)。

import type { Lang } from '../i18n/types';

const ja = [
  // 確定例文(モックの顔)
  'ショート動画があるアプリ',
  '気乗りしない飲み会',
  '二次会',
  '深夜の通話',
  '即レス',
  '寝る前のSNS',
  '目的のないスクロール',
  '朝いちばんのスマホ',
  'ながら見の動画',
];

const en = [
  'Short-video apps',
  'Drinks I don’t want',
  'The second round',
  'Late-night calls',
  'Instant replies',
  'Bedtime scrolling',
  'Aimless scrolling',
  'The phone at dawn',
  'Video in the background',
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
