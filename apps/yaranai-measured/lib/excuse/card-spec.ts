// 言い訳カードの図版仕様(モック v3「夜の竹林と灯り」)。
// 描画系(Skia)には依存しない純データだけを置く ── 座標はすべてカードのピクセル座標。
//
// 版下の正はモック v3(yaranai-excuse-card-mock-v3.html)。数値はそのSVGから起こしてある。
// モックから意図して変えたのは次の1点だけ:
//
//   QRの寸法。モックの 92px / 100px は版面のバランスを見るためのダミー柄で、
//   実データ(43バイトのURL)を version 4-M で入れると1モジュールが 2.5px 前後になり、
//   実機カメラで読めない。読み取り(§9-3)は非交渉なので、版面の位置はモックのまま
//   (左下・「Yaranaiとは」を下に添える)に、面だけを 180px / 200px へ広げてある。
//
// 朱(colors.shu)はこのファイルに一切現れない(§8)。カードのアクセントは灯りが担う。

export type CardSize = 'square' | 'story';

export type GradientStop = { offset: number; color: string; opacity?: number };

/** 竹の稈。SVG の rect(角丸)相当 */
export type Culm = { x: number; y: number; w: number; h: number; r: number; color: string; opacity?: number };
/** 節・受け光の線 */
export type Stroke = { x1: number; y1: number; x2: number; y2: number; w: number; color: string; opacity: number };

export type TextSpec = {
  /** 中心 x(中央寄せ) */
  cx: number;
  /** ベースライン y */
  y: number;
  size: number;
  letterSpacing: number;
  color: string;
  opacity?: number;
};

export type CardLayout = {
  width: number;
  height: number;
  /** 夜の地(縦グラデ) */
  night: GradientStop[];
  bamboo: {
    /** 竹林全体にかけるぼかし(SVG の feGaussianBlur stdDeviation=8) */
    blur: number;
    culms: Culm[];
    nodes: Stroke[];
    /** 灯りを受ける内側の縁 */
    rims: Stroke[];
  };
  /** 中央の灯り(外側の広がり) */
  glow: { center: [number, number]; radius: number; stops: GradientStop[] };
  /** 中央の灯り(芯) */
  glowCore: { center: [number, number]; radius: number; stops: GradientStop[] };
  /** 灯りへ向かう石畳 */
  path: { blur: number; polygon: number[]; stops: GradientStop[]; joints: Stroke[] };
  /** 宣言文(二層描き。glowBlur はぼかした光量の層) */
  declaration: {
    cx: number;
    size: number;
    letterSpacing: number;
    /** 2行のときのベースライン */
    baselines: [number, number];
    /** 1行のときのベースライン */
    singleBaseline: number;
    /** この幅を超える行は字送りごと縮める(§9-2 はみ出し禁止の保険) */
    safeWidth: number;
    glowColor: string;
    glowOpacity: number;
    glowBlur: number;
    color: string;
  };
  /** 宣言日(唯一の事実情報 §2-3) */
  date: TextSpec;
  /** 預かりの一文(§2-4)。行組みは言語ごとに変わるので配列で受ける */
  custody: { cx: number; baselines: number[]; size: number; letterSpacing: number; color: string; opacity: number };
  wordmark: TextSpec;
  qr: {
    /** 生成り面の左上と一辺(§5-5 暗地に暗QRは読めないため面は変更禁止) */
    x: number;
    y: number;
    size: number;
    panelColor: string;
    panelOpacity: number;
    moduleColor: string;
    moduleOpacity: number;
    /** 生成り面の内側に取る余白(モジュール数)。面そのものが静穏帯を兼ねる */
    quietModules: number;
    label: TextSpec;
  };
  /** 紙の粒子(暖色・弱)。ビネットは夜地なので置かない(§5-6) */
  grain: { baseFrequency: number; octaves: number; opacity: number; rgb: [number, number, number]; alpha: number };
};

const NIGHT: GradientStop[] = [
  { offset: 0, color: '#12100C' },
  { offset: 0.55, color: '#17140F' },
  { offset: 1, color: '#1A1712' },
];

const GLOW_STOPS: GradientStop[] = [
  { offset: 0, color: '#F1E8CF', opacity: 0.34 },
  { offset: 0.38, color: '#E7DCBE', opacity: 0.14 },
  { offset: 1, color: '#E7DCBE', opacity: 0 },
];

const GLOW_CORE_STOPS: GradientStop[] = [
  { offset: 0, color: '#F6EFDB', opacity: 0.22 },
  { offset: 1, color: '#F6EFDB', opacity: 0 },
];

const PATH_STOPS: GradientStop[] = [
  { offset: 0, color: '#F1E8CF', opacity: 0.1 },
  { offset: 1, color: '#F1E8CF', opacity: 0.02 },
];

const GRAIN = {
  baseFrequency: 0.9,
  octaves: 2,
  opacity: 0.05,
  rgb: [0.85, 0.8, 0.68] as [number, number, number],
  alpha: 0.35,
};

const node = (x1: number, y1: number, x2: number, y2: number): Stroke =>
  ({ x1, y1, x2, y2, w: 5, color: '#3A3325', opacity: 0.9 });
const rim = (x: number, y1: number, y2: number): Stroke =>
  ({ x1: x, y1, x2: x, y2, w: 3, color: '#8A7E5E', opacity: 0.22 });
const joint = (x1: number, y: number, x2: number): Stroke =>
  ({ x1, y1: y, x2, y2: y, w: 4, color: '#F1E8CF', opacity: 0.05 });

const SQUARE: CardLayout = {
  width: 1080,
  height: 1080,
  night: NIGHT,
  bamboo: {
    blur: 8,
    culms: [
      { x: 18, y: -20, w: 46, h: 1120, r: 23, color: '#26221A' },
      { x: 96, y: -20, w: 34, h: 1120, r: 17, color: '#26221A' },
      { x: 1016, y: -20, w: 46, h: 1120, r: 23, color: '#26221A' },
      { x: 944, y: -20, w: 34, h: 1120, r: 17, color: '#26221A' },
      { x: 152, y: 60, w: 22, h: 1020, r: 11, color: '#2E2920', opacity: 0.8 },
      { x: 906, y: 40, w: 22, h: 1040, r: 11, color: '#2E2920', opacity: 0.8 },
    ],
    nodes: [
      node(18, 240, 64, 236), node(18, 520, 64, 516), node(18, 810, 64, 806),
      node(96, 150, 130, 147), node(96, 430, 130, 427), node(96, 720, 130, 717),
      node(1016, 200, 1062, 196), node(1016, 480, 1062, 476), node(1016, 770, 1062, 766),
      node(944, 300, 978, 297), node(944, 590, 978, 587), node(944, 880, 978, 877),
    ],
    rims: [rim(130, 80, 1000), rim(944, 80, 1000)],
  },
  glow: { center: [0.5, 0.42], radius: 0.62, stops: GLOW_STOPS },
  glowCore: { center: [0.5, 0.42], radius: 0.3, stops: GLOW_CORE_STOPS },
  path: {
    blur: 8,
    polygon: [360, 1080, 720, 1080, 600, 700, 480, 700],
    stops: PATH_STOPS,
    joints: [
      joint(392, 1010, 688), joint(412, 944, 668), joint(432, 880, 648),
      joint(452, 820, 628), joint(470, 764, 610),
    ],
  },
  declaration: {
    cx: 540,
    size: 54,
    letterSpacing: 10,
    baselines: [426, 528],
    singleBaseline: 477,
    safeWidth: 940,
    glowColor: '#F1E8CF',
    glowOpacity: 0.55,
    glowBlur: 14,
    color: '#EDE5CF',
  },
  date: { cx: 540, y: 608, size: 20, letterSpacing: 7, color: '#8C8577' },
  custody: { cx: 540, baselines: [938], size: 22, letterSpacing: 3, color: '#B5AC97', opacity: 0.92 },
  wordmark: { cx: 540, y: 988, size: 14, letterSpacing: 9, color: '#8C8577' },
  // 正方形は預かりの一文(中央寄せ・全角21字ぶん)と同じ帯にQRが並ぶ。
  // 面はその左に収まる幅までしか広げられないので、1モジュール4pxに留めてある
  qr: {
    x: 76,
    y: 846,
    size: 156,
    panelColor: '#F2EDE1',
    panelOpacity: 0.92,
    moduleColor: '#2E2B26',
    moduleOpacity: 0.9,
    quietModules: 3,
    label: { cx: 154, y: 1034, size: 14, letterSpacing: 3, color: '#8C8577' },
  },
  grain: GRAIN,
};

const STORY: CardLayout = {
  width: 1080,
  height: 1920,
  night: NIGHT,
  bamboo: {
    blur: 8,
    culms: [
      { x: 14, y: -20, w: 50, h: 1960, r: 25, color: '#26221A' },
      { x: 98, y: -20, w: 36, h: 1960, r: 18, color: '#26221A' },
      { x: 1016, y: -20, w: 50, h: 1960, r: 25, color: '#26221A' },
      { x: 946, y: -20, w: 36, h: 1960, r: 18, color: '#26221A' },
      { x: 156, y: 120, w: 24, h: 1800, r: 12, color: '#2E2920', opacity: 0.8 },
      { x: 902, y: 90, w: 24, h: 1830, r: 12, color: '#2E2920', opacity: 0.8 },
    ],
    nodes: [
      node(14, 420, 64, 415), node(14, 900, 64, 895), node(14, 1420, 64, 1415),
      node(98, 280, 134, 276), node(98, 760, 134, 756), node(98, 1280, 134, 1276),
      node(1016, 360, 1066, 355), node(1016, 860, 1066, 855), node(1016, 1380, 1066, 1375),
      node(946, 520, 982, 516), node(946, 1040, 982, 1036), node(946, 1560, 982, 1556),
    ],
    rims: [rim(134, 160, 1800), rim(946, 160, 1800)],
  },
  glow: { center: [0.5, 0.4], radius: 0.55, stops: GLOW_STOPS },
  glowCore: { center: [0.5, 0.4], radius: 0.26, stops: GLOW_CORE_STOPS },
  path: {
    blur: 8,
    polygon: [340, 1920, 740, 1920, 610, 1260, 470, 1260],
    stops: PATH_STOPS,
    joints: [
      joint(376, 1810, 704), joint(398, 1700, 682), joint(420, 1594, 660),
      joint(442, 1494, 638), joint(462, 1398, 618),
    ],
  },
  declaration: {
    cx: 540,
    size: 56,
    letterSpacing: 10,
    baselines: [742, 852],
    singleBaseline: 797,
    safeWidth: 940,
    glowColor: '#F1E8CF',
    glowOpacity: 0.55,
    glowBlur: 15,
    color: '#EDE5CF',
  },
  date: { cx: 540, y: 936, size: 22, letterSpacing: 7, color: '#8C8577' },
  custody: { cx: 540, baselines: [1698, 1744], size: 24, letterSpacing: 3, color: '#B5AC97', opacity: 0.92 },
  wordmark: { cx: 540, y: 1800, size: 15, letterSpacing: 10, color: '#8C8577' },
  qr: {
    x: 84,
    y: 1600,
    size: 200,
    panelColor: '#F2EDE1',
    panelOpacity: 0.92,
    moduleColor: '#2E2B26',
    moduleOpacity: 0.9,
    quietModules: 3,
    label: { cx: 184, y: 1834, size: 15, letterSpacing: 3, color: '#8C8577' },
  },
  grain: GRAIN,
};

export const CARD_LAYOUTS: Record<CardSize, CardLayout> = { square: SQUARE, story: STORY };

/** 書き出す2サイズ(§2-8)。順は選択UIの並びでもある */
export const CARD_SIZES: CardSize[] = ['square', 'story'];

/**
 * 宣言文のベースライン。行数で置き方が変わる(1行は2行の中間に据える)。
 * 行組みは excuseLines() が1〜2行に決めるので、ここでは先頭2行だけを見る。
 */
export function declarationBaselines(layout: CardLayout, lineCount: number): number[] {
  return lineCount <= 1
    ? [layout.declaration.singleBaseline]
    : [layout.declaration.baselines[0], layout.declaration.baselines[1]];
}
