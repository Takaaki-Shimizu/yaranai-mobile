// 和紙意匠の定数(和紙意匠 実装指示書。ground truth は yaranai-washi-v4.html)。
//
// 意匠は全ユーザー共通の固定デザインで、庭のPRNGシードとは連動させない(§10)。
// 将来「意匠も庭ごとに変える」判断をする場合に備え、紙片・箔の座標定義は
// このファイルに集約しておく。座標はすべて幅390dp基準のローカル座標。

/** カラートークン(§3) */
export const WASHI = {
  paper: '#F3EEE2',
  ink: '#2B2723',
  washi1: '#C6BBA1',
  washi2: '#D3C9B2',
  washi3: '#CCC1A8',
  washi4: '#BFB49B',
  foil1: '#C9A84C',
  foil2: '#D9BC6A',
} as const;

export type PaperPiece = {
  /** 多角形の頂点列(dp)。負座標は帯の外 = 描画時にクリップされる前提 */
  points: readonly (readonly [number, number])[];
  fill: string;
  opacity: number;
};

export type Foil = {
  x: number;
  y: number;
  /** 一辺(dp)。FOIL_MIN_SIZE 未満は禁止(§8) */
  size: number;
  /** 度。正が時計回り */
  rotate: number;
  fill: string;
  opacity: number;
};

/** 金箔の最小サイズ(§8)。それ未満に縮小するくらいなら数を減らす */
export const FOIL_MIN_SIZE = 8;

/** 意匠座標の基準幅(dp)。実幅に合わせて横方向をスケールする */
export const MOTIF_BASE_WIDTH = 390;

/** ヘッダー意匠が届く縦の範囲(紙片の最大y)。キャンバスの高さに使う */
export const HEADER_MOTIF_HEIGHT = 150;

/** ヘッダー意匠: 紙片2枚(§4)。ヘッダー左上原点 */
export const HEADER_PIECES: readonly PaperPiece[] = [
  { points: [[-40, -30], [120, -50], [170, 60], [90, 150], [-50, 110]], fill: WASHI.washi1, opacity: 0.34 },
  { points: [[60, -60], [210, -40], [230, 80], [130, 120], [40, 40]], fill: WASHI.washi2, opacity: 0.30 },
];

/** ヘッダー意匠: 金箔2粒(§4) */
export const HEADER_FOILS: readonly Foil[] = [
  { x: 96, y: 34, size: 9, rotate: 16, fill: WASHI.foil1, opacity: 0.7 },
  { x: 268, y: 70, size: 8, rotate: -14, fill: WASHI.foil2, opacity: 0.6 },
];

/**
 * フッター帯のローカル座標の基準高さ(dp)。実際の帯の高さが異なる場合は
 * 縦方向をストレッチして追従する(preserveAspectRatio: none 相当。§5)
 */
export const FOOTER_BASE_HEIGHT = 72;

/** フッター意匠: 紙片5枚(§5)。フッター帯(390×72)のローカル座標 */
export const FOOTER_PIECES: readonly PaperPiece[] = [
  { points: [[-20, -6], [120, 4], [150, 50], [60, 80], [-30, 66]], fill: WASHI.washi1, opacity: 0.34 },
  { points: [[90, 10], [230, -8], [250, 44], [170, 78], [100, 60]], fill: WASHI.washi2, opacity: 0.30 },
  { points: [[210, 2], [350, -10], [372, 40], [300, 80], [224, 62]], fill: WASHI.washi3, opacity: 0.32 },
  { points: [[320, 14], [420, 0], [424, 66], [340, 82]], fill: WASHI.washi1, opacity: 0.28 },
  { points: [[40, 34], [150, 26], [166, 74], [56, 84]], fill: WASHI.washi4, opacity: 0.18 },
];

/** フッター意匠: 金箔2粒(§5) */
export const FOOTER_FOILS: readonly Foil[] = [
  { x: 338, y: 14, size: 9, rotate: -14, fill: WASHI.foil2, opacity: 0.6 },
  { x: 72, y: 42, size: 8, rotate: 20, fill: WASHI.foil1, opacity: 0.6 },
];

/** 紙片の質感 mottle(§6): FractalNoise の輝度をアルファに変換して紙片にムラをかける */
export const MOTTLE = {
  baseFrequency: 0.055,
  /** フッターのみ縦方向に圧縮した異方性ノイズで帯の高さに馴染ませる */
  footerFreqY: 0.12,
  octaves: 4,
  /** 全紙片で共通シード */
  seed: 9,
} as const;

/**
 * alpha = clamp(luminance × 0.7 − 0.25)。
 * SVG feColorMatrix の第4行 `0.7 0.7 0.7 0 -0.25` と等価(§6)
 */
export const MOTTLE_ALPHA_MATRIX: readonly number[] = [
  0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
  0.7, 0.7, 0.7, 0, -0.25,
];

/** grain 紙肌(§7): 画面全体に multiply で薄く重ねる */
export const GRAIN = {
  baseFrequency: 0.9,
  octaves: 2,
  seed: 7,
  opacity: 0.05,
} as const;

/** グレースケール化。SVG feColorMatrix type="saturate" values="0" と等価(§7) */
export const GRAIN_DESATURATE_MATRIX: readonly number[] = [
  0.213, 0.715, 0.072, 0, 0,
  0.213, 0.715, 0.072, 0, 0,
  0.213, 0.715, 0.072, 0, 0,
  0, 0, 0, 1, 0,
];

/** 紙片の頂点列を SVG パス文字列(閉路)にする */
export function piecePath(piece: PaperPiece): string {
  return 'M' + piece.points.map(([x, y]) => `${x} ${y}`).join(' L ') + ' Z';
}
