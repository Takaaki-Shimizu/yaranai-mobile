// 宣言日の表記(指示書 §2-3)。カードに載る唯一の事実情報。
//
// 表記は数字の年月日「2026年7月29日 宣言」。差し替えるたびに日付が更新され、
// カードの鮮度が受け手に正直に表れる ── 枚数の制限機構を要らなくしているのはこの一点。
// 月・日はゼロ埋めしない(「07月29日」は書類の顔になり、掛け軸の顔にならないため)。

import type { Lang } from '../i18n/types';

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type YearMonthDay = { year: number; month: number; day: number };

/** Supabase の date(YYYY-MM-DD)を数値に割る。壊れた値は null */
export function parseDeclaredOn(value: string): YearMonthDay | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** カードと画面に出す宣言日。読めない値のときは空文字(日付の行ごと出さない) */
export function formatDeclaredOn(value: string, lang: Lang): string {
  const parsed = parseDeclaredOn(value);
  if (!parsed) return '';
  if (lang === 'en') {
    return `Declared ${EN_MONTHS[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
  }
  return `${parsed.year}年${parsed.month}月${parsed.day}日 宣言`;
}
