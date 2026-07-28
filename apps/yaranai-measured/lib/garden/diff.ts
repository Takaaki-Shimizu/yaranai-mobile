// 入庭時の差分演出(§変更4)。
// 「前回庭を見た時点の状態」と「現在の状態」を比べ、変化した要素だけを割り出す。
// スナップショットは描画パラメータ(GrowthParams)そのもの。SVG 要素ではなく状態値で判定する。
// 蓄積は単調非減少(高水位ガード済み)なので、後退は起きない前提。

import type { GrowthParams } from './growth';
import { cobbleCount } from './scene';
import type { Lang } from '../i18n/types';

/** 変化の種別。演出の出現順もこの順(苔→飛び石→光→石) */
export type DiffCategory = 'moss' | 'cobble' | 'light' | 'stone';
export const DIFF_ORDER: DiffCategory[] = ['moss', 'cobble', 'light', 'stone'];

const MOSS_EPS = 0.005; // これ未満の苔増加は「増えた」と見なさない(毎回の演出で陳腐化させない)

/** 前回と現在を比べて、変化した要素の一覧を返す。prev が無ければ空(初回は演出しない) */
export function changedCategories(prev: GrowthParams | null, cur: GrowthParams): DiffCategory[] {
  if (!prev) return [];
  const out: DiffCategory[] = [];
  if (cur.moss > prev.moss + MOSS_EPS) out.push('moss');
  if (cobbleCount(cur.recordedDays) > cobbleCount(prev.recordedDays)) out.push('cobble');
  if (cur.weeks > prev.weeks) out.push('light');
  if (cur.stones > prev.stones) out.push('stone');
  return out;
}

/**
 * 変化に添える一行(過去形・断定・数字なし)。変化なしは null。
 * 複数種が変わったときは種別を明かさず「庭が、少し変わりました。」。
 * 英語も同じ原則(past tense, no numbers, quiet)で言い換える。
 */
export function changeNote(categories: DiffCategory[], lang: Lang = 'ja'): string | null {
  if (categories.length === 0) return null;
  const generic = lang === 'en' ? 'The garden has changed, a little.' : '庭が、少し変わりました。';
  if (categories.length >= 2) return generic;
  switch (categories[0]) {
    case 'moss':
      return lang === 'en' ? 'The moss has spread, a little.' : '苔が、少し増えました。';
    case 'cobble':
      return lang === 'en' ? 'A stone has been set down.' : '石が、ひとつ置かれました。';
    case 'light':
      return lang === 'en' ? 'The light has drawn a little closer.' : '光が、少し近づきました。';
    case 'stone':
      return generic;
  }
}

/**
 * 差分演出用に、前回状態から現在状態へ「種別ごとに一段ずつ」適用した中間状態の列を作る。
 * 返り値[0] = prev、以降 categories の順に該当フィールドだけを cur に寄せる。末尾 = cur 相当。
 * レンダラはこれらを重ねてフェードし、変化した要素だけが順に現れる。
 */
export function diffStages(
  prev: GrowthParams,
  cur: GrowthParams,
  categories: DiffCategory[],
): GrowthParams[] {
  const stages: GrowthParams[] = [prev];
  let g: GrowthParams = { ...prev };
  for (const cat of categories) {
    if (cat === 'moss') g = { ...g, moss: cur.moss };
    else if (cat === 'cobble') g = { ...g, recordedDays: cur.recordedDays, path: cur.path };
    else if (cat === 'light') g = { ...g, weeks: cur.weeks, redLeaf: cur.redLeaf };
    else if (cat === 'stone') g = { ...g, stones: cur.stones };
    stages.push(g);
  }
  return stages;
}

/** 各段の演出パラメータ(出現ディレイと時間)。全体 3 秒以内に収める(§変更4) */
export const STAGE_TIMING: Record<DiffCategory, { delay: number; duration: number }> = {
  moss: { delay: 0, duration: 1800 },   // にじむようにフェードイン(1.5〜2秒)
  cobble: { delay: 250, duration: 1500 }, // 静かに現れて置かれる(跳ねない)
  light: { delay: 500, duration: 2000 }, // 前回位置から滲み広がる
  stone: { delay: 750, duration: 1400 },
};

/**
 * 差分演出が終わるまでの時間(ms)。変化なしは 0。
 * 閉じ際演出「とじる」は、この間に押されても無視する(指示書 §6)。
 */
export function diffDuration(categories: DiffCategory[]): number {
  return categories.reduce(
    (max, cat) => Math.max(max, STAGE_TIMING[cat].delay + STAGE_TIMING[cat].duration),
    0,
  );
}
