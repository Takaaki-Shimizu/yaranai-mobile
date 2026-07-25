// 理想(WHAT)の文字数規則。表示にも編集にも依存しない純関数だけを置く(テスト対象)。
//
// 文字数は必ずコードポイント単位で数える。JS の String#length は UTF-16 コード単位のため、
// 絵文字などのサロゲートペアが2文字ぶんとして数えられ、20文字に収まる入力を誤って弾く。

export const IDEAL_MAX_LENGTH = 20;

/** コードポイント単位の文字数。サロゲートペアを1文字として数える */
export function idealLength(text: string): number {
  return [...text].length;
}

export type IdealValidation =
  | { ok: true; value: string }
  | { ok: false; length: number };

/**
 * 保存前の検証。前後の空白を落としたうえで上限を見る。
 * 空文字は正常系として通す(理想の削除にあたる)。
 */
export function validateIdeal(raw: string): IdealValidation {
  const value = raw.trim();
  const length = idealLength(value);
  if (length > IDEAL_MAX_LENGTH) return { ok: false, length };
  return { ok: true, value };
}
