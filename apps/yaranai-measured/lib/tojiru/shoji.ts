// 障子一枚の作図(指示書 §4)。ここは純粋な寸法計算だけを持ち、色と描画は
// components/tojiru/bake.ts が担う(node のテストから寸法だけを検めるため)。
//
// 品質基準(§4)の寸法まわり:
//   1. 縦横の桟(格子)を持つ。縦3本(4列)× 横6本(7段)
//   4. 框(外枠)は桟より太い
// 「単色ベタの矩形が2枚スライドするだけ」を不合格にするための最低限の骨組み。

/** 桟の本数。指示書の目安(縦3〜4本 × 横5〜7本)の中央に置く */
export const MULLION_COLS = 4; // 縦桟 3 本で 4 列
export const MULLION_ROWS = 7; // 横桟 6 本で 7 段

export type ShojiPanel = {
  /** 一枚ぶんの寸法(論理pt)。画面幅の半分 × 画面高 */
  width: number;
  height: number;
  /** 框(外枠)の太さ */
  stile: number;
  /** 桟(格子)の太さ。framing より確実に細い */
  mullion: number;
  /** 縦桟の中心x(框の内側を等分) */
  verticals: number[];
  /** 横桟の中心y */
  horizontals: number[];
};

/**
 * 画面サイズから障子一枚(左半分)の寸法を決める。
 * 右の一枚は同じ絵を左右反転して置くので、作図は一枚ぶんで足りる。
 */
export function shojiPanel(screenWidth: number, screenHeight: number): ShojiPanel {
  const width = screenWidth / 2;
  const height = screenHeight;
  // 框は画面の短辺基準。細すぎると「板」に、太すぎると和紙が痩せる
  const stile = Math.max(6, Math.round(Math.min(width, height) * 0.022));
  // 桟は框の 4 割強。1px を下回ると格子が消えるので下限を置く
  const mullion = Math.max(2, Math.round(stile * 0.42));

  const innerX = stile;
  const innerW = Math.max(0, width - stile * 2);
  const innerY = stile;
  const innerH = Math.max(0, height - stile * 2);

  const verticals: number[] = [];
  for (let i = 1; i < MULLION_COLS; i += 1) {
    verticals.push(innerX + (innerW * i) / MULLION_COLS);
  }
  const horizontals: number[] = [];
  for (let i = 1; i < MULLION_ROWS; i += 1) {
    horizontals.push(innerY + (innerH * i) / MULLION_ROWS);
  }

  return { width, height, stile, mullion, verticals, horizontals };
}

/**
 * 閉じ進行 p(0=開ききり〜1=閉じ切り)における、一枚ぶんの横移動量。
 * 左の一枚は -offset、右の一枚は +offset。p=1 で二枚が画面中央で出会う。
 */
export function shojiOffset(panelWidth: number, p: number): number {
  'worklet';
  const t = p < 0 ? 0 : p > 1 ? 1 : p;
  return panelWidth * (1 - t);
}
