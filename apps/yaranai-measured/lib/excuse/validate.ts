// 言い訳カードの宣言文(WHAT)の文字数規則。表示にも保存にも依存しない純関数だけを置く。
//
// 規則(指示書 §2-2 / §9-2):
//   - 上限は全角24字。読点(、)で2行に自動分割し、2行を超える入力は入力UIの時点で弾く。
//   - 1行の上限は全角14字。モックの最長行「ショート動画があるアプリは、」がちょうど14字で、
//     カードの組みはこの幅を最長ケースとして設計してある(§9-2)。
//
// 数え方は「全角換算」。全角(かな・漢字・全角記号・絵文字)を1、半角(ASCII等)を0.5と数える。
// 日本語の入力では指示書の24字・14字とそのまま一致し、英語の入力でも版面に載る量が
// おなじになる ── カードの組みが守っているのは字数ではなく行の幅であるため。
// 数える単位はコードポイント(理想 lib/ideal/validate.ts と同じく、絵文字を2字と数えない)。

export const EXCUSE_MAX_WIDTH = 24;
export const EXCUSE_MAX_LINES = 2;
export const EXCUSE_MAX_LINE_WIDTH = 14;

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

/**
 * 入力の正規化。改行は落とし(単行入力なので混入は貼り付けだけ)、前後の空白を落とす。
 * 内部の空白はそのまま(英語の入力で語間が要る)。
 */
export function normalizeExcuse(raw: string): string {
  return raw.replace(/[\r\n]+/g, '').trim();
}

/**
 * 読点で行に割る。読点は行末に残し(モックの「…アプリは、/ やらない。」)、
 * 割った結果の空行は捨てる ──「…やらない。」のように読点で終わる入力でも1行のまま。
 * 英語のカンマも読点として見る(区切りの役が同じため)。
 */
export function splitExcuseLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  for (const ch of normalizeExcuse(text)) {
    current += ch;
    if (ch === '、' || ch === ',') {
      lines.push(current);
      current = '';
    }
  }
  if (current !== '') lines.push(current);
  return lines.map((line) => line.trim()).filter((line) => line !== '');
}

export type ExcuseValidation =
  | { ok: true; value: string; lines: string[] }
  | { ok: false; reason: 'empty' | 'tooLong' | 'tooManyLines' | 'lineTooLong' };

/**
 * 保存前の検証。空文字は不可 ── 宣言は発話なので、白紙の宣言は存在しない。
 * 弾く順は「長すぎ → 行数 → 行の長さ」。いちばん直しやすい理由から出す。
 */
export function validateExcuse(raw: string): ExcuseValidation {
  const value = normalizeExcuse(raw);
  if (value === '') return { ok: false, reason: 'empty' };
  if (excuseWidth(value) > EXCUSE_MAX_WIDTH) return { ok: false, reason: 'tooLong' };

  const lines = splitExcuseLines(value);
  if (lines.length > EXCUSE_MAX_LINES) return { ok: false, reason: 'tooManyLines' };
  if (lines.some((line) => excuseWidth(line) > EXCUSE_MAX_LINE_WIDTH)) {
    return { ok: false, reason: 'lineTooLong' };
  }
  return { ok: true, value, lines };
}
