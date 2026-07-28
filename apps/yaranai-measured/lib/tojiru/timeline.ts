// 閉じ際演出「とじる」のタイムライン(指示書 §3)。合計 1200ms 固定。
// 実機での微調整はこの1オブジェクトだけを触ればよい。
// 時刻はすべて「とじる」をタップした瞬間からの相対ms。
//
// 入場の差分アニメが「変化」を担当するのに対し、ここは「静けさ」だけを担当する。
// 区間 C(一拍)に文字・数値・アイコンを差し込まないこと。役割を混ぜた時点で演出は死ぬ。

export const TOJIRU_TIMELINE = {
  /** A. 退場: 全UIがフェードアウトし、背景がわずかに沈む */
  exit: { start: 0, duration: 200 },
  /** B. 還り: 庭窓の景がクロスフェードで全画面に浮かぶ */
  garden: { start: 200, duration: 300 },
  /** C. 一拍: 庭のみの静止(0〜900 の間に何も足さない) */
  hold: { start: 500, duration: 400 },
  /** D. 障子: 左右二枚が中央へ閉じる */
  shoji: { start: 900, duration: 300 },
  /** E. 終了: ここでアプリをバックグラウンドへ移す */
  total: 1200,
} as const;

/** A で背景が沈む深さ(生成りの地に重ねる墨の不透明度)。「わずかに」= 気づかれない程度 */
export const SINK_OPACITY = 0.06;

/**
 * 障子の和紙の不透明度。閉じ進行 p(0=開ききり〜1=閉じ切り)に応じて上げる。
 * p<1 の間は庭の色が和紙越しにわずかに透け、閉じ切りで完全に不透明になる(§4-3)。
 */
export const WASHI_OPACITY = { from: 0.68, to: 1 } as const;

/** 閉じ進行 p における和紙の不透明度 */
export function washiOpacity(p: number): number {
  'worklet';
  const t = p < 0 ? 0 : p > 1 ? 1 : p;
  return WASHI_OPACITY.from + (WASHI_OPACITY.to - WASHI_OPACITY.from) * t;
}
