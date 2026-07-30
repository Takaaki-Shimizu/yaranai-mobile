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

// 紙片の opacity はモック原典(ヘッダー 0.34/0.30、フッター 0.34/0.30/0.32/0.28/0.18)から
// 実機調整で約1.5倍に引き上げた。原典値では mottle マスクと合わさって
// 「目を凝らせば分かる」程度にしか出ず、ぱっと見で和紙の重なりを感じられなかったため。

/** ヘッダー意匠: 紙片2枚(§4)。ヘッダー左上原点 */
export const HEADER_PIECES: readonly PaperPiece[] = [
  { points: [[-40, -30], [120, -50], [170, 60], [90, 150], [-50, 110]], fill: WASHI.washi1, opacity: 0.50 },
  { points: [[60, -60], [210, -40], [230, 80], [130, 120], [40, 40]], fill: WASHI.washi2, opacity: 0.45 },
];

/**
 * ヘッダー意匠: 金箔2粒(§4)。
 * 2粒目は元々 (268, 70) にあったが、題字のベースライン(y≈82)に金の界線
 * (GOLD_RULE)を通したことで線のすぐ上に浮くかたちになったため、上へ逃がした。
 * 金の主役は界線で、箔はその余韻に留める。
 */
export const HEADER_FOILS: readonly Foil[] = [
  { x: 96, y: 34, size: 9, rotate: 16, fill: WASHI.foil1, opacity: 0.7 },
  { x: 296, y: 52, size: 8, rotate: -14, fill: WASHI.foil2, opacity: 0.55 },
];

/**
 * 金の界線: 題字(Yaranai)のベースラインから真横に引く一本。
 *
 * 金箔を増やすと視線を散らす粒が増えるだけなので、金は「面」ではなく「線」で入れる。
 * 装飾経の界線に倣った引き方で、粒より静かなまま金の格だけが上がる。
 *
 * 両端は地(生成り)に溶かす。始端を切り落とすと題字に付いた下線に見え、
 * 終端を切り落とすと三本線に突き当たって見えるため、どちらもグラデーションで抜く。
 */
export const GOLD_RULE = {
  /** 線の太さ(dp)。1 より太いと箔ではなく罫に見える */
  thickness: 1,
  /** 題字の右端との間合い(dp)。下線と読ませないための間 */
  gapStart: 16,
  /** 三本線との間合い(dp)。線がボタンに触れない距離 */
  gapEnd: 20,
  /** 端から順に: 透明 → 金 → 金(明) → 透明 */
  colors: ['#C9A84C00', WASHI.foil1, WASHI.foil2, '#D9BC6A00'] as const,
  stops: [0, 0.18, 0.6, 1] as const,
  opacity: 0.75,
} as const;

/**
 * フッター帯のローカル座標の基準高さ(dp)。実際の帯の高さが異なる場合は
 * 縦方向をストレッチして追従する(preserveAspectRatio: none 相当。§5)
 */
export const FOOTER_BASE_HEIGHT = 72;

/** フッター意匠: 紙片5枚(§5)。フッター帯(390×72)のローカル座標 */
export const FOOTER_PIECES: readonly PaperPiece[] = [
  { points: [[-20, -6], [120, 4], [150, 50], [60, 80], [-30, 66]], fill: WASHI.washi1, opacity: 0.50 },
  { points: [[90, 10], [230, -8], [250, 44], [170, 78], [100, 60]], fill: WASHI.washi2, opacity: 0.45 },
  { points: [[210, 2], [350, -10], [372, 40], [300, 80], [224, 62]], fill: WASHI.washi3, opacity: 0.48 },
  { points: [[320, 14], [420, 0], [424, 66], [340, 82]], fill: WASHI.washi1, opacity: 0.42 },
  { points: [[40, 34], [150, 26], [166, 74], [56, 84]], fill: WASHI.washi4, opacity: 0.28 },
];

/**
 * フッター意匠: 金箔2粒(§5)。
 * 箔の y は「帯上端からの dp」で、紙片と違い縦ストレッチをかけずに置く。
 * ストレッチに載せると、下インセット(システムナビ)が大きい端末で箔が
 * アイコン帯の外へ沈んで見えなくなるため(実機で発生)。y+size は
 * インセットを除いた帯の高さ(FOOTER_HEIGHT = 56)以内に収めること。
 */
export const FOOTER_FOILS: readonly Foil[] = [
  { x: 338, y: 14, size: 9, rotate: -14, fill: WASHI.foil2, opacity: 0.6 },
  { x: 72, y: 42, size: 8, rotate: 20, fill: WASHI.foil1, opacity: 0.6 },
];

/**
 * 紙片の際(きわ)。
 *
 * 「ぱっと見で和紙と分からない」原因は紙片が薄いことではなく、輪郭が無いこと。
 * 塗りだけだと地との差が数%しかなく面として溶けるが、境目に細い線が一本入ると
 * 「紙が重なっている」ことは同じ濃度のままでも読める。全体を濃くせずに
 * 存在感だけを上げたいので、opacity ではなく輪郭で稼ぐ。
 *
 * 線は塗りと同じ mottle マスクの下に置く ── マスクのムラで線が途切れ、
 * 描いた輪郭ではなく紙の耳(deckle edge)として掠れる。
 */
export const PIECE_EDGE = {
  /** 紙片より半段濃い色。単独では使わず、必ずマスク越しに出す */
  color: '#A2957B',
  width: 1,
  /** マスク(平均 alpha ≈ 0.28)を通ると実効 0.15 前後まで落ちる前提の値 */
  opacity: 0.5,
} as const;

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
 * alpha = clamp(luminance × 0.8 − 0.12)。
 * モック原典は SVG feColorMatrix 第4行 `0.7 0.7 0.7 0 -0.25`(§6)だが、
 * その値では実機でマスクが削りすぎて紙片がほぼ見えなくなったため、
 * ムラの階調は保ったまま全体の透過率を引き上げている(実機調整)。
 */
export const MOTTLE_ALPHA_MATRIX: readonly number[] = [
  0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
  0.8, 0.8, 0.8, 0, -0.12,
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
