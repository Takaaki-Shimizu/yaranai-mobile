// 言い訳カードの宣言文(WHAT)の規則。表示にも保存にも依存しない純関数だけを置く。
//
// 人が書くのは「やらないこと」だけ(例:ショート動画があるアプリ)。
// 「はやらない。」はアプリが添える ── 宣言の型は世界観の側の持ちものであって、
// 毎回それを書かせるのは人の仕事ではない(§2-2)。
//
// 行組みもアプリが決める。読点を打って改行させる操作は要らない:
//   - 「◯◯はやらない。」が1行(全角14字)に収まるなら、1行のまま据える。
//   - 収まらないなら「◯◯は」/「やらない。」の2行に割る。割れ目は必ずここ。
// カードの組みは全角14字を最長ケースとして設計してあるので(§9-2)、
// 書ける長さの上限は「14字 −「は」1字」で全角13字になる。
//
// 数え方は「全角換算」。全角(かな・漢字・全角記号・絵文字)を1、半角(ASCII等)を0.5と数える。
// 日本語の入力では指示書の字数とそのまま一致し、英語の入力でも版面に載る量が
// おなじになる ── カードの組みが守っているのは字数ではなく行の幅であるため。
// 数える単位はコードポイント(理想 lib/ideal/validate.ts と同じく、絵文字を2字と数えない)。

import type { Lang } from '../i18n/types';

/** 人が書く「やらないこと」の上限(全角換算)。添える「は」1字ぶんを1行の上限から引いた値 */
export const EXCUSE_MAX_WIDTH = 13;
/** カード1行の上限(全角換算)。版下がこの幅を最長ケースとして組んである(§9-2) */
export const EXCUSE_CARD_LINE_WIDTH = 14;

/** アプリが添える宣言の型。人はこの前の部分だけを書く */
const TAIL: Record<Lang, { particle: string; join: string; tail: string }> = {
  ja: { particle: 'は', join: '', tail: 'やらない。' },
  en: { particle: ',', join: ' ', tail: 'I won’t.' },
};

// 全角(East Asian Wide / Fullwidth)として数える範囲。絵文字も1字として数える。
const FULL_WIDTH_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // ハングル字母
  [0x2e80, 0x303e], // CJK部首・康熙部首・CJK記号と句読点(、。「」を含む)
  [0x3041, 0x33ff], // かな・注音・ハングル互換字母・CJK互換
  [0x3400, 0x4dbf], // CJK拡張A
  [0x4e00, 0x9fff], // CJK統合漢字
  [0xa000, 0xa4cf], // イ文字
  [0xac00, 0xd7a3], // ハングル音節
  [0xf900, 0xfaff], // CJK互換漢字
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60], // 全角英数・全角記号
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f9ff], // 絵文字
  [0x20000, 0x3fffd], // CJK拡張B以降
];

function isFullWidth(codePoint: number): boolean {
  return FULL_WIDTH_RANGES.some(([lo, hi]) => codePoint >= lo && codePoint <= hi);
}

/** 全角換算の字数。全角=1、半角=0.5 */
export function excuseWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += isFullWidth(ch.codePointAt(0) ?? 0) ? 1 : 0.5;
  }
  return width;
}

// すでに宣言の型まで書いてしまった入力から、型のぶんを落とすための形。
// 習慣で「〜はやらない。」と打つ人がいる ── そのまま通すと「〜はやらないはやらない。」になる。
// 旧い保存値(型ごと保存していた頃の宣言)を読み直すときも、ここを通れば同じ絵になる。
// 「は、やらない。」「はやらない」「、やらない。」「やらない」のどれで書かれても落とせる形
const WRITTEN_TAILS: RegExp[] = [
  /\s*は?\s*[、,]?\s*(?:やらない|やりません)[。.!!]?$/,
  /\s*[、,]?\s*I\s*(?:won[’'`]t|will\s+not)[。.!!]?$/i,
];

/**
 * 入力の正規化。改行は落とし(単行入力なので混入は貼り付けだけ)、前後の空白を落とす。
 * 内部の空白はそのまま(英語の入力で語間が要る)。
 * 末尾の宣言の型と句読点は落とす ── 残すのは「やらないこと」だけ。
 */
export function normalizeExcuse(raw: string): string {
  const flat = raw.replace(/[\r\n]+/g, '').trim();
  let value = flat;
  for (const pattern of WRITTEN_TAILS) {
    const stripped = flat.replace(pattern, '').trim();
    // 「やらない」とだけ書いた人の入力まで空にはしない
    if (stripped !== '' && stripped !== flat) {
      value = stripped;
      break;
    }
  }
  return value.replace(/[、,。.]+$/, '').trim();
}

/** 宣言の一文。「やらないこと」にアプリが型を添えたもの */
export function excuseSentence(subject: string, lang: Lang): string {
  const value = normalizeExcuse(subject);
  if (value === '') return '';
  const { particle, join, tail } = TAIL[lang];
  return `${value}${particle}${join}${tail}`;
}

/**
 * カードに刷る行。1行に収まればそのまま、収まらなければ型の手前で割る。
 * 割れ目はここだけなので、読点を打って改行を作る操作は要らない。
 */
export function excuseLines(subject: string, lang: Lang): string[] {
  const sentence = excuseSentence(subject, lang);
  if (sentence === '') return [];
  if (excuseWidth(sentence) <= EXCUSE_CARD_LINE_WIDTH) return [sentence];
  const { particle, tail } = TAIL[lang];
  return [`${normalizeExcuse(subject)}${particle}`, tail];
}

export type ExcuseValidation =
  | { ok: true; value: string }
  | { ok: false; reason: 'empty' | 'tooLong' };

/**
 * 保存前の検証。空文字は不可 ── 宣言は発話なので、白紙の宣言は存在しない。
 * 見るのは長さだけ。行数も行の幅も、こちらで組むので人に問わない。
 */
export function validateExcuse(raw: string): ExcuseValidation {
  const value = normalizeExcuse(raw);
  if (value === '') return { ok: false, reason: 'empty' };
  if (excuseWidth(value) > EXCUSE_MAX_WIDTH) return { ok: false, reason: 'tooLong' };
  return { ok: true, value };
}
