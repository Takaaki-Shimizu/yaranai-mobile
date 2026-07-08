// 庭のシーン生成: 成長パラメータ → 絵巻一枚ぶんの描画スペック。
// 座標・色・フィルタの基準値は docs/mocks/ の SVG からそのまま移植(§0)。
// モックの 1200×800 が絵巻(3300×800)の中央パネルに収まり、左右の翼は
// シード付き乱数で決定論的に生成する(同じデータなら毎回同じ庭)。
//
// レイヤー構造(奥→手前)とパン追従係数は §3.1 / §5.2 に従う。
// 影が石畳を渡るため trunk-shadows は path より後に描く(モックの描画順が正)。

import { mulberry32, range, type Rng } from './prng';
import { GARDEN_COLORS as C } from './tokens';
import { WORLD_W, WORLD_H, FRAME_X, FRAME_W, HORIZON_Y, wx } from './dims';
import { buildBambooLayers, type MidCulmSpec } from './bamboo';
import { FULL_WEEKS, type GrowthParams } from './growth';
import type { Paint, Prim, Scene, SceneGroup, SceneLayer } from './scene-types';

// ---------------------------------------------------------------- 基本寸法(dims.ts から再輸出)

export { WORLD_W, WORLD_H, FRAME_X, FRAME_W, HORIZON_Y } from './dims';

/** 庭モードで1画面に見せる論理幅。3300 / 1200 = 2.75画面(§5.2) */
export const VIEW_LOGICAL_W = FRAME_W;
/** パンの中央値(中央パネルがぴったり収まる位置) */
export const PAN_CENTER = FRAME_X;
export const PAN_MAX = WORLD_W - VIEW_LOGICAL_W;
/** エッジピーク: 開いた直後に隣の景色を覗かせる量(画面幅の7%) */
export const EDGE_PEEK = Math.round(VIEW_LOGICAL_W * 0.07);
/** ホームの窓の中心(主石と道の起点を含む構図、世界座標) */
export const HOME_CX = 1520;

const WING_SEED = 0x59a7;

// ---------------------------------------------------------------- 補間ヘルパ

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 区分線形の補間。anchors は [x, 値] の昇順 */
function ramp(x: number, anchors: [number, number][]): number {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    if (x <= anchors[i][0]) {
      const [x0, v0] = anchors[i - 1];
      const [x1, v1] = anchors[i];
      return lerp(v0, v1, (x - x0) / (x1 - x0));
    }
  }
  return anchors[anchors.length - 1][1];
}

function hexLerp(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) =>
    Math.round(lerp((pa >> sh) & 0xff, (pb >> sh) & 0xff, t));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** 乾き→Day42→Day84 の3アンカー色補間(m: 苔の充実 0〜1) */
const lerp3 = (dry: string, mid: string, full: string, m: number) =>
  m <= 0.5 ? hexLerp(dry, mid, m / 0.5) : hexLerp(mid, full, (m - 0.5) / 0.5);

// ---------------------------------------------------------------- ペイント

const radial = (colors: readonly string[], moss = false): Paint => ({
  type: 'radial',
  center: moss ? [0.35, 0.28] : [0.32, 0.25],
  radius: moss ? 1 : 1.1,
  stops: [
    { offset: 0, color: colors[0] },
    { offset: moss ? 0.55 : 0.5, color: colors[1] },
    { offset: 1, color: colors[2] },
  ],
});

const ref = (name: string): Paint => ({ type: 'ref', name });
const solid = (color: string): Paint => ({ type: 'solid', color });

function buildPaints(g: GrowthParams): Record<string, Paint> {
  const skyT = clamp01(g.weeks / 3);
  const m = g.moss;
  return {
    sky: {
      type: 'linear',
      from: [0, 0],
      to: [0, 1],
      stops: [
        { offset: 0, color: hexLerp(C.skyTopDry, C.skyTop, skyT) },
        { offset: 1, color: hexLerp(C.skyBottomDry, C.skyBottom, skyT) },
      ],
    },
    mist: {
      type: 'linear',
      from: [0, 0],
      to: [0, 1],
      stops: [
        { offset: 0, color: C.mist, opacity: 0 },
        { offset: 0.5, color: C.mist, opacity: ramp(g.weeks, [[0, 0.95], [6, 0.92]]) },
        { offset: 1, color: C.mist, opacity: 0 },
      ],
    },
    field: {
      type: 'linear',
      from: [0, 0],
      to: [0, 1],
      stops: [
        { offset: 0, color: lerp3(C.fieldDry[0], C.fieldMid[0], C.fieldFull[0], m) },
        { offset: 0.5, color: lerp3(C.fieldDry[1], C.fieldMid[1], C.fieldFull[1], m) },
        { offset: 1, color: lerp3(C.fieldDry[2], C.fieldMid[2], C.fieldFull[2], m) },
      ],
    },
    joint: {
      type: 'linear',
      from: [0, 0],
      to: [0, 1],
      stops: [
        { offset: 0, color: C.jointTop },
        { offset: 1, color: C.jointBottom },
      ],
    },
    culmNear: {
      type: 'linear',
      from: [0, 0],
      to: [1, 0],
      stops: [
        { offset: 0, color: C.culmNear[0] },
        { offset: 0.45, color: C.culmNear[1] },
        { offset: 1, color: C.culmNear[2] },
      ],
    },
    culmMid: {
      type: 'linear',
      from: [0, 0],
      to: [1, 0],
      stops: [
        { offset: 0, color: C.culmMid[0] },
        { offset: 1, color: C.culmMid[1] },
      ],
    },
    stone: radial([C.stoneLight, C.sumi, C.stoneDark]),
    cobbleA: radial(C.cobbleA),
    cobbleB: radial(C.cobbleB),
    cobbleC: radial(C.cobbleC),
    mossLight: radial(C.mossLight, true),
    mossMid: radial(C.mossMid, true),
    mossDeep: radial(C.mossDeep, true),
    vignette: {
      // モック原値は端の墨 0.16 だが、実機だと四隅の減光が強く画面を暗く見せる。
      // 周辺を落ち着かせる効果は残しつつ半分(0.08)にして初見の暗さを和らげる。
      type: 'radial',
      center: [0.5, 0.45],
      radius: 0.78,
      stops: [
        { offset: 0.62, color: C.shadowInk, opacity: 0 },
        { offset: 1, color: C.shadowInk, opacity: 0.08 },
      ],
    },
  };
}

// ---------------------------------------------------------------- モック移植テーブル
// 座標はモックの 1200×800 系。世界座標へは wx()(dims.ts)で +FRAME_X する。

// 参道の目地(S字)。Day 1 の気配・目地・(縮尺の基準として)縄にも共用
const JOINT_D =
  'M525,805 C517,790 513,775 512,760 C509,747 507,733 506,720 C504,708 503,697 503,685 ' +
  'C503,673 504,661 506,650 C510,638 515,626 521,615 C526,604 531,593 537,583 C545,573 553,563 561,553 ' +
  'C568,544 576,534 582,525 C584,516 585,507 585,498 C584,490 582,481 581,473 C580,465 579,458 579,450 ' +
  'C578,443 576,436 575,430 L602,430 C607,436 610,443 613,450 C617,458 620,465 623,473 C627,481 631,490 635,498 ' +
  'C637,507 640,516 642,525 C639,534 635,544 631,553 C627,563 623,573 619,583 C616,593 613,604 611,615 ' +
  'C608,626 607,638 606,650 C606,661 608,673 613,685 C617,697 621,708 626,720 C632,733 639,747 647,760 ' +
  'C656,775 665,790 675,805 Z';

// 敷石35枚(モックの記載順 = 手前→奥 = 敷かれる順)
type CobbleSpec = [cx: number, cy: number, rx: number, ry: number, rot: number, paint: 'A' | 'B' | 'C'];
const COBBLES: CobbleSpec[] = [
  [545, 795, 24, 14, 8, 'A'], [600, 793, 26, 15, -5, 'B'], [655, 796, 23, 13, 11, 'C'],
  [528, 763, 22, 13, -9, 'C'], [583, 761, 24, 14, 6, 'A'], [636, 764, 21, 12, -7, 'B'],
  [520, 726, 20, 12, 10, 'B'], [570, 724, 22, 13, -4, 'C'], [618, 727, 19, 11, 7, 'A'],
  [512, 692, 18, 11, -11, 'A'], [558, 690, 20, 12, 5, 'B'], [604, 693, 17, 10, -6, 'C'],
  [516, 657, 17, 10, 9, 'C'], [558, 655, 18, 11, -8, 'A'], [598, 658, 16, 9, 4, 'B'],
  [528, 622, 15, 9, -5, 'B'], [566, 620, 17, 10, 8, 'C'], [604, 623, 14, 8, -10, 'A'],
  [545, 589, 14, 8, 6, 'A'], [580, 587, 15, 9, -7, 'B'], [613, 590, 13, 7.5, 9, 'C'],
  [566, 557, 13, 7.5, -6, 'C'], [598, 555, 14, 8, 5, 'A'], [626, 558, 12, 7, -9, 'B'],
  [588, 528, 12, 7, 7, 'B'], [616, 526, 13, 7.5, -5, 'C'], [638, 529, 11, 6, 8, 'A'],
  [592, 500, 11, 6, -8, 'A'], [618, 498, 12, 6.5, 6, 'B'],
  [588, 476, 10, 5.5, -6, 'C'], [612, 474, 10.5, 6, 9, 'A'],
  [585, 455, 9, 5, -7, 'B'], [606, 453, 9, 5, 5, 'C'],
  [582, 436, 7.5, 4, 6, 'A'], [598, 435, 8, 4.5, -6, 'B'],
];

/** 記録日数 → 敷石の枚数。Day1=3 / Day42=24 / Day84=全35(モックの3パネルに一致)。単調非減少 */
export function cobbleCount(recordedDays: number): number {
  const n = Math.max(0, Math.floor(recordedDays));
  if (n === 0) return 0;
  if (n <= 42) return Math.min(24, 3 + Math.round(((n - 1) * 21) / 41));
  return Math.min(COBBLES.length, 24 + Math.round(((n - 42) * (COBBLES.length - 24)) / 42));
}

// 杭(左右の列、手前→奥)と縄のセグメント
const POSTS_L: [number, number, number, number, number][] = [
  [509, 732, 5, 28, 1.5], [502, 666, 4.5, 24, 1.5], [528, 591, 4, 21, 1.2],
  [570, 522, 3.5, 18, 1], [572, 465, 3, 15, 1], [572, 420, 3, 12, 1],
];
const POSTS_R: [number, number, number, number, number][] = [
  [645, 732, 5, 28, 1.5], [609, 666, 4.5, 24, 1.5], [600, 591, 4, 21, 1.2],
  [638, 522, 3.5, 18, 1], [613, 465, 3, 15, 1], [594, 420, 3, 12, 1],
];
const ROPE_L_START = 'M512,732';
const ROPE_L_SEGS = ['Q503,702 505,666', 'Q512,626 530,591', 'Q550,554 572,522', 'Q576,492 574,465', 'Q572,440 574,420'];
const ROPE_R_START = 'M648,732';
const ROPE_R_SEGS = ['Q622,700 611,666', 'Q604,636 602,591', 'Q616,560 640,522', 'Q626,492 615,465', 'Q604,440 596,420'];

/** 記録日数 → 杭の対の数。Day1=1 / Day42=3 / Day84=6。縄は対-1 セグメント */
export function postPairCount(recordedDays: number): number {
  return Math.max(1, Math.round(6 * clamp01(recordedDays / 84)));
}

// 石(§4: 宣言。Day 1 から完成状態)
const STONE_MAIN_D =
  'M292,532 q22,-50 76,-56 q62,-6 94,28 q26,32 -6,56 q-44,34 -102,22 q-56,-12 -62,-50 z';
const STONE_MAIN_SKIRT_D =
  'M306,558 q40,26 118,16 q26,-4 38,-16 q-10,26 -50,34 q-70,12 -106,-14 z';
const STONE_COMP_D =
  'M822,598 q14,-34 52,-38 q42,-4 62,20 q16,22 -6,38 q-30,22 -68,14 q-38,-8 -40,-34 z';
const STONE_COMP_SKIRT_D =
  'M830,618 q26,14 68,8 q16,-2 24,-10 q-6,16 -32,22 q-42,8 -64,-10 z';

// 苔の房。[x, y, finalScale, rot, day42Scale?] day42Scale が無いものは後半(m>0.5)で現れる
type TuftSpec = { x: number; y: number; s: number; rot?: number; s42?: number };
const FAR_TUFTS: TuftSpec[] = [
  { x: 150, y: 448, s: 0.55, s42: 0.45 }, { x: 300, y: 458, s: 0.6, s42: 0.5 },
  { x: 432, y: 448, s: 0.5 }, { x: 706, y: 452, s: 0.6, s42: 0.5 },
  { x: 836, y: 444, s: 0.5 }, { x: 982, y: 454, s: 0.6, s42: 0.45 },
  { x: 1112, y: 446, s: 0.55 }, { x: 60, y: 456, s: 0.5 },
];
const MID_TUFTS: TuftSpec[] = [
  { x: 140, y: 502, s: 1.05, s42: 0.9 }, { x: 262, y: 542, s: 1.2, s42: 1.05 },
  { x: 396, y: 486, s: 0.95, s42: 0.85 }, { x: 460, y: 548, s: 1.15, rot: 6, s42: 1 },
  { x: 726, y: 540, s: 1.2, rot: -5, s42: 1 }, { x: 796, y: 492, s: 1 },
  { x: 948, y: 522, s: 1.2, s42: 0.9 }, { x: 1084, y: 498, s: 1.05, rot: 4 },
  { x: 58, y: 562, s: 1.15, s42: 0.95 }, { x: 1156, y: 562, s: 1.1 },
  { x: 196, y: 472, s: 0.8 }, { x: 872, y: 470, s: 0.8, rot: -8 },
];
const FORE_TUFTS: TuftSpec[] = [
  { x: 112, y: 646, s: 2, s42: 1.6 }, { x: 94, y: 742, s: 1.8, rot: 5, s42: 1.4 },
  { x: 252, y: 708, s: 2.2, s42: 1.7 }, { x: 336, y: 642, s: 1.5, rot: -6, s42: 1.2 },
  { x: 408, y: 748, s: 1.8 }, { x: 462, y: 672, s: 1.3, rot: 8, s42: 1 },
  { x: 752, y: 678, s: 1.5, rot: -4 }, { x: 816, y: 748, s: 2, s42: 1.5 },
  { x: 936, y: 656, s: 1.7, s42: 1.2 }, { x: 1046, y: 722, s: 2.2, rot: 6 },
  { x: 1148, y: 646, s: 1.6, rot: -7 }, { x: 1160, y: 762, s: 1.9 },
  { x: 202, y: 606, s: 1.2, s42: 1 }, { x: 980, y: 592, s: 1.15, rot: -5 },
  { x: 452, y: 606, s: 1, rot: 4 }, { x: 736, y: 606, s: 1.05 },
];
// 前景の苔の面。[cx, cy, rx, ry, deep?, day42比率]
const FORE_BLOBS: [number, number, number, number, boolean, number | null][] = [
  [150, 740, 150, 70, true, 0.86], [390, 775, 130, 60, false, null],
  [810, 778, 140, 62, true, 0.79], [1080, 745, 160, 72, false, null],
];

// 木漏れ日: 光だまり [cx, cy, rx, ry, rot, color, 最終op(Day84)]
// §変更2: 到達距離(reach)で cy に応じて手前へ滲み広がる。cy が小さい(奥)ほど早く灯る。
// 先頭3つは最奥(竹林の足元)の溜まり。Week0 でもわずかに存在する(光がある世界)。
const LIGHT_POOLS: [number, number, number, number, number, string, number][] = [
  [230, 450, 160, 20, -14, C.lightPoolSoft, 0.22],
  [650, 452, 180, 22, -12, C.lightPoolSoft, 0.2],
  [1010, 448, 160, 20, -14, C.lightPoolSoft, 0.22],
  [150, 520, 120, 30, -18, C.lightPoolSoft, 0.25],
  [1010, 540, 130, 32, -15, C.lightPoolSoft, 0.25],
  [300, 600, 190, 46, -16, C.lightPool, 0.3],
  [860, 640, 210, 50, -14, C.lightPool, 0.26],
  [560, 700, 160, 40, -12, C.lightPoolWarm, 0.22],
];
// 竹の長い影(右上光源→左下)。[点8つ, 最終op]。影は光が届いた所にだけ落ちる(前端のyで判定)
const TRUNK_SHADOWS: [number[], number][] = [
  [[159, 446, 176, 446, 20, 586, -12, 574], 0.26],
  [[260, 442, 274, 442, 108, 578, 78, 568], 0.24],
  [[470, 440, 482, 440, 318, 572, 290, 562], 0.24],
  [[640, 442, 653, 442, 476, 584, 446, 573], 0.26],
  [[860, 442, 874, 442, 692, 592, 660, 580], 0.24],
  [[1030, 442, 1043, 442, 862, 588, 832, 577], 0.24],
  [[1122, 452, 1148, 452, 964, 640, 924, 624], 0.26],
  [[1008, 448, 1026, 448, 850, 616, 818, 603], 0.22],
];
const BRANCH_SHADOWS: [number[], number][] = [
  [[668, 700, 690, 688, 508, 760, 496, 776], 0.2],
  [[648, 586, 664, 577, 522, 642, 512, 655], 0.18],
];
// 光条(右上の光源から斜めに)。[点8つ, 最終op]。overhead の光なので reach で全体が強まる
const LIGHT_SHAFTS: [number[], number][] = [
  [[760, 30, 830, 30, 520, 560, 455, 535], 0.12],
  [[950, 60, 1005, 60, 700, 540, 650, 520], 0.09],
  [[560, 20, 610, 20, 430, 430, 390, 415], 0.07],
];

// ---------------------------------------------------------------- 光の到達距離(§変更2)
// 連続週数 → 光と竹の影が「竹林の足元(最奥)から手前(画面最下部)へ」どこまで届いたか。
// Week0 でも最奥にわずかに溜まり(ゼロにしない)、週を重ねるごとに手前へ滲み出る。
// 先端はハード境界にせず feather 幅でグラデ状に消える。reach は weeks に単調非減少。
const LIGHT_FEET_Y = 452; // 竹林の足元(地面の最奥)
const LIGHT_BOTTOM_Y = 900; // 画面最下部より下(reach=1 で前景まで完全に届く)
const LIGHT_FEATHER = 180; // 光の先端のにじみ幅(px)

/** weeks(0〜12)→ 到達距離 0〜1 */
function lightReach(weeks: number): number {
  return clamp01(weeks / FULL_WEEKS);
}
/** reach における光の先端の y 座標 */
function lightFrontY(reach: number): number {
  return lerp(LIGHT_FEET_Y, LIGHT_BOTTOM_Y, reach);
}
/** y 位置での光の届き具合 0〜1。先端(frontY 付近)を feather 幅で柔らかく減衰させる */
function lightVisAt(frontY: number, y: number): number {
  return clamp01((frontY - y) / LIGHT_FEATHER + 0.5);
}

// Day 42 の乾いた地の残り / Day 1 の乾いた粒
const DRY_PATCHES: [number, number, number, number][] = [
  [980, 475, 110, 26], [120, 700, 100, 30], [420, 765, 80, 22], [1130, 580, 70, 20],
];
const DRY_GRAINS: [number, number][] = [
  [120, 520], [240, 620], [180, 720], [420, 560], [760, 600], [900, 700],
  [1020, 560], [1100, 680], [330, 760], [700, 740], [80, 620], [960, 480],
];
// 苔の飛び地(広がりの先端)。[x, y, r, 現れる苔しきい値]
const MOSS_PATCHES: [number, number, number, number][] = [
  [486, 452, 2.6, 0.35], [286, 452, 2.4, 0.35], [762, 448, 2.4, 0.35],
  [1046, 700, 2.6, 0.35], [1120, 640, 2.4, 0.35], [700, 720, 2.4, 0.35],
  [96, 452, 3, 0.7], [936, 456, 3, 0.7], [1130, 448, 2.4, 0.7],
];

// ---------------------------------------------------------------- 房の展開テーブル
// モックの <g id="tuft">(玉9個+粒16個)。レンダラが tuft プリミティブを展開する際に使う。

export const TUFT_BALLS: [number, number, number, number, 'mossMid' | 'mossDeep' | 'mossLight'][] = [
  [0, 0, 34, 18, 'mossMid'], [-30, 10, 26, 14, 'mossDeep'], [30, 8, 24, 13, 'mossLight'],
  [-8, 18, 20, 11, 'mossDeep'], [18, -10, 18, 10, 'mossLight'], [-38, -6, 16, 9, 'mossMid'],
  [40, 16, 14, 8, 'mossDeep'], [4, -16, 12, 7, 'mossMid'], [-20, -14, 10, 6, 'mossLight'],
];
export const TUFT_GRAINS_LIGHT: [number, number, number][] = [
  [-20, -8, 2.6], [-5, -14, 2.2], [10, -10, 2.8], [24, -2, 2.2], [-32, 4, 2.4], [2, 2, 2],
  [16, 8, 2.4], [-14, 10, 2.2], [30, 10, 2], [-26, 14, 2.4], [8, 16, 2], [38, 2, 2.2],
];
export const TUFT_GRAINS_DARK: [number, number, number][] = [
  [-12, 16, 2.2], [22, 14, 2], [-36, 12, 2.2], [36, 18, 1.8],
];
/** Day 1 の簡易版(玉5個+粒7個) */
export const TUFT_SIMPLE_BALLS = TUFT_BALLS.slice(0, 5);
export const TUFT_SIMPLE_GRAINS_LIGHT: [number, number, number][] = [
  [-20, -8, 2.6], [10, -10, 2.8], [-32, 4, 2.4], [16, 8, 2.4], [-14, 10, 2.2],
];
export const TUFT_SIMPLE_GRAINS_DARK: [number, number, number][] = [
  [-12, 16, 2.2], [22, 14, 2],
];

// ---------------------------------------------------------------- 房の出現制御

// 苔は主石の根元から外周へ(§4)。中心からの距離順にしきい値を割り当てる。
// Day 42 でモックに居る房は m<=0.5 側、居ない房は m>0.5 側に必ず入る。
const STONE_CENTER = { x: 352, y: 530 };

function tuftThresholds(tufts: TuftSpec[]): number[] {
  const dist = (t: TuftSpec) => Math.hypot(t.x - STONE_CENTER.x, t.y - STONE_CENTER.y);
  const rank = (subset: TuftSpec[], lo: number, hi: number) => {
    const sorted = [...subset].sort((a, b) => dist(a) - dist(b));
    const map = new Map<TuftSpec, number>();
    sorted.forEach((t, i) => {
      map.set(t, subset.length === 1 ? lo : lo + ((hi - lo) * i) / (subset.length - 1));
    });
    return map;
  };
  const members = tufts.filter((t) => t.s42 != null);
  const rest = tufts.filter((t) => t.s42 == null);
  const mMap = rank(members, 0.03, 0.45);
  const rMap = rank(rest, 0.52, 0.95);
  return tufts.map((t) => (t.s42 != null ? mMap.get(t)! : rMap.get(t)!));
}

/** m(苔の充実)における房のスケール係数。単調非減少 */
function tuftScaleAt(t: TuftSpec, thr: number, m: number): number | null {
  if (m < thr) return null;
  if (t.s42 != null) {
    const s42 = t.s42 / t.s;
    if (m <= 0.5) {
      const k = thr >= 0.5 ? 1 : (m - thr) / (0.5 - thr);
      return t.s * lerp(0.6 * s42, s42, k);
    }
    return t.s * lerp(s42, 1, (m - 0.5) / 0.5);
  }
  return t.s * lerp(0.6, 1, thr >= 1 ? 1 : (m - thr) / (1 - thr));
}

// ---------------------------------------------------------------- 翼(左右の拡張)の生成

type WingTuft = { x: number; y: number; s: number; rot: number; thr: number };

function wingTufts(rng: Rng, xMin: number, xMax: number, count: number, band: [number, number], sRange: [number, number]): WingTuft[] {
  const out: WingTuft[] = [];
  for (let i = 0; i < count; i++) {
    const x = range(rng, xMin, xMax);
    const y = range(rng, band[0], band[1]);
    // 中央パネルから遠いほど遅く現れる(外周へ広がる)
    const d = Math.min(Math.abs(x - FRAME_X), Math.abs(x - (FRAME_X + FRAME_W)));
    const thr = clamp01(0.3 + 0.6 * (d / FRAME_X) + range(rng, -0.06, 0.06));
    out.push({ x, y, s: range(rng, sRange[0], sRange[1]), rot: range(rng, -8, 8), thr });
  }
  return out;
}

type Wings = {
  farCulmsL: number[][]; farCulmsR: number[][];
  midCulmsL: MidCulmSpec[]; midCulmsR: MidCulmSpec[];
  canopyExtra: [number, number, number, number, string, number][];
  farTufts: WingTuft[]; midTufts: WingTuft[]; foreTufts: WingTuft[];
  foreBlobs: [number, number, number, number, boolean, number][]; // + thr
  dryGrains: [number, number][];
  rocks: { x: number; y: number; scale: number }[];
  shadowsR: number[][]; shadowL: number[][];
  poolL: [number, number, number, number, number];
};

function buildWings(): Wings {
  const rng = mulberry32(WING_SEED);
  // 遠景の竹: 左は疎、右(竹林が濃くなる)は密
  const farCulmsL = [800, 890, 985].map((x) => [x, range(rng, 70, 95), range(rng, 6, 8), range(rng, 340, 360)]);
  const farCulmsR = [2270, 2330, 2395, 2455, 2515, 2560].map((x) => [x, range(rng, 66, 90), range(rng, 6, 9), range(rng, 340, 364)]);
  const midCulm = (x: number, w: number) => ({
    rot: range(rng, -1.2, 1.2), rcx: x + w / 2, rcy: 240,
    x, y: range(rng, 40, 50), w, h: range(rng, 390, 400),
    nodes: [range(rng, 128, 156), range(rng, 232, 262), range(rng, 330, 366)],
  });
  const midCulmsL = [midCulm(660, 12), midCulm(880, 13)];
  const midCulmsR = [midCulm(2320, 14), midCulm(2455, 13), midCulm(2590, 15), midCulm(2710, 14)];
  const canopyExtra: [number, number, number, number, string, number][] = [
    [700, 26, 220, 80, C.canopyLight, 0.5], [905, 44, 170, 60, C.canopyMid, 0.4],
    [2420, 20, 240, 84, C.canopyDark, 0.7], [2660, 40, 220, 86, C.canopyLight, 0.55],
    [2890, 24, 230, 90, C.canopyDark, 0.7],
  ];
  // 苔: 左翼は苔原が広がる(密)、右翼は竹林に譲って疎
  const farTufts = [
    ...wingTufts(rng, 260, 1030, 7, [440, 462], [0.45, 0.6]),
    ...wingTufts(rng, 2270, 3080, 4, [440, 462], [0.45, 0.6]),
  ];
  const midTufts = [
    ...wingTufts(rng, 230, 1030, 10, [478, 566], [0.85, 1.2]),
    ...wingTufts(rng, 2270, 3100, 5, [478, 566], [0.8, 1.1]),
  ];
  const foreTufts = [
    ...wingTufts(rng, 130, 1040, 10, [640, 770], [1.2, 2.2]),
    ...wingTufts(rng, 2260, 3220, 8, [618, 774], [1.1, 1.9]),
  ];
  // 前景の面は下端に半分沈める(切れて見えるのが正しい)
  const foreBlobs: [number, number, number, number, boolean, number][] = [
    [430, 786, 150, 70, true, 0.35], [760, 800, 130, 62, false, 0.55],
    [120, 775, 130, 64, false, 0.75], [2450, 792, 140, 64, true, 0.5],
    [2900, 788, 150, 70, false, 0.7], [3220, 795, 130, 62, true, 0.85],
  ];
  const dryGrains: [number, number][] = [];
  for (let i = 0; i < 9; i++) dryGrains.push([range(rng, 260, 1020), range(rng, 470, 780)]);
  for (let i = 0; i < 6; i++) dryGrains.push([range(rng, 2300, 3120), range(rng, 470, 780)]);
  // 左翼の石群(景石。データの石とは別の、庭の地形)。x,y は石の中心の世界座標。
  // 前景の房(y>=606)に埋もれない高さに置く
  const rocks = [
    { x: 385, y: 588, scale: 0.66 }, { x: 585, y: 622, scale: 0.48 },
    { x: 185, y: 552, scale: 0.55 },
  ];
  // 右翼の竹影(w>=7)と左翼の影・光だまり
  const shadowsR = [2350, 2500, 2650].map((x) => {
    const drop = range(rng, 136, 150);
    return [x, 444, x + 14, 444, x - drop, 588, x - drop - 31, 577];
  });
  const shadowL = [[700, 446, 714, 446, 556, 586, 526, 575]];
  const poolL: [number, number, number, number, number] = [560, 620, 150, 38, -15];
  return {
    farCulmsL, farCulmsR, midCulmsL, midCulmsR, canopyExtra,
    farTufts, midTufts, foreTufts, foreBlobs, dryGrains, rocks, shadowsR, shadowL, poolL,
  };
}

// 翼は成長パラメータに依らず形が同じ(見え方だけが育つ)ので一度だけ作る
const WINGS = buildWings();

// ---------------------------------------------------------------- 大地の輪郭(絵巻全幅)

const FIELD_D = (() => {
  // 中央はモックの輪郭そのまま(+1050)。左右は同じ振幅で穏やかに延長
  const left = `M210,408 C420,390 630,424 840,410 C940,400 1000,412 ${wx(0)},415 `;
  const mock =
    `C${wx(150)},392 ${wx(300)},422 ${wx(450)},408 ` +
    `C${wx(600)},394 ${wx(750)},422 ${wx(900)},408 ` +
    `C${wx(1050)},395 ${wx(1150)},414 ${wx(1200)},404 `;
  const right = 'C2350,396 2450,418 2550,406 C2700,392 2850,420 3000,406 C3080,398 3120,410 3150,404 ';
  return `${left}${mock}${right}L3150,${WORLD_H} L210,${WORLD_H} Z`;
})();

// ---------------------------------------------------------------- シーン構築

function tuftPrim(x: number, y: number, s: number, rot?: number, simple?: boolean): Prim {
  return { kind: 'tuft', x, y, scale: s, rotateDeg: rot, simple };
}

export function buildScene(g: GrowthParams): Scene {
  const m = g.moss;
  const w = g.weeks;
  const n = g.recordedDays;
  // 光の到達距離(§変更2): weeks を「奥→手前へ光がどこまで届いたか」に読み替える
  const reach = lightReach(w);
  const frontY = lightFrontY(reach);
  const layers: SceneLayer[] = [];
  const push = (id: string, parallax: number, groups: SceneGroup[]) => {
    const nonEmpty = groups.filter((gr) => gr.prims.length > 0 && gr.opacity !== 0);
    if (nonEmpty.length) layers.push({ id, parallax, groups: nonEmpty });
  };

  // ---- 空 (0.1)
  push('sky', 0.1, [
    { prims: [{ kind: 'rect', x: 0, y: -WORLD_H, w: WORLD_W, h: WORLD_H * 2, paint: ref('sky') }] },
  ]);

  // ---- 借景の竹林(§変更1): Day1 から完成形で固定。成長パラメータに依存しない。
  // 遠景(0.25)と中景+梢+葉(0.45)をここで、手前の太竹(0.8)は苔の大地の後で描く。
  const [bambooFar, bambooMid, bambooNear] = buildBambooLayers(WINGS);
  layers.push(bambooFar);
  layers.push(bambooMid);

  // ---- 朝靄 (0.6)。借景の空気遠近(霞)。竹林と同じく完成形で固定(north-star Day84)。
  // 靄奥へ続く道のゴーストは削除(§変更3)。
  push('mist', 0.6, [
    { prims: [{ kind: 'rect', x: 0, y: 330, w: WORLD_W, h: 150, paint: ref('mist'), blur: 6 }] },
  ]);

  // ---- 苔の大地 + 遠中景の房 + 光だまり (0.8)
  const fieldGroups: SceneGroup[] = [
    { wobble: 'strong', prims: [{ kind: 'path', d: FIELD_D, paint: ref('field') }] },
  ];
  // 乾いた粒(Day 1 の地肌)は苔が育つと消える
  const grainOp = clamp01(1 - m / 0.5);
  if (grainOp > 0) {
    fieldGroups.push({
      opacity: grainOp,
      prims: [...DRY_GRAINS.map(([x, y]) => ({ kind: 'circle', cx: wx(x), cy: y, r: 1.8, paint: solid(C.dryGrain) }) as Prim),
        ...WINGS.dryGrains.map(([x, y]) => ({ kind: 'circle', cx: x, cy: y, r: 1.8, paint: solid(C.dryGrain) }) as Prim)],
    });
  }
  // 緑の中に残る乾いた地(中盤のみ)
  const patchOp = 0.45 * clamp01(Math.min(m / 0.15, (0.95 - m) / 0.3));
  if (patchOp > 0.01) {
    fieldGroups.push({
      wobble: 'strong', opacity: patchOp,
      prims: DRY_PATCHES.map(([cx, cy, rx, ry]) => ({
        kind: 'ellipse', cx: wx(cx), cy, rx, ry, paint: solid(C.dryPatch),
      }) as Prim),
    });
  }
  // 遠景の房
  const farThr = tuftThresholds(FAR_TUFTS);
  const farPrims: Prim[] = [];
  FAR_TUFTS.forEach((t, i) => {
    const s = tuftScaleAt(t, farThr[i], m);
    if (s != null) farPrims.push(tuftPrim(wx(t.x), t.y, s, t.rot));
  });
  for (const t of WINGS.farTufts) {
    if (m >= t.thr) farPrims.push(tuftPrim(t.x, t.y, t.s * lerp(0.6, 1, clamp01((m - t.thr) / Math.max(0.05, 1 - t.thr))), t.rot));
  }
  fieldGroups.push({ blur: 1.2, opacity: 0.85, prims: farPrims });
  // 中景の房
  const midThr = tuftThresholds(MID_TUFTS);
  const midPrims: Prim[] = [];
  MID_TUFTS.forEach((t, i) => {
    const s = tuftScaleAt(t, midThr[i], m);
    if (s != null) midPrims.push(tuftPrim(wx(t.x), t.y, s, t.rot));
  });
  for (const t of WINGS.midTufts) {
    if (m >= t.thr) midPrims.push(tuftPrim(t.x, t.y, t.s * lerp(0.6, 1, clamp01((m - t.thr) / Math.max(0.05, 1 - t.thr))), t.rot));
  }
  fieldGroups.push({ wobble: 'soft', prims: midPrims });
  // 苔の飛び地
  const patchDots = MOSS_PATCHES.filter(([, , , thr]) => m >= thr).map(
    ([x, y, r]) => ({ kind: 'circle', cx: wx(x), cy: y, r, paint: solid(C.mossPatch) }) as Prim,
  );
  fieldGroups.push({ prims: patchDots });
  // 光だまり(§変更2): cy(奥ほど早い)に応じて手前へ滲み広がる。先端は feather で柔らかく
  const poolPrims: Prim[] = [];
  LIGHT_POOLS.forEach(([cx, cy, rx, ry, rot, color, opFull]) => {
    const op = opFull * lightVisAt(frontY, cy);
    if (op <= 0.005) return;
    poolPrims.push({ kind: 'ellipse', cx: wx(cx), cy, rx, ry, rotateDeg: rot, paint: solid(color), opacity: op });
  });
  {
    const [cx, cy, rx, ry, rot] = WINGS.poolL;
    const op = 0.22 * lightVisAt(frontY, cy);
    if (op > 0.005) poolPrims.push({ kind: 'ellipse', cx, cy, rx, ry, rotateDeg: rot, paint: solid(C.lightPool), opacity: op });
  }
  fieldGroups.push({ blur: 6, prims: poolPrims });
  push('field', 0.8, fieldGroups);

  // ---- 手前の太竹 (0.8)。庭の縁に立つ。完成形で固定(§変更1)
  layers.push(bambooNear);

  // ---- 参道 + 石 (1.0)
  const pathGroups: SceneGroup[] = [];
  // 道のゴースト(S字の薄いリボン+破線の縁)は削除(§変更3)。
  // 未解放の小道は「存在しない」。目地・敷石は記録が進んで初めて現れる。
  // 目地(§変更3): 全長のS字を薄く見せる「ゴースト」はしない。
  // 敷かれた敷石の到達点(最奥の石)までを前→奥にクリップして現す。未敷設部は存在しない。
  const nCobbles = cobbleCount(n);
  if (nCobbles > 0) {
    const builtBackY = COBBLES[nCobbles - 1][1]; // 最後に敷いた(最奥の)石の y
    pathGroups.push({
      wobble: 'soft',
      clip: { x: 0, y: builtBackY, w: WORLD_W, h: WORLD_H + 20 - builtBackY },
      prims: [{ kind: 'path', d: JOINT_D, transform: { tx: FRAME_X }, paint: ref('joint') }],
    });
  }
  // 敷石(記録の歩み)
  const cobbles = COBBLES.slice(0, nCobbles).map(([cx, cy, rx, ry, rot, pt]) => ({
    kind: 'ellipse', cx: wx(cx), cy, rx, ry, rotateDeg: rot, paint: ref(`cobble${pt}`),
  }) as Prim);
  pathGroups.push({ wobble: 'cobble', prims: cobbles });
  // 杭と縄(敷石と同じ歩調)
  const pairs = postPairCount(n);
  const postPrims: Prim[] = [];
  for (const side of [POSTS_L, POSTS_R]) {
    side.slice(0, pairs).forEach(([x, y, pw, ph, rx]) => {
      postPrims.push({ kind: 'rect', x: wx(x), y, w: pw, h: ph, rx, paint: solid(C.post) });
    });
  }
  pathGroups.push({ prims: postPrims });
  if (pairs >= 2) {
    const ropeL = ROPE_L_START + ' ' + ROPE_L_SEGS.slice(0, pairs - 1).join(' ');
    const ropeR = ROPE_R_START + ' ' + ROPE_R_SEGS.slice(0, pairs - 1).join(' ');
    pathGroups.push({
      opacity: 0.75,
      prims: [ropeL, ropeR].map((d) => ({
        kind: 'path', d, transform: { tx: FRAME_X },
        stroke: { color: C.rope, width: 2 },
      }) as Prim),
    });
  }
  // 左翼の景石。添石(STONE_COMP_D、モック中心 ≒ 879,615)を縮小して置く
  const ROCK_SRC = { x: 879, y: 615 };
  pathGroups.push({
    wobble: 'soft',
    prims: WINGS.rocks.flatMap((r) => {
      const sc = r.scale;
      return [
        {
          kind: 'ellipse', cx: r.x, cy: r.y + 32 * sc,
          rx: 66 * sc, ry: 13 * sc, paint: solid(C.shadowInk), opacity: 0.16, blur: 4,
        } as Prim,
        {
          kind: 'path', d: STONE_COMP_D,
          transform: { tx: r.x - ROCK_SRC.x * sc, ty: r.y - ROCK_SRC.y * sc, scale: sc },
          paint: ref('stone'),
        } as Prim,
      ];
    }),
  });
  // 石(宣言): 主石 → 添石 → 三の石
  const shadowOp = ramp(w, [[0, 1], [12, 1.55]]);
  const stonePrims: Prim[] = [];
  const skirtOp = clamp01((m - 0.05) / 0.25);
  if (g.stones >= 1) {
    stonePrims.push(
      {
        kind: 'ellipse',
        cx: wx(ramp(w, [[0, 372], [6, 352], [12, 348]])), cy: ramp(w, [[0, 598], [6, 600], [12, 600]]),
        rx: ramp(w, [[0, 92], [6, 98], [12, 102]]), ry: ramp(w, [[0, 17], [6, 18], [12, 19]]),
        paint: solid(C.shadowInk), opacity: 0.14 * shadowOp, blur: 6,
      },
      { kind: 'path', d: STONE_MAIN_D, transform: { tx: FRAME_X }, paint: ref('stone') },
      {
        kind: 'ellipse', cx: wx(368), cy: 498, rx: 46, ry: 15,
        paint: solid(C.stoneHighlight), opacity: ramp(w, [[0, 0.25], [6, 0.28], [12, 0.32]]), blur: 4,
      },
    );
    if (skirtOp > 0.01) {
      stonePrims.push({ kind: 'path', d: STONE_MAIN_SKIRT_D, transform: { tx: FRAME_X }, paint: solid(C.mossSkirt), opacity: skirtOp });
    }
    // 最初の苔一房(宣言の夜から主石の根元に宿る)
    stonePrims.push(tuftPrim(wx(352), 576, 0.7, undefined, m < 0.15));
    for (const [dx, dy, r] of [[416, 586, 2.6], [300, 580, 2.2], [380, 606, 2]] as const) {
      stonePrims.push({ kind: 'circle', cx: wx(dx), cy: dy, r, paint: solid(C.mossPatch) });
    }
  }
  if (g.stones >= 2) {
    stonePrims.push(
      {
        kind: 'ellipse',
        cx: wx(ramp(w, [[0, 854], [6, 850], [12, 846]])), cy: ramp(w, [[0, 642], [6, 644], [12, 644]]),
        rx: ramp(w, [[0, 62], [6, 66], [12, 70]]), ry: ramp(w, [[0, 12], [6, 13], [12, 14]]),
        paint: solid(C.shadowInk), opacity: 0.13 * shadowOp, blur: 6,
      },
      { kind: 'path', d: STONE_COMP_D, transform: { tx: FRAME_X }, paint: ref('stone') },
    );
    if (skirtOp > 0.01) {
      stonePrims.push({ kind: 'path', d: STONE_COMP_SKIRT_D, transform: { tx: FRAME_X }, paint: solid(C.mossSkirt), opacity: skirtOp });
    }
  }
  if (g.stones >= 3) {
    const T = { tx: FRAME_X - 640, ty: 62 };
    stonePrims.push(
      {
        kind: 'ellipse', cx: wx(214), cy: 706, rx: 58, ry: 12,
        paint: solid(C.shadowInk), opacity: 0.13 * shadowOp, blur: 6,
      },
      { kind: 'path', d: STONE_COMP_D, transform: T, paint: ref('stone') },
    );
    if (skirtOp > 0.01) {
      stonePrims.push({ kind: 'path', d: STONE_COMP_SKIRT_D, transform: T, paint: solid(C.mossSkirt), opacity: skirtOp });
    }
  }
  pathGroups.push({ wobble: 'soft', prims: stonePrims });
  push('path', 1.0, pathGroups);

  // ---- 竹の長い影 (0.8)。§変更2: 影は光が届いた所にだけ落ちる(前端yで判定)。
  // 石畳を渡るため道の上に描く。
  const shadowFrontY = (pts: number[]) => Math.max(...pts.filter((_, i) => i % 2 === 1));
  const shadowPrims: Prim[] = [];
  TRUNK_SHADOWS.forEach(([pts, opFull]) => {
    const op = opFull * lightVisAt(frontY, shadowFrontY(pts));
    if (op <= 0.005) return;
    shadowPrims.push({
      kind: 'polygon', points: pts.map((v, i) => (i % 2 === 0 ? wx(v) : v)),
      paint: solid(C.trunkShadow), opacity: op,
    });
  });
  for (const pts of WINGS.shadowsR) {
    const op = 0.24 * lightVisAt(frontY, shadowFrontY(pts));
    if (op > 0.005) shadowPrims.push({ kind: 'polygon', points: pts, paint: solid(C.trunkShadow), opacity: op });
  }
  for (const pts of WINGS.shadowL) {
    const op = 0.22 * lightVisAt(frontY, shadowFrontY(pts));
    if (op > 0.005) shadowPrims.push({ kind: 'polygon', points: pts, paint: solid(C.trunkShadow), opacity: op });
  }
  const branchPrims: Prim[] = BRANCH_SHADOWS.flatMap(([pts, opFull]) => {
    const op = opFull * lightVisAt(frontY, shadowFrontY(pts));
    return op > 0.005
      ? [{
          kind: 'polygon', points: pts.map((v, i) => (i % 2 === 0 ? wx(v) : v)),
          paint: solid(C.branchShadow), opacity: op,
        } as Prim]
      : [];
  });
  push('trunk-shadows', 0.8, [
    { blur: 2.2, prims: shadowPrims },
    { blur: 2.2, prims: branchPrims },
  ]);

  // ---- 前景の苔 (1.1)
  const foreGroups: SceneGroup[] = [];
  const blobPrims: Prim[] = [];
  FORE_BLOBS.forEach(([cx, cy, rx, ry, deep, r42]) => {
    const thr = r42 != null ? 0.18 : 0.62;
    if (m < thr) return;
    const k = r42 != null
      ? (m <= 0.5 ? lerp(0.6 * r42, r42, (m - thr) / (0.5 - thr)) : lerp(r42, 1, (m - 0.5) / 0.5))
      : lerp(0.6, 1, (m - thr) / (1 - thr));
    blobPrims.push({
      kind: 'ellipse', cx: wx(cx), cy, rx: rx * k, ry: ry * k,
      paint: ref(deep ? 'mossDeep' : 'mossMid'),
    });
  });
  for (const [cx, cy, rx, ry, deep, thr] of WINGS.foreBlobs) {
    if (m < thr) continue;
    const k = lerp(0.6, 1, clamp01((m - thr) / Math.max(0.05, 1 - thr)));
    blobPrims.push({ kind: 'ellipse', cx, cy, rx: rx * k, ry: ry * k, paint: ref(deep ? 'mossDeep' : 'mossMid') });
  }
  foreGroups.push({ wobble: 'strong', prims: blobPrims });
  const foreThr = tuftThresholds(FORE_TUFTS);
  const forePrims: Prim[] = [];
  FORE_TUFTS.forEach((t, i) => {
    const s = tuftScaleAt(t, foreThr[i], m);
    if (s != null) forePrims.push(tuftPrim(wx(t.x), t.y, s, t.rot));
  });
  for (const t of WINGS.foreTufts) {
    if (m >= t.thr) forePrims.push(tuftPrim(t.x, t.y, t.s * lerp(0.6, 1, clamp01((m - t.thr) / Math.max(0.05, 1 - t.thr))), t.rot));
  }
  foreGroups.push({ wobble: 'soft', prims: forePrims });
  // 朱のひとひら(Day 84 のみ)。苔の上に一枚だけ、それ以外の演出はしない。
  // モックと同じく前景の房の上に載る
  if (g.redLeaf) {
    foreGroups.push({
      prims: [{
        kind: 'path',
        d: 'M0,-10 L3,-3 L10,-4 L5,2 L7,9 L0,5 L-7,9 L-5,2 L-10,-4 L-3,-3 Z',
        transform: { tx: wx(760), ty: 684, scale: 1.5, rotateDeg: 24 },
        paint: solid(C.shu),
      }],
    });
  }
  push('fore', 1.1, foreGroups);

  // ---- 光条 (0.45)。右上の光源から斜めに。§変更2: overhead の光なので reach 全体で強まる
  // (Week0 でもごく淡く点る=光がある世界。手前への到達は光だまり・影が担う)
  const shaftK = 0.12 + 0.88 * reach;
  const shaftPrims: Prim[] = [];
  LIGHT_SHAFTS.forEach(([pts, opFull]) => {
    const op = opFull * shaftK;
    if (op <= 0.005) return;
    shaftPrims.push({
      kind: 'polygon', points: pts.map((v, i) => (i % 2 === 0 ? wx(v) : v)),
      paint: solid(C.lightShaft), opacity: op,
    });
  });
  push('light-shafts', 0.45, [{ blur: 16, prims: shaftPrims }]);

  return {
    worldWidth: WORLD_W,
    worldHeight: WORLD_H,
    frameX: FRAME_X,
    frameWidth: FRAME_W,
    horizonY: HORIZON_Y,
    paints: buildPaints(g),
    layers,
    overlay: { grain: true, vignette: true },
  };
}
